/*
 * B15 – zpracování stažených článků Joomly (volá nastroje/joomla-migrace.mjs zpracovat). Nic nezapisuje mimo migrace/.
 * Text → omezený Markdown listu Příspěvky (odstavce, **tučně**, [odkaz](https://…), odrážky „- “ – jako prVycistitText_ / prHtml_ v Prispevky.gs).
 * Fotky: delší strana 1600 px, JPEG bez EXIF/GPS (nastroje/zmensit-foto.swift), menší než 200 px a ikony vynechá, první = hlavní.
 * Přílohy (PDF, DOC(X), XLS(X), PPT(X)) stáhne s MD5 – import je porovná se zveřejněnými dokumenty orgánů a místo kopie odkáže na dokument.
 * Interní odkazy na staré články → ?clanek=…, mapa přesměrování stará URL → adresa (migrace/presmerovani.json).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const NOVY_WEB = 'https://oshpz.cz'; // prostredi/ostry.config.js webUrl – nové odkazy ?clanek=
const PRILOHY = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', rtf: 'application/rtf', odt: 'application/vnd.oasis.opendocument.text', zip: 'application/zip' };
const OBRAZKY = /\.(jpe?g|png|gif|webp|bmp|tiff?|heic)(\?|$)/i;
/** Ne aktuality, ale stálé stránky starého webu (seznamy členů, kontakty) – nový web je má jinde (orgány, kontakty, sbory). */
const VYNECHAT_KATEGORIE = ['Seznamy členů', 'Výkonný výbor OSH', 'Okresní odborná rada bezpečnosti'];

/** Štítky z kategorie Joomly (název kategorie + cesta kategorie v adrese, bez slova z titulku článku) – všechna pravidla, která sedí, bez duplicit. */
const STITKY = [
  [/jednani|jednání|zapis|vykonny-vybor|kontrolni|okrr|odborn[aá] rad|shromazd|valn/i, 'orgány'],
  [/mlad|oorm|plamen|dorost|\bmh\b|uzlov|zhvb|vsestrann/i, 'MH'],
  [/sport|orhs|soutez|soutěž|pohar|pohár|liga/i, 'soutěže'],
  [/akce/i, 'akce'],
  [/akce-sdh|sbor|sdh/i, 'sbory'],
  [/zasluz|zaslouž|medail|blahopr|vzpomin|vzpomín|seznam-zh|aktiv/i, 'zasloužilí hasiči'],
  [/histor|odboj|kronik|zanikl/i, 'historie'],
  [/dokument/i, 'dokumenty'],
  [/vzdel|škol|skoleni|školení|prevenc|ochrana obyv/i, 'vzdělávání'],
  [/zpravy|zprávy|uvodni|úvodní/i, 'okres']
];
function stitkyZ(kategorie, cesta) {
  const t = [], co = (kategorie || '') + ' ' + (cesta || '');
  STITKY.forEach(([re, s]) => { if (re.test(co) && t.indexOf(s) < 0) t.push(s); });
  return t.length ? t : ['okres'];
}

/** Adresa ?clanek=… z titulku – stejně jako prSlug_ v Prispevky.gs. */
const slug = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '') || 'prispevek';
/** Rozbité kódování (UTF-8 čtené jako Latin-1 / Windows-1250): „Å¾“, „Ã¡“… → zkusí opravit, když to sníží počet podezřelých znaků. */
function opravitKodovani(s) {
  const zle = x => (x.match(/[ÃÅÄÂ][\u0080-\u00ff]/g) || []).length;
  if (!zle(s)) return s;
  try { const o = Buffer.from(s, 'latin1').toString('utf8'); return zle(o) < zle(s) && !/\ufffd/.test(o) ? o : s; } catch (e) { return s; }
}

export async function zpracovat(n) {
  const { stahni, dekoduj, idClanku, VYSTUP, MEDIA, WEB } = n;
  const ZM = path.join(VYSTUP, 'bin', 'zmensit-foto');
  if (!fs.existsSync(ZM)) { fs.mkdirSync(path.dirname(ZM), { recursive: true }); execFileSync('swiftc', ['-O', path.join(path.dirname(new URL(import.meta.url).pathname), 'zmensit-foto.swift'), '-o', ZM]); }
  const st = JSON.parse(fs.readFileSync(path.join(VYSTUP, 'stazeno.json'), 'utf8'));
  // článek z kanálu, jehož adresa bez menu vrací 404 → text stránky podle čísla článku
  for (const c of Object.values(st.clanky).filter(c => c.status !== 200)) {
    const r = await stahni(WEB + '/index.php?option=com_content&view=article&id=' + c.id);
    if (r.status === 200) { const h = r.data.toString('utf8'), i = h.indexOf('com-content-article__body'); c.html = i >= 0 ? h.slice(h.indexOf('>', i) + 1, h.indexOf('</main>')) : ''; c.status = 200; c.odkaz = WEB + '/index.php?option=com_content&view=article&id=' + c.id; c.problemNacteni = true; }
  }
  const vynechane = Object.values(st.clanky).filter(c => c.status === 200 && (c.mimoKanaly || VYNECHAT_KATEGORIE.indexOf(c.kategorie) >= 0))
    .map(c => ({ id: c.id, titulek: c.titulek || '(bez titulku)', kategorie: c.kategorie || '(mimo kategorie)', zacatek: dekoduj(String(c.html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, 60),
      duvod: c.mimoKanaly ? 'stálá stránka webu (bez data, mimo kategorie)' : 'seznam členů / stránka orgánu s kontakty' }));
  fs.writeFileSync(path.join(VYSTUP, 'vynechane.json'), JSON.stringify(vynechane, null, 1));
  const clanky = Object.values(st.clanky).filter(c => c.status === 200 && !c.mimoKanaly && VYNECHAT_KATEGORIE.indexOf(c.kategorie) < 0).sort((a, b) => String(b.zverejneno).localeCompare(String(a.zverejneno)) || b.id - a.id);
  const host = new URL(WEB).hostname.replace(/^www\./, '');
  const nasWeb = u => { try { const x = new URL(u); return x.hostname.replace(/^www\./, '') === host; } catch (e) { return false; } };
  const abs = u => { try { return new URL(dekoduj(String(u || '').trim()), WEB + '/').href; } catch (e) { return ''; } };

  // 1) adresy (slug, při shodě + rok, pak -2…) – nejdřív všechny, kvůli přepisu interních odkazů
  const obsazeno = {}, adresa = {};
  clanky.slice().sort((a, b) => String(a.zverejneno).localeCompare(String(b.zverejneno)) || a.id - b.id).forEach(c => {
    c.titulek = opravitKodovani(dekoduj(c.titulek || '')).replace(/\s+/g, ' ').trim();
    let a = slug(c.titulek), rok = String(c.zverejneno || '').slice(0, 4);
    if (obsazeno[a] && rok) a = (a + '-' + rok).replace(/^(.{0,80}).*$/, '$1');
    let i = 2; const z = a; while (obsazeno[a]) a = z + '-' + i++;
    obsazeno[a] = true; adresa[c.id] = a;
  });

  const radky = [], presmerovani = { verze: 1, web: NOVY_WEB, cesty: {}, id: {} }, statistika = { fotek: 0, fotekB: 0, fotekPuvodneB: 0, priloh: 0, prilohB: 0, prilohUnikB: 0, vynechanoMalych: 0 };
  const md5Videno = {};
  let poradi = 0;
  for (const c of clanky) {
    poradi++;
    if (poradi % 25 === 0) console.log('  … ' + poradi + '/' + clanky.length);
    const ctx = { obrazky: [], soubory: [], videa: [], externi: [], interni: [], stareStranky: [], http: 0, pluginy: [], skryteEmaily: 0 };
    // celá stránka (z mezipaměti) – hlavní obrázek článku (Joomla „Full Text Image“) je mimo tělo
    let html = c.html || '';
    try { const r = await stahni(c.odkaz); const h = r.data.toString('utf8'); (h.match(/<figure[^>]*item-image[\s\S]*?<\/figure>/gi) || []).forEach(f => { html = f + html; }); } catch (e) {}
    if (!html && c.shrnuti) html = c.shrnuti;
    const text = opravitKodovani(naMarkdown(html, ctx, { abs, nasWeb, idClanku, dekoduj, adresa }));
    const pro = { puvodniId: c.id, puvodniUrl: c.odkaz, kategorie: c.kategorie || '', Titulek: c.titulek, Perex: '', Text: text, Autor: /^(oshpz|admin|super user|administrator)$/i.test(c.autor || '') ? '' : (c.autor || ''),
      Zdroj: 'joomla', Stav: 'zveřejněno', 'Zveřejněno': c.zverejneno || '', 'Pro koho': 'veřejnost', Adresa: adresa[c.id], 'Štítky': '', fotky: [], prilohy: [], problemy: [] };
    let cesta = ''; try { cesta = decodeURIComponent(new URL(c.odkaz).pathname).replace(/\/\d+-[^/]*$/, ''); } catch (e) {} // jen cesta kategorie
    pro['Štítky'] = stitkyZ(pro.kategorie, cesta).join(', ');
    // perex: první odstavec bez formátování
    const odst = text.split(/\n{2,}/).filter(x => !/^- /.test(x) && !/ \| /.test(x)), prvni = odst.find(x => x.replace(/[*\-\s]/g, '').length >= 60) || odst.find(x => x.replace(/[*\-\s]/g, '').length > 20) || '';
    const holy = prvni.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\*\*/g, '').replace(/^\s*-\s+/gm, '').replace(/\s+/g, ' ').trim();
    pro.Perex = holy.length <= 240 ? holy : holy.slice(0, 220).replace(/\s+\S*$/, '') + '…';
    if (!c.zverejneno) pro.problemy.push('datum zveřejnění neznámé (článek není v kanálu kategorie)');
    if (c.problemNacteni) pro.problemy.push('stránka článku na staré adrese nejde otevřít (text podle čísla článku)');
    if (ctx.skryteEmaily) pro.problemy.push('e-mail skrytý ochranou Joomly vynechán (' + ctx.skryteEmaily + '×)');
    // fotky
    const slozka = path.join(MEDIA, String(c.id));
    const videne = {};
    for (const o of ctx.obrazky) {
      const u = o.src;
      if (!u || videne[u] || /^data:/i.test(u) || /emoji|smil|icon|ikon|\/media\/(system|mod_|com_|plg_|templates)|\/templates\//i.test(u) || /\.svg(\?|$)/i.test(u)) continue;
      videne[u] = true;
      const r = await stahni(u);
      if (r.status !== 200 || !/^image\//.test(r.typ || '') && !OBRAZKY.test(u)) { pro.problemy.push('rozbitý obrázek: ' + u + ' (HTTP ' + r.status + ')'); continue; }
      fs.mkdirSync(slozka, { recursive: true });
      const tmp = path.join(VYSTUP, 'cache', 'img-' + crypto.createHash('sha1').update(u).digest('hex'));
      fs.writeFileSync(tmp, r.data);
      const nazev = 'foto-' + String(pro.fotky.length + 1).padStart(2, '0') + '.jpg', cil = path.join(slozka, nazev);
      let rozmery;
      try { rozmery = execFileSync(ZM, [tmp, cil, '1600', '0.82']).toString().trim().split(/\s+/).map(Number); }
      catch (e) { pro.problemy.push('obrázek nejde přečíst: ' + u); continue; }
      if (Math.max(rozmery[0], rozmery[1]) < 200) { fs.unlinkSync(cil); statistika.vynechanoMalych++; continue; }
      const vel = fs.statSync(cil).size;
      pro.fotky.push({ soubor: path.relative(VYSTUP, cil), n: nazev, puvodni: u, w: rozmery[2], h: rozmery[3], velikost: vel });
      statistika.fotek++; statistika.fotekB += vel; statistika.fotekPuvodneB += r.data.length;
      if (!nasWeb(u)) pro.problemy.push('obrázek z cizího webu (stažen): ' + u);
    }
    // přílohy
    const videneS = {};
    for (const s of ctx.soubory) {
      if (videneS[s.url]) continue; videneS[s.url] = true;
      const r = await stahni(s.url);
      if (r.status !== 200 || !r.data.length || /text\/html/.test(r.typ || '')) { pro.problemy.push('rozbitá příloha: ' + s.url + (r.status === 200 ? ' (místo souboru stránka – soubor na starém webu chybí)' : ' (HTTP ' + r.status + ')')); continue; }
      fs.mkdirSync(slozka, { recursive: true });
      let jm = s.nazev.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120);
      if (fs.existsSync(path.join(slozka, jm))) jm = jm.replace(/(\.[^.]+)?$/, '-' + (pro.prilohy.length + 1) + '$1');
      fs.writeFileSync(path.join(slozka, jm), r.data);
      const md5 = crypto.createHash('md5').update(r.data).digest('hex');
      pro.prilohy.push({ soubor: path.relative(VYSTUP, path.join(slozka, jm)), n: jm, m: PRILOHY[s.ext] || 'application/octet-stream', velikost: r.data.length, md5: md5, puvodni: s.url });
      statistika.priloh++; statistika.prilohB += r.data.length; if (!md5Videno[md5]) { md5Videno[md5] = true; statistika.prilohUnikB += r.data.length; }
    }
    if (!text.replace(/[*\-\s]/g, '') && !pro.fotky.length && !pro.prilohy.length) pro.problemy.push('prázdný text (bez fotek a příloh)');
    else if (text.replace(/\s/g, '').length < 40 && !pro.fotky.length && !pro.prilohy.length) pro.problemy.push('téměř prázdný text (' + text.length + ' znaků)');
    ctx.videa.forEach(v => pro.problemy.push('vložené video (převedeno na odkaz): ' + v));
    ctx.pluginy.forEach(v => pro.problemy.push('značka pluginu Joomly odstraněna: ' + v));
    if (ctx.stareStranky.length) pro.problemy.push('odkaz na stránku starého webu (ponechán jako text): ' + ctx.stareStranky.slice(0, 3).join(', '));
    pro.odkazyMimoWeb = ctx.externi.length; pro.odkazyHttp = ctx.http; pro.interniOdkazy = ctx.interni.length;
    radky.push(pro);
    // přesměrování: SEF cesta, varianta bez /index.php a číslo článku
    try { const x = new URL(c.odkaz); presmerovani.cesty[decodeURIComponent(x.pathname) + x.search] = adresa[c.id]; presmerovani.cesty[decodeURIComponent(x.pathname).replace(/^\/index\.php/, '') + x.search] = adresa[c.id]; } catch (e) {}
    presmerovani.id[String(c.id)] = adresa[c.id];
  }
  fs.writeFileSync(path.join(VYSTUP, 'prispevky.json'), JSON.stringify(radky, null, 1));
  fs.writeFileSync(path.join(VYSTUP, 'presmerovani.json'), JSON.stringify(presmerovani, null, 1));
  fs.writeFileSync(path.join(VYSTUP, 'report.json'), JSON.stringify({ kategorie: st.kategorie, statistika, pozadavku: st.pozadavku, clanku: radky.length }, null, 1));
  console.log('Zpracováno ' + radky.length + ' článků, ' + statistika.fotek + ' fotek, ' + statistika.priloh + ' příloh.');
}

/* ---------- HTML → omezený Markdown ---------- */
const BLOK = /^(p|div|h[1-6]|blockquote|section|article|header|footer|center|figure|figcaption|table|tbody|thead|tr|ul|ol|hr|pre|address|dl|dt|dd|form|fieldset|main|aside|nav)$/i;
function naMarkdown(html, ctx, n) {
  const { abs, nasWeb, idClanku, dekoduj, adresa } = n;
  let h = String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(noscript|svg|button|select|textarea)[\s\S]*?<\/\1>/gi, ' ');
  // ochrana e-mailů Joomly (adresa je ve skriptu, zbude jen věta) – pryč
  h = h.replace(/Tato e-mailov[áa] adresa je chr[áa]něna před spamboty\.?\s*(Pro jej[íi] zobrazen[íi] mus[íi]te m[íi]t povolen Javascript\.?)?/gi, () => { ctx.skryteEmaily++; return ' '; });
  // značky pluginů Joomly {loadmodule …}, {gallery}…{/gallery}, {youtube}id{/youtube}
  h = h.replace(/\{(youtube|vimeo)\}([^{]+)\{\/\1\}/gi, (m, t, id) => { const u = t.toLowerCase() === 'youtube' ? 'https://www.youtube.com/watch?v=' + id.trim() : 'https://vimeo.com/' + id.trim(); ctx.videa.push(u); return '<p>Video: ' + u + '</p>'; });
  h = h.replace(/\{(gallery|sigplus|phocagallery|tabs?|slider)[^}]*\}[\s\S]*?\{\/\1\}/gi, (m, jm) => { ctx.pluginy.push('{' + jm + '}'); return ' '; });
  h = h.replace(/\{(\/?)([a-z_]+)(\s[^}]*)?\}/gi, (m, z, jm) => { if (/^(gallery|loadmodule|loadposition|tab|tabs|slider|sigplus|phocagallery|module|component|jcomments|rokbox)/i.test(jm)) { if (!z) ctx.pluginy.push('{' + jm + '}'); return ' '; } return m; });
  const attr = (t, a) => { const m = t.match(new RegExp('\\s' + a + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i')); return m ? dekoduj(m[2] != null ? m[2] : m[3] != null ? m[3] : m[4]) : ''; };
  const bloky = []; let radek = '', nadpis = false, otevreno = false; const odkazy = [];
  const konecOdstavce = () => { if (radek.trim()) bloky.push(radek); radek = ''; };
  const casti = h.split(/(<[^>]*>)/);
  for (const t of casti) {
    if (!t) continue;
    if (t[0] !== '<') { let x = dekoduj(t).replace(/[\u00a0\s]+/g, ' ');
      if (otevreno && /^\s/.test(x)) { radek = radek.slice(0, -2) + ' **'; x = x.trimStart(); } // mezera za otevřeným tučným jde před značku
      if (x) otevreno = false; radek += x; continue; }
    const m = t.match(/^<\s*(\/?)\s*([a-z0-9]+)/i); if (!m) continue;
    const zav = !!m[1], jm = m[2].toLowerCase();
    if (jm === 'br') { radek += '\n'; continue; }
    if (jm === 'img') { const src = attr(t, 'src'); if (src) ctx.obrazky.push({ src: abs(src), alt: attr(t, 'alt') }); continue; }
    if (/^(iframe|embed|object|video|source)$/.test(jm) && !zav) { const src = attr(t, 'src') || attr(t, 'data'); if (src && jm !== 'source') { const u = abs(src); ctx.videa.push(u); konecOdstavce(); bloky.push('Video: ' + u.replace(/^http:/, 'https:')); } continue; }
    if (jm === 'li') { konecOdstavce(); if (!zav) radek = '- '; continue; }
    if (/^h[1-6]$/.test(jm)) { if (!zav) { konecOdstavce(); radek = '**'; nadpis = true; otevreno = true; } else { radek = /^\*\*\s*$/.test(radek) ? '' : radek.trimEnd() + '**'; nadpis = false; otevreno = false; konecOdstavce(); } continue; }
    if (BLOK.test(jm)) { if (/^(td|th)$/.test(jm)) continue; konecOdstavce(); continue; }
    if (jm === 'td' || jm === 'th') { if (!zav && radek.trim()) radek += ' | '; continue; }
    if (jm === 'b' || jm === 'strong') { if (nadpis) continue; // nadpis je celý tučně
      if (!zav) { radek += '**'; otevreno = true; } else if (otevreno) { radek = radek.slice(0, -2); otevreno = false; } else { const m = radek.match(/\s+$/); radek = radek.trimEnd() + '**' + (m ? ' ' : ''); }
      continue; }
    if (jm === 'a') {
      if (!zav) { odkazy.push({ href: attr(t, 'href'), start: radek.length }); continue; }
      const o = odkazy.pop(); if (!o) continue;
      const vnitrek = radek.slice(o.start), holy = vnitrek.replace(/\*\*/g, '').trim();
      radek = radek.slice(0, o.start) + odkaz(o.href, vnitrek, holy);
      continue;
    }
  }
  konecOdstavce();
  function odkaz(href, vnitrek, holy) {
    href = String(href || '').trim();
    if (!href || href[0] === '#' || /^javascript:/i.test(href)) return vnitrek;
    if (/^mailto:/i.test(href)) return vnitrek || href.slice(7);
    const u = abs(href); if (!u) return vnitrek;
    const ext = (u.split('?')[0].match(/\.([a-z0-9]{2,5})$/i) || [])[1];
    if (nasWeb(u) && ext && /^(jpe?g|png|gif|webp)$/i.test(ext)) { ctx.obrazky.push({ src: u }); return vnitrek; }
    if (ext && PRILOHY[ext.toLowerCase()] && nasWeb(u)) { /* soubory starého webu okresu → přílohy; cizí dokumenty zůstanou odkazem */ ctx.soubory.push({ url: u, ext: ext.toLowerCase(), nazev: decodeURIComponent(u.split('?')[0].split('/').pop()) }); return vnitrek; }
    if (nasWeb(u)) {
      const id = idClanku(u);
      if (id && adresa[id]) { ctx.interni.push(id); const cil = NOVY_WEB + '/?clanek=' + adresa[id]; return holy ? '[' + holy + '](' + cil + ')' : cil; }
      ctx.stareStranky.push(u.replace(/^https?:\/\/[^/]+/, '')); return vnitrek;
    }
    ctx.externi.push(u);
    let cil = u; if (/^http:/i.test(cil)) { cil = cil.replace(/^http:/i, 'https:'); ctx.http++; }
    if (!/^https:\/\//i.test(cil)) return vnitrek;
    // Gmail/Google přesměrování a sledovací parametry pryč
    try { const x = new URL(cil); ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'].forEach(p => x.searchParams.delete(p)); cil = x.href; } catch (e) {}
    if (!holy || holy === u || holy === cil || holy.replace(/^https?:\/\//, '') === cil.replace(/^https?:\/\//, '')) return cil;
    return '[' + holy.replace(/[[\]]/g, '') + '](' + cil + ')';
  }
  // úklid: tučné značky kolem mezer, prázdné tučné, mezery, prázdné řádky
  const vystup = bloky.map(b => b.split('\n').map(r => r.replace(/\*\*\*\*/g, '').replace(/[ \t]+/g, ' ').trim()).filter(r => r && r !== '**' && r !== '-' && r !== '|').join('\n')).filter(b => b.replace(/[*\-|\s]/g, '').length);
  // po sobě jdoucí odrážky v jednom seznamu (jeden řádek mezi nimi), jinak odstavce
  let md = vystup.reduce((a, b, i) => a + (i ? (/^- /.test(b) && /^- /.test(vystup[i - 1]) ? '\n' : '\n\n') : '') + b, '');
  // nepárové ** v řádku pryč (zbytky po rozbitém HTML)
  md = md.split('\n').map(r => ((r.match(/\*\*/g) || []).length % 2 ? r.replace(/\*\*/g, '') : r)).join('\n');
  // stejná pravidla jako prVycistitText_: bez HTML, odkazy jen https, max. 2 prázdné řádky
  return md.replace(/<\/?[a-z!?][^>]*>/gi, '').replace(/\[([^\]\n]*)\]\((?!https:\/\/)[^)\n]*\)/g, '$1').replace(/\n{3,}/g, '\n\n').trim();
}
export { naMarkdown, stitkyZ, slug };
