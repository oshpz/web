/**
 * OSH data – B14 Příspěvky (aktuality) na web (list Příspěvky).
 * Nový soubor „Prispevky“ ve stejném projektu.
 *
 * Role (sloupec Příspěvky v listu Uživatelé, kontrola jen tady na serveru):
 *   zveřejnit (a Správce) – píše, upravuje a zveřejňuje svoje i cizí příspěvky, vrací a stahuje.
 *   navrhnout             – píše a upravuje jen svoje příspěvky ve stavu koncept / vráceno k úpravě a posílá je ke schválení.
 * Stavy: koncept → ke schválení → zveřejněno (→ staženo); ke schválení → vráceno k úpravě (povinná poznámka) → ke schválení.
 * Text je omezený Markdown (odstavce, **tučně**, [odkaz](https://…), odrážky „- “). Ukládá se vyčištěný, do HTML ho převádí
 *   jen prHtml_ (vše escapuje) – web ani aplikace nikdy nevkládají surový text jako HTML.
 * Soubory: složka Příspěvky/<ID> na sdíleném disku (DISK_ID); seznam v sloupci „Přílohy“ (JSON, vyplňuje aplikace).
 *   Fotky zmenší prohlížeč (1600 px, JPEG, bez EXIF/GPS), fotky z e-mailu zmenší server přes náhled Disku (prZmensitFoto_).
 *   Sdílení až po zveřejnění: veřejnost = odkazem, všechny sbory = skupina sbory@ (nastavitSdileni_). Stažení sdílení zruší.
 * E-mail: časovač každých 10 min (prijmoutPrispevkyEmailem) čte poštu na PRISPEVKY_EMAIL za 14 dní bez štítku OSH-prispevky/… (alias účtu, pod kterým
 *   skript běží). Jen od aktivních uživatelů s rolí Příspěvky → nový příspěvek „ke schválení“; ostatní dostanou štítek a zůstanou.
 */

const LIST_PRISPEVKY = 'Příspěvky';
const PR_STAVY = ['koncept', 'ke schválení', 'vráceno k úpravě', 'zveřejněno', 'staženo'];
const PR_PRO = ['veřejnost', 'všechny sbory'];
const PR_AUTOR_UPRAVUJE = ['koncept', 'vráceno k úpravě'];
const PR_FOTO = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' };
const PR_PRILOHY = { 'application/pdf': 'pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx' };
const PR_MAIL_DNY = 14; // e-maily na PRISPEVKY_EMAIL hledá skript za posledních 14 dní (časovač běží každých 10 min – rezerva na výpadek)
const PR_MAX_SOUBORU = 40, PR_FOTO_PX = 1600, PR_TEXT_MAX = 20000;
// štítky v Gmailu bez diakritiky – hledání label:… s diakritikou není spolehlivé
const PR_STITKY_MAIL = { zpracovano: 'OSH-prispevky/zpracovano', nepovoleno: 'OSH-prispevky/nepovoleno', chyba: 'OSH-prispevky/chyba' };

/** 'zveřejnit' | 'navrhnout' | '' */
function prRole_(o) {
  if (!o || !o.role) return '';
  if (o.role['Správce'] || o.role['Příspěvky'] === 'zveřejnit') return 'zveřejnit';
  return o.role['Příspěvky'] ? 'navrhnout' : '';
}
function prSmiUpravit_(o, r) {
  const role = prRole_(o);
  return role === 'zveřejnit' || (role === 'navrhnout' && normEmail_(r['Autor']) === o.email && PR_AUTOR_UPRAVUJE.indexOf(r['Stav']) >= 0);
}

/* ---------- text: omezený Markdown → bezpečné HTML ---------- */

/** Vyčistí text před uložením: bez řídicích znaků a HTML značek, odkazy jen https. */
function prVycistitText_(t) {
  return String(t == null ? '' : t).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .replace(/<\/?[a-z!?][^>]*>/gi, '').replace(/\[([^\]\n]*)\]\((?!https:\/\/)[^)\n]*\)/g, '$1').replace(/\n{3,}/g, '\n\n').trim();
}

/** Omezený Markdown → HTML. Vše se nejdřív escapuje; povolené jsou jen <p>, <br>, <ul><li>, <strong>, <a href="https://…">.
 *  Stejná funkce je v aplikaci (náhled) – při změně upravte obě. */
function prHtml_(md) {
  const esc = x => String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tucne = x => x.replace(/\*\*([^*\n]{1,500}?)\*\*/g, '<strong>$1</strong>');
  const radek = x => {
    const odkazy = [];
    const t = String(x).replace(/\[([^\]\n]{1,200})\]\((https:\/\/[^\s()<>"']{3,500})\)|(https:\/\/[^\s<>"']{2,500}[^\s<>"'.,;:!?)\]])/g,
      (m, text, url, holy) => { odkazy.push(text ? [text, url] : [holy, holy]); return '\u0001' + (odkazy.length - 1) + '\u0002'; });
    return tucne(esc(t)).replace(/\u0001(\d+)\u0002/g, (m, i) => '<a href="' + esc(odkazy[i][1]) + '" target="_blank" rel="noopener noreferrer">' + tucne(esc(odkazy[i][0])) + '</a>');
  };
  const t = prBezApostrofu_(md).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim();
  if (!t) return '';
  return t.split(/\n{2,}/).map(blok => {
    const out = []; let p = [], li = [];
    const odstavec = () => { if (p.length) out.push('<p>' + p.map(radek).join('<br>') + '</p>'); p = []; };
    const odrazky = () => { if (li.length) out.push('<ul>' + li.map(x => '<li>' + radek(x) + '</li>').join('') + '</ul>'); li = []; };
    blok.split('\n').forEach(r => { const m = r.match(/^\s*[-*•]\s+(.*)$/); if (m) { odstavec(); li.push(m[1]); } else { odrazky(); p.push(r.trim()); } });
    odstavec(); odrazky();
    return out.join('');
  }).join('');
}

/** Text začínající „- “ (odrážka) ukládá bezVzorce_ s apostrofem; Tabulky ho skryjí, tady pro jistotu pryč. */
function prBezApostrofu_(t) { return String(t == null ? '' : t).replace(/^'(?=[=+\-@])/, ''); }

/** Začátek textu bez formátování (perex, když chybí). */
function prZkratit_(t, n) {
  const x = prBezApostrofu_(t).replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\*\*/g, '').replace(/^\s*[-*•]\s+/gm, '').replace(/\s+/g, ' ').trim();
  return x.length <= n ? x : x.slice(0, n).replace(/\s+\S*$/, '') + '…';
}

/** Adresa pro odkaz ?clanek=… z titulku (bez diakritiky, jen a–z, 0–9 a pomlčky). */
function prSlug_(titulek) {
  return String(titulek || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '') || 'prispevek';
}

/* ---------- řádky ---------- */

function prSoubory_(v) {
  try { const a = JSON.parse(String(v || '[]')); return Array.isArray(a) ? a.filter(x => x && (x.id || x.u)) : []; } catch (e) { return []; }
}
function prStitky_(v) {
  return String(v || '').split(/[,;]+/).map(x => x.trim()).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);
}
function prJmena_() {
  const m = {};
  radkyRychle_('Uživatelé').forEach(u => { if (u['E-mail']) m[normEmail_(u['E-mail'])] = String(u['Jméno'] || '').trim(); });
  return m;
}
const prIso_ = v => v instanceof Date ? v.toISOString() : (v == null ? '' : v);

/** Řádek pro aplikaci (správa okresu). */
function prJson_(r, o, jmena) {
  const out = {};
  ['ID', 'Titulek', 'Perex', 'Text', 'Štítky', 'Pro koho', 'Stav', 'Autor', 'Zdroj', 'Adresa', 'Odkaz', 'Poznámka', 'Hlavní fotka – ID', 'Zveřejněno', 'Vytvořeno', 'Upraveno']
    .forEach(k => { out[k] = prIso_(r[k]); });
  out['Text'] = prBezApostrofu_(out['Text']);
  out['Pro koho'] = out['Pro koho'] || 'veřejnost';
  out['Připnout'] = ano_(r['Připnout']);
  out.autorJmeno = (jmena || {})[normEmail_(r['Autor'])] || '';
  out.soubory = prSoubory_(r['Přílohy']);
  out.smiUpravit = prSmiUpravit_(o, r);
  out.smiZverejnit = prRole_(o) === 'zveřejnit';
  return out;
}

function prNacist_() {
  const sh = dataSs_().getSheetByName(LIST_PRISPEVKY);
  if (!sh) throw new Error('Chybí list Příspěvky – spusťte zalozitStrukturu.');
  const h = hlavicka_(sh);
  ['Pro koho', 'Hlavní fotka – ID', 'Připnout', 'Štítky', 'Adresa', 'Poznámka'].forEach(k => { if (h.indexOf(k) < 0) throw new Error('V listu Příspěvky chybí sloupec „' + k + '“ – spusťte zalozitStrukturu.'); });
  const v = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues() : [];
  return { sh, h, v, obj: r => h.reduce((x, k, j) => (k && (x[k] = r[j]), x), {}) };
}
function prRadek_(t, id) { return id ? t.v.findIndex(r => String(r[t.h.indexOf('ID')]) === String(id)) : -1; }
function prZapsat_(t, i, r) {
  const radek = r.map(bezVzorce_);
  if (i >= 0) t.sh.getRange(i + 2, 1, 1, t.h.length).setValues([radek]); else t.sh.appendRow(radek);
}

/* ---------- API (aplikace) ---------- */

function apiPrispevky_(req) {
  const o = prihlaseny_(req.token);
  if (!o) return { ok: false, chyba: 'Nepřihlášen', odhlasen: true };
  if (!prRole_(o)) return { ok: false, chyba: 'Příspěvky píše jen role Příspěvky nebo Správce.' };
  switch (req.akce) {
    case 'prispevky': return prSeznam_(o);
    case 'prispevekUlozit': return prUlozit_(o, req);
    case 'prispevekRozhodnout': return prRozhodnout_(o, req);
    case 'prispevekSoubor': return prSoubor_(o, req);
    case 'prispevekSouborSmazat': return prSouborSmazat_(o, req);
    case 'prispevekNahledy': return prNahledy_(o, req);
    case 'prispevekSmazat': return prSmazat_(o, req);
  }
  return { ok: false, chyba: 'Neznámá akce' };
}

/** zveřejnit: všechny příspěvky; navrhnout: svoje + zveřejněné (jen ke čtení). Navíc zveřejněné dokumenty pro odkazy. */
function prSeznam_(o) {
  const t = prNacist_(), jmena = prJmena_(), role = prRole_(o);
  const data = t.v.filter(r => r[t.h.indexOf('ID')]).map(t.obj)
    .filter(r => role === 'zveřejnit' || normEmail_(r['Autor']) === o.email || r['Stav'] === 'zveřejněno')
    .map(r => prJson_(r, o, jmena))
    .sort((a, b) => String(b['Upraveno'] || b['Vytvořeno']).localeCompare(String(a['Upraveno'] || a['Vytvořeno'])));
  const dokumenty = cistVerejne_('dokumenty', {}).filter(d => d['Veřejný odkaz'])
    .map(d => ({ id: String(d['ID']), n: [d['Orgán'], d['Název']].filter(Boolean).join(' – '), u: d['Veřejný odkaz'], datum: prIso_(d['Datum']) }))
    .sort((a, b) => String(b.datum).localeCompare(String(a.datum)));
  return { ok: true, data: data, dokumenty: dokumenty, role: role };
}

function prKontrola_(d) {
  const text = prVycistitText_(d['Text']);
  const stitky = prStitky_(d['Štítky']);
  return kontrolaTextu_({ 'Titulek': d['Titulek'], 'Perex': d['Perex'] }, { 'Titulek': 200, 'Perex': 600 }) ||
    (stitky.length > 8 ? 'Nejvýše 8 štítků.' : null) || (stitky.some(x => x.length > 30) ? 'Štítek může mít nejvýše 30 znaků.' : null) ||
    kontrolaTextu_({ 'Štítky': stitky.join(', ') }, { 'Štítky': 300 }) ||
    (text.length > PR_TEXT_MAX ? 'Text je příliš dlouhý (nejvýše ' + PR_TEXT_MAX + ' znaků).' : null) ||
    kontrolaVolby_(d['Pro koho'], PR_PRO, 'Pro koho') ||
    (!String(d['Titulek'] || '').trim() ? 'Vyplňte titulek.' : null);
}

/** Uložení obsahu + krok: ulozit (stav zůstane, nový = koncept) | odeslat (ke schválení) | zverejnit. */
function prUlozit_(o, req) {
  const d = req.data || {}, krok = String(req.krok || 'ulozit'), role = prRole_(o);
  if (['ulozit', 'odeslat', 'zverejnit'].indexOf(krok) < 0) return { ok: false, chyba: 'Neznámý krok.' };
  if (krok === 'zverejnit' && role !== 'zveřejnit') return { ok: false, chyba: 'Zveřejňuje jen role Příspěvky = zveřejnit.' };
  const chyba = prKontrola_(d);
  if (chyba) return { ok: false, chyba: chyba };
  if (krok !== 'ulozit' && !prVycistitText_(d['Text'])) return { ok: false, chyba: 'Napište text příspěvku.' };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const t = prNacist_(), col = k => t.h.indexOf(k), ted = new Date();
    const i = prRadek_(t, req.id);
    if (req.id && i < 0) return { ok: false, chyba: 'Příspěvek nenalezen. Načtěte znovu.' };
    const r = i >= 0 ? t.v[i].slice() : t.h.map(() => '');
    const pred = i >= 0 ? String(r[col('Stav')]) : '', predPro = i >= 0 ? String(r[col('Pro koho')] || 'veřejnost') : '';
    if (i >= 0 && !prSmiUpravit_(o, t.obj(r))) return { ok: false, chyba: pred === 'ke schválení' ? 'Příspěvek čeká na schválení – upravit ho teď může jen ten, kdo zveřejňuje.' : 'Tento příspěvek upravit nemůžete.' };
    if (i >= 0 && req.upraveno && prIso_(r[col('Upraveno')]) && prIso_(r[col('Upraveno')]) !== req.upraveno)
      return { ok: false, kolize: true, chyba: 'Příspěvek mezitím upravil někdo jiný. Načtěte ho znovu a změny zopakujte.' };
    if (krok === 'odeslat' && i >= 0 && PR_AUTOR_UPRAVUJE.indexOf(pred) < 0) return { ok: false, chyba: 'Ke schválení jde poslat jen koncept nebo vrácený příspěvek.' };
    const set = (k, v) => { if (col(k) >= 0) r[col(k)] = v; };
    const soubory = prSoubory_(r[col('Přílohy')]);
    // odkazy na zveřejněné dokumenty: jen ty, které opravdu jsou zveřejněné (ze seznamu serveru)
    if (Array.isArray(d.dokumenty)) {
      const verejne = cistVerejne_('dokumenty', {});
      const dok = d.dokumenty.slice(0, 10).map(x => verejne.find(v => String(v['ID']) === String(x && x.id)))
        .filter(Boolean).filter((v, j, a) => a.indexOf(v) === j)
        .map(v => ({ t: 'dokument', id: String(v['ID']), n: [v['Orgán'], v['Název']].filter(Boolean).join(' – '), u: v['Veřejný odkaz'] }));
      soubory.splice(0, soubory.length, ...soubory.filter(x => x.t !== 'dokument').concat(dok));
    }
    const hlavni = String(d['Hlavní fotka – ID'] || '');
    set('Titulek', String(d['Titulek']).trim()); set('Perex', String(d['Perex'] || '').trim()); set('Text', prVycistitText_(d['Text']));
    set('Štítky', prStitky_(d['Štítky']).join(', ')); set('Pro koho', d['Pro koho'] || 'veřejnost'); set('Připnout', d['Připnout'] ? 'ANO' : 'NE');
    set('Hlavní fotka – ID', soubory.some(x => x.t === 'foto' && x.id === hlavni) ? hlavni : (soubory.find(x => x.t === 'foto') || {}).id || '');
    set('Přílohy', JSON.stringify(soubory));
    if (i < 0) {
      set('ID', 'P' + Utilities.formatDate(ted, 'Europe/Prague', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10));
      set('Autor', o.email); set('Zdroj', 'aplikace'); set('Stav', 'koncept'); set('Vytvořeno', ted); set('Vytvořil', o.email);
    }
    if (krok === 'odeslat') { set('Stav', 'ke schválení'); }
    let sdileni = '';
    if (krok === 'zverejnit') {
      set('Stav', 'zveřejněno');
      if (!r[col('Zveřejněno')]) set('Zveřejněno', ted);
      if (!r[col('Adresa')]) set('Adresa', prVolnaAdresa_(t, String(d['Titulek']), r[col('ID')]));
      set('Poznámka', '');
    }
    const stav = String(r[col('Stav')]);
    if (stav === 'zveřejněno') {
      set('Odkaz', r[col('Pro koho')] === 'všechny sbory' ? (nastaveniWeb_('WEB_URL') || '') + '/Aplikace%20OSH.dc.html' : (nastaveniWeb_('WEB_URL') || '') + '/?clanek=' + r[col('Adresa')]);
      // sdílení všech souborů jen při zveřejnění nebo změně Pro koho (nové soubory zveřejněného příspěvku sdílí prSoubor_)
      if (krok === 'zverejnit' || predPro !== String(r[col('Pro koho')])) sdileni = prSdilet_(soubory, r[col('Pro koho')]);
    }
    set('Upraveno', ted); set('Upravil', o.email);
    prZapsat_(t, i, r);
    const id = r[col('ID')], obj = t.obj(r);
    zaznamZmeny_(o.email, LIST_PRISPEVKY, id, i < 0 ? 'vytvořeno' : krok === 'zverejnit' ? 'schváleno' : 'upraveno', pred,
      (krok === 'zverejnit' ? 'zveřejněno' + (sdileni ? ', sdílení: ' + sdileni : '') : krok === 'odeslat' ? 'odesláno ke schválení' : stav === 'zveřejněno' ? 'upraveno na webu' + (sdileni ? ', sdílení: ' + sdileni : '') : 'uloženo (' + stav + ')') + ': ' + String(d['Titulek']).slice(0, 200));
    if (stav === 'zveřejněno' || pred === 'zveřejněno') prVycistitWeb_(r[col('Adresa')]);
    if (krok === 'odeslat') prUpozornitSchvalovatele_(obj, o.email);
    if (krok === 'zverejnit' && normEmail_(obj['Autor']) !== o.email) prOznamitAutorovi_(obj, 'zveřejněno');
    return { ok: true, id: id, data: prJson_(obj, o, prJmena_()) };
  } finally { lock.releaseLock(); }
}

/** Volná adresa: slug z titulku, při shodě -2, -3… */
function prVolnaAdresa_(t, titulek, id) {
  const zaklad = prSlug_(titulek), col = k => t.h.indexOf(k);
  const obsazene = t.v.filter(r => String(r[col('ID')]) !== String(id)).map(r => String(r[col('Adresa')] || ''));
  let a = zaklad, n = 2;
  while (obsazene.indexOf(a) >= 0) a = zaklad + '-' + n++;
  return a;
}

/** Vrátit k úpravě (povinná poznámka) | stáhnout z webu. Jen role zveřejnit. */
function prRozhodnout_(o, req) {
  const roz = String(req.rozhodnuti || ''), pozn = String(req.poznamka || '').trim();
  if (prRole_(o) !== 'zveřejnit') return { ok: false, chyba: 'Vracet a stahovat může jen role Příspěvky = zveřejnit.' };
  if (['vrátit', 'stáhnout'].indexOf(roz) < 0) return { ok: false, chyba: 'Neznámé rozhodnutí.' };
  if (roz === 'vrátit' && !pozn) return { ok: false, chyba: 'Napište autorovi, co má upravit.' };
  const chyba = kontrolaTextu_({ 'Poznámka': pozn }, { 'Poznámka': 2000 });
  if (chyba) return { ok: false, chyba: chyba };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const t = prNacist_(), col = k => t.h.indexOf(k), i = prRadek_(t, req.id);
    if (i < 0) return { ok: false, chyba: 'Příspěvek nenalezen. Načtěte znovu.' };
    const r = t.v[i].slice(), pred = String(r[col('Stav')]);
    if (roz === 'vrátit' && pred !== 'ke schválení') return { ok: false, chyba: 'Vrátit jde jen příspěvek, který čeká na schválení.' };
    if (roz === 'stáhnout' && pred !== 'zveřejněno') return { ok: false, chyba: 'Stáhnout jde jen zveřejněný příspěvek.' };
    let sdileni = '';
    if (roz === 'stáhnout') sdileni = prSdilet_(prSoubory_(r[col('Přílohy')]), null);
    r[col('Stav')] = roz === 'vrátit' ? 'vráceno k úpravě' : 'staženo';
    if (roz === 'vrátit' || pozn) r[col('Poznámka')] = pozn;
    r[col('Upraveno')] = new Date(); r[col('Upravil')] = o.email;
    prZapsat_(t, i, r);
    const obj = t.obj(r);
    zaznamZmeny_(o.email, LIST_PRISPEVKY, r[col('ID')], roz === 'vrátit' ? 'upraveno' : 'upraveno', pred, r[col('Stav')] + (pozn ? ': ' + pozn.slice(0, 300) : '') + (sdileni ? ' (sdílení: ' + sdileni + ')' : ''));
    if (roz === 'stáhnout') prVycistitWeb_(r[col('Adresa')]);
    if (roz === 'vrátit') prOznamitAutorovi_(obj, 'vráceno k úpravě');
    return { ok: true, data: prJson_(obj, o, prJmena_()) };
  } finally { lock.releaseLock(); }
}

/** Smazání příspěvku: role zveřejnit / Správce (ne zveřejněný – ten se nejdřív stáhne), navrhovatel jen svůj koncept.
 *  Řádek pryč, složka se soubory do koše. */
function prSmazat_(o, req) {
  const role = prRole_(o);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const t = prNacist_(), col = k => t.h.indexOf(k), i = prRadek_(t, req.id);
    if (i < 0) return { ok: false, chyba: 'Příspěvek nenalezen. Načtěte znovu.' };
    const r = t.v[i], stav = String(r[col('Stav')]), titulek = String(r[col('Titulek')] || '');
    if (role !== 'zveřejnit' && !(normEmail_(r[col('Autor')]) === o.email && stav === 'koncept'))
      return { ok: false, chyba: 'Smazat můžete jen svůj koncept, dokud ho neodešlete ke schválení.' };
    if (stav === 'zveřejněno') return { ok: false, chyba: 'Zveřejněný příspěvek nejdřív stáhněte z webu, pak ho jde smazat.' };
    if (req.upraveno && prIso_(r[col('Upraveno')]) && prIso_(r[col('Upraveno')]) !== req.upraveno)
      return { ok: false, kolize: true, chyba: 'Příspěvek mezitím někdo upravil. Načtěte ho znovu a rozhodněte znovu.' };
    let soubory = 'bez souborů';
    const slozka = String(r[col('Fotky – složka')] || '').match(/folders\/([\w-]+)/);
    if (slozka) { try { DriveApp.getFolderById(slozka[1]).setTrashed(true); soubory = 'složka se soubory v koši'; } catch (e) { soubory = 'složku nešlo smazat: ' + e.message; console.warn(e); } }
    t.sh.deleteRow(i + 2);
    zaznamZmeny_(o.email, LIST_PRISPEVKY, String(r[col('ID')]), 'smazáno', stav + ': ' + titulek.slice(0, 200) + ' (autor ' + normEmail_(r[col('Autor')]) + ')', soubory);
    prVycistitWeb_(r[col('Adresa')]);
    return { ok: true, id: String(r[col('ID')]) };
  } finally { lock.releaseLock(); }
}

/* ---------- soubory ---------- */

function prSlozka_(id, r, t) {
  const disk = DriveApp.getFolderById(nastaveniWeb_('DISK_ID'));
  const it = disk.getFoldersByName('Příspěvky'), koren = it.hasNext() ? it.next() : disk.createFolder('Příspěvky');
  const it2 = koren.getFoldersByName(id), slozka = it2.hasNext() ? it2.next() : koren.createFolder(id);
  if (r && t && !r[t.h.indexOf('Fotky – složka')]) r[t.h.indexOf('Fotky – složka')] = 'https://drive.google.com/drive/folders/' + slozka.getId();
  return slozka;
}

/** Sdílení všech fotek a příloh podle Pro koho (null = zrušit). Vrací popis pro záznam změn. */
function prSdilet_(soubory, proKoho) {
  const s = soubory.filter(x => x.t !== 'dokument' && x.id);
  if (!s.length) return '';
  let popis = '', chyb = 0;
  s.forEach(x => { try { popis = nastavitSdileni_(DriveApp.getFileById(x.id), proKoho, ''); } catch (e) { chyb++; console.error('Sdílení ' + x.id + ': ' + e.message); } });
  return (popis || 'jen OSH') + ' (' + s.length + ' souborů' + (chyb ? ', ' + chyb + ' s chybou' : '') + ')';
}

/** Jeden soubor (base64): druh foto (už zmenšená v prohlížeči) nebo priloha (PDF, DOCX, XLSX). */
function prSoubor_(o, req) {
  const druh = req.druh === 'foto' ? 'foto' : 'priloha', nazev = String(req.nazev || '').trim(), mime = String(req.mime || '');
  let bajty;
  try { bajty = Utilities.base64Decode(String(req.data || '')); } catch (e) { return { ok: false, chyba: 'Soubor se nepodařilo přečíst.' }; }
  const chyba = overitSoubor_(nazev, mime, bajty.length, druh === 'foto' ? PR_FOTO : PR_PRILOHY);
  if (chyba) return { ok: false, chyba: chyba };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const t = prNacist_(), col = k => t.h.indexOf(k), i = prRadek_(t, req.id);
    if (i < 0) return { ok: false, chyba: 'Příspěvek nenalezen. Uložte ho a zkuste znovu.' };
    const r = t.v[i].slice();
    if (!prSmiUpravit_(o, t.obj(r))) return { ok: false, chyba: 'K tomuto příspěvku nemůžete přidávat soubory.' };
    const soubory = prSoubory_(r[col('Přílohy')]);
    if (soubory.length >= PR_MAX_SOUBORU) return { ok: false, chyba: 'Příspěvek už má ' + PR_MAX_SOUBORU + ' souborů.' };
    const f = prSlozka_(String(r[col('ID')]), r, t).createFile(Utilities.newBlob(bajty, mime, nazev));
    const zaznam = { id: f.getId(), n: nazev, t: druh, m: mime };
    soubory.push(zaznam);
    r[col('Přílohy')] = JSON.stringify(soubory);
    if (druh === 'foto' && !r[col('Hlavní fotka – ID')]) r[col('Hlavní fotka – ID')] = f.getId();
    if (r[col('Stav')] === 'zveřejněno') { try { nastavitSdileni_(f, r[col('Pro koho')] || 'veřejnost', ''); } catch (e) { console.error(e); } prVycistitWeb_(r[col('Adresa')]); }
    r[col('Upraveno')] = new Date(); r[col('Upravil')] = o.email;
    prZapsat_(t, i, r);
    zaznamZmeny_(o.email, LIST_PRISPEVKY, r[col('ID')], 'upraveno', '', (druh === 'foto' ? 'fotka: ' : 'příloha: ') + nazev);
    return { ok: true, soubor: zaznam, data: prJson_(t.obj(r), o, prJmena_()) };
  } finally { lock.releaseLock(); }
}

function prSouborSmazat_(o, req) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const t = prNacist_(), col = k => t.h.indexOf(k), i = prRadek_(t, req.id);
    if (i < 0) return { ok: false, chyba: 'Příspěvek nenalezen. Načtěte znovu.' };
    const r = t.v[i].slice();
    if (!prSmiUpravit_(o, t.obj(r))) return { ok: false, chyba: 'Tento příspěvek upravit nemůžete.' };
    const soubory = prSoubory_(r[col('Přílohy')]), x = soubory.find(s => s.id === String(req.soubor) && s.t !== 'dokument');
    if (!x) return { ok: false, chyba: 'Soubor u příspěvku není.' };
    try { DriveApp.getFileById(x.id).setTrashed(true); } catch (e) { console.warn('Soubor ' + x.id + ' nešel smazat: ' + e.message); }
    const zbyle = soubory.filter(s => s !== x);
    r[col('Přílohy')] = JSON.stringify(zbyle);
    if (r[col('Hlavní fotka – ID')] === x.id) r[col('Hlavní fotka – ID')] = (zbyle.find(s => s.t === 'foto') || {}).id || '';
    r[col('Upraveno')] = new Date(); r[col('Upravil')] = o.email;
    prZapsat_(t, i, r);
    if (r[col('Stav')] === 'zveřejněno') prVycistitWeb_(r[col('Adresa')]);
    zaznamZmeny_(o.email, LIST_PRISPEVKY, r[col('ID')], 'upraveno', x.n, 'soubor odebrán');
    return { ok: true, data: prJson_(t.obj(r), o, prJmena_()) };
  } finally { lock.releaseLock(); }
}

/** Malé náhledy fotek pro editor (fotky nemusí být sdílené). */
function prNahledy_(o, req) {
  const t = prNacist_(), i = prRadek_(t, req.id);
  if (i < 0) return { ok: false, chyba: 'Příspěvek nenalezen.' };
  const r = t.obj(t.v[i]);
  if (!prSmiUpravit_(o, r) && r['Stav'] !== 'zveřejněno' && normEmail_(r['Autor']) !== o.email) return { ok: false, chyba: 'Příspěvek nevidíte.' };
  const out = {};
  prSoubory_(r['Přílohy']).filter(x => x.t === 'foto').slice(0, PR_MAX_SOUBORU).forEach(x => {
    try { const b = DriveApp.getFileById(x.id).getThumbnail(); if (b) out[x.id] = 'data:' + (b.getContentType() || 'image/png') + ';base64,' + Utilities.base64Encode(b.getBytes()); }
    catch (e) { console.warn('Náhled ' + x.id + ': ' + e.message); }
  });
  return { ok: true, nahledy: out };
}

/** Server: zmenší fotku přes náhled Disku (delší strana PR_FOTO_PX, bez EXIF/GPS). Vrací nový soubor, nebo null. */
function prZmensitFoto_(blob, slozka, nazev) {
  const tmp = slozka.createFile(blob.copyBlob().setName('_zpracovava_se_' + nazev));
  try {
    let link = '';
    for (let i = 0; i < 8 && !link; i++) {
      try { link = Drive.Files.get(tmp.getId(), { fields: 'thumbnailLink', supportsAllDrives: true }).thumbnailLink || ''; } catch (e) { console.warn(e.message); }
      if (!link) Utilities.sleep(2500);
    }
    if (!link) return null;
    const res = UrlFetchApp.fetch(link.replace(/=s\d+(-[a-z0-9-]+)?$/i, '') + '=s' + PR_FOTO_PX, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    const b = res.getResponseCode() === 200 ? res.getBlob() : null;
    if (!b || !/^image\/(jpeg|png|webp)$/.test(b.getContentType() || '')) return null;
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[b.getContentType()];
    return slozka.createFile(b.setName(String(nazev).replace(/\.[^.]+$/, '') + '.' + ext));
  } catch (e) { console.error('Zmenšení fotky: ' + e.message); return null; }
  finally { try { tmp.setTrashed(true); } catch (e) {} }
}

/* ---------- veřejný web a portál ---------- */

function prVycistitWeb_(adresa) {
  const c = CacheService.getScriptCache();
  c.removeAll(['v_prispevky', 'v_web'].concat(adresa ? ['v_cl_' + adresa] : []));
}

/** Seznam pro web (?co=web): jen zveřejněné pro veřejnost, bez textu. 5 min v mezipaměti. */
function prispevkyVerejne_() {
  const c = CacheService.getScriptCache(), z = c.get('v_prispevky');
  if (z) return JSON.parse(z);
  const sh = dataSs_().getSheetByName(LIST_PRISPEVKY);
  if (!sh) return [];
  const jmena = prJmena_();
  const data = radky_(LIST_PRISPEVKY).filter(r => r['ID'] && r['Stav'] === 'zveřejněno' && r['Adresa'] && PRO_VEREJNOST.indexOf(String(r['Pro koho'] || '').trim()) >= 0)
    .map(r => prVerejny_(r, jmena, false))
    .sort((a, b) => String(b.datum).localeCompare(String(a.datum))).slice(0, 200);
  try { c.put('v_prispevky', JSON.stringify(data), 300); } catch (e) { console.warn('Příspěvky se nevešly do mezipaměti: ' + e.message); }
  return data;
}

/** Veřejný tvar příspěvku. Autor jen jménem (z listu Uživatelé), nikdy e-mail. */
function prVerejny_(r, jmena, cely) {
  const soubory = prSoubory_(r['Přílohy']), fotky = soubory.filter(x => x.t === 'foto');
  const hl = fotky.find(x => x.id === r['Hlavní fotka – ID']) || fotky[0];
  const o = { adresa: String(r['Adresa']), titulek: String(r['Titulek'] || ''), perex: String(r['Perex'] || '') || prZkratit_(r['Text'], 220),
    datum: prIso_(r['Zveřejněno'] || r['Upraveno']), stitky: prStitky_(r['Štítky']), pripnout: ano_(r['Připnout']), foto: hl ? hl.id : '',
    autor: (jmena || {})[normEmail_(r['Autor'])] || 'OSH Praha-západ' };
  if (cely) {
    o.html = prHtml_(r['Text']);
    o.fotky = fotky.map(x => ({ id: x.id, n: x.n }));
    o.prilohy = soubory.filter(x => x.t === 'priloha').map(x => ({ id: x.id, n: x.n, typ: (PR_PRILOHY[x.m] || String(x.n).split('.').pop() || '').toUpperCase() }));
    o.dokumenty = soubory.filter(x => x.t === 'dokument').map(x => ({ n: x.n, u: x.u }));
  }
  return o;
}

/** Detail pro web (?co=clanek&a=adresa): jen zveřejněný pro veřejnost. */
function prClanekVerejny_(adresa) {
  adresa = String(adresa || '');
  if (!/^[a-z0-9-]{1,100}$/.test(adresa)) return null;
  const c = CacheService.getScriptCache(), z = c.get('v_cl_' + adresa);
  if (z) return JSON.parse(z);
  const r = radky_(LIST_PRISPEVKY).find(x => String(x['Adresa']) === adresa && x['Stav'] === 'zveřejněno' && PRO_VEREJNOST.indexOf(String(x['Pro koho'] || '').trim()) >= 0);
  if (!r) return null;
  const o = prVerejny_(r, prJmena_(), true);
  try { c.put('v_cl_' + adresa, JSON.stringify(o), 300); } catch (e) {}
  return o;
}

/** Pro portál sboru: zveřejněné pro veřejnost i „všechny sbory“ (smiVidet_), posledních 10. */
function prispevkyPortal_(u) {
  const jmena = prJmena_();
  return radky_(LIST_PRISPEVKY).filter(r => r['ID'] && r['Stav'] === 'zveřejněno' && smiVidet_(u, r))
    .map(r => {
      const o = prVerejny_(r, jmena, true), jenSbory = String(r['Pro koho'] || '').trim() === 'všechny sbory';
      o.jenSbory = jenSbory;
      o.soubory = prSoubory_(r['Přílohy']).filter(x => x.t !== 'dokument').map(x => ({ n: x.n, t: x.t, u: 'https://drive.google.com/file/d/' + x.id + '/view' }));
      return o;
    })
    .sort((a, b) => (b.pripnout - a.pripnout) || String(b.datum).localeCompare(String(a.datum))).slice(0, 10);
}

/* ---------- e-maily ---------- */

function prAppUrl_(id) { return (nastaveniWeb_('WEB_URL') || '') + '/Aplikace%20OSH.dc.html' + (id ? '#prispevek=' + id : ''); }

function prUpozornitSchvalovatele_(r, odkoho) {
  const dom = '@' + (nastaveniWeb_('DOMENA') || 'oshpz.cz');
  let komu = radkyRychle_('Uživatelé').filter(u => ano_(u['Aktivní']) && String(u['Příspěvky'] || '').trim() === 'zveřejnit').map(u => normEmail_(u['E-mail']));
  if (!komu.length) komu = ['spravci' + dom];
  const predmet = 'Příspěvek ke schválení: ' + r['Titulek'];
  const pol = [['Titulek', r['Titulek']], ['Perex', r['Perex'] || prZkratit_(r['Text'], 300)], ['Autor', (prJmena_()[normEmail_(r['Autor'])] || '') + ' ' + normEmail_(r['Autor'])],
    ['Pro koho', r['Pro koho'] || 'veřejnost'], ['Zdroj', r['Zdroj'] === 'e-mail' ? 'e-mail' : 'aplikace'], ['Soubory', String(prSoubory_(r['Přílohy']).filter(x => x.t !== 'dokument').length)]];
  const uvod = (r['Zdroj'] === 'e-mail' ? 'Přišel příspěvek e-mailem od ' : 'Příspěvek poslal(a) ke schválení ') + normEmail_(odkoho) + '. Zkontrolujte ho a zveřejněte, nebo vraťte k úpravě.';
  const url = prAppUrl_(r['ID']);
  const html = sablona_(predmet, uvod, pol, ['Otevřít příspěvek', url], 'Automatická zpráva aplikace OSH Praha-západ.');
  komu.forEach(e => { try { posta_(e, predmet, uvod + '\n\n' + pol.map(p => p[0] + ': ' + p[1]).join('\n') + '\n\n' + url, html); } catch (x) { console.error(x); } });
}

function prOznamitAutorovi_(r, stav) {
  const komu = normEmail_(r['Autor']);
  if (!komu) return;
  const zverejneno = stav === 'zveřejněno';
  const predmet = (zverejneno ? 'Příspěvek zveřejněn: ' : 'Příspěvek vrácen k úpravě: ') + r['Titulek'];
  const uvod = zverejneno ? (String(r['Pro koho']) === 'všechny sbory' ? 'Váš příspěvek je zveřejněný v portálu sborů.' : 'Váš příspěvek je zveřejněný na webu.')
    : 'Příspěvek se vrátil k úpravě. Upravte ho v aplikaci a pošlete znovu ke schválení.';
  const pol = [['Titulek', r['Titulek']], ['Poznámka', zverejneno ? '' : r['Poznámka']]];
  const url = zverejneno ? String(r['Odkaz'] || '') : prAppUrl_(r['ID']);
  const html = sablona_(predmet, uvod, pol, [zverejneno ? 'Zobrazit příspěvek' : 'Upravit příspěvek', url], 'Automatická zpráva aplikace OSH Praha-západ.');
  try { posta_(komu, predmet, uvod + '\n\n' + pol.filter(p => p[1]).map(p => p[0] + ': ' + p[1]).join('\n') + '\n\n' + url, html); } catch (x) { console.error(x); }
}

/* ---------- příspěvek e-mailem ---------- */

/** Časovač každých 10 min. Zpracuje e-maily na PRISPEVKY_EMAIL za posledních 14 dní (i přečtené), které ještě nemají štítek OSH-prispevky/… (adresa musí být aliasem účtu, pod kterým skript běží). */
function prijmoutPrispevkyEmailem() {
  const adresa = normEmail_(nastaveniWeb_('PRISPEVKY_EMAIL'));
  if (!adresa) { console.log('PRISPEVKY_EMAIL v listu Nastavení není vyplněné – příspěvky e-mailem jsou vypnuté (spusťte zalozitStrukturu).'); return 0; }
  const c = CacheService.getScriptCache();
  if (c.get('pr_mail_bezi')) { console.log('Předchozí běh ještě neskončil.'); return 0; }
  c.put('pr_mail_bezi', '1', 540);
  let n = 0;
  try {
    const st = {}; Object.keys(PR_STITKY_MAIL).forEach(k => { st[k] = GmailApp.getUserLabelByName(PR_STITKY_MAIL[k]) || GmailApp.createLabel(PR_STITKY_MAIL[k]); });
    const vylouceni = Object.keys(PR_STITKY_MAIL).map(k => '-label:' + PR_STITKY_MAIL[k].toLowerCase().replace(/[\s\/]+/g, '-')).join(' ');
    // každý e-mail za PR_MAIL_DNY bez štítku OSH-prispevky/… (i přečtený) – zpracované pozná skript podle štítku; po 10 vláknech na běh, nejnovější první
    const dotaz = '(to:' + adresa + ' OR deliveredto:' + adresa + ') newer_than:' + PR_MAIL_DNY + 'd ' + vylouceni;
    const vlakna = GmailApp.search(dotaz, 0, 10);
    console.log('Schránka ' + Session.getEffectiveUser().getEmail() + ', hledání „' + dotaz + '“: ' + vlakna.length + ' vláken.');
    // Každá zpráva jen jednou: ID zpracovaných zpráv jsou ve Vlastnostech skriptu (prm_…, maže noční údržba po 60 dnech).
    // Štítek je u celé konverzace – nová zpráva se stejným předmětem by jinak znovu otevřela i starou (třeba dřív nepovolenou).
    const p = PropertiesService.getScriptProperties(), od = Date.now() - PR_MAIL_DNY * 864e5;
    const proNas = m => [m.getTo(), m.getCc(), m.getHeader('Delivered-To')].join(',').toLowerCase().indexOf(adresa) >= 0;
    vlakna.forEach(v => {
      v.getMessages().forEach(m => {
        const klic = 'prm_' + m.getId();
        if (p.getProperty(klic) || m.getDate().getTime() < od || !proNas(m)) return;
        p.setProperty(klic, String(Date.now())); // zapsat předem – ani po chybě uprostřed se zpráva nezpracuje podruhé
        const vysledek = prZEmailu_(m, adresa);
        console.log('E-mail „' + m.getSubject() + '“ od ' + m.getFrom() + ': ' + vysledek);
        if (vysledek === 'nepovoleno') { v.addLabel(st.nepovoleno); return; } // zůstane nepřečtený, jen se označí
        m.markRead();
        v.addLabel(vysledek === 'chyba' ? st.chyba : st.zpracovano);
        if (vysledek === 'ok') n++;
      });
    });
  } finally { c.remove('pr_mail_bezi'); }
  if (n) console.log('Příspěvků z e-mailu: ' + n);
  return n;
}

/** Jeden e-mail → příspěvek ke schválení. Vrací 'ok' | 'nepovoleno' | 'chyba'. */
function prZEmailu_(m, adresa) {
  const od = normEmail_((String(m.getFrom()).match(/<([^>]+)>/) || [])[1] || m.getFrom());
  const o = od && od !== adresa ? opravneni_(od) : null;
  const auth = String(m.getHeader('Authentication-Results') || '');
  if (!o || !prRole_(o) || /dmarc=fail/i.test(auth)) {
    try { zaznamZmeny_('aplikace', LIST_PRISPEVKY, '', 'zamítnuto', '', 'e-mail od ' + (od || '?') + ' nezpracován (není aktivní uživatel s rolí Příspěvky' + (/dmarc=fail/i.test(auth) ? ' nebo neprošel ověřením odesílatele' : '') + ')'); } catch (e) {}
    return 'nepovoleno';
  }
  try {
    const titulek = String(m.getSubject() || '').replace(/^\s*((re|fw|fwd|tr|vs|odp)\s*:\s*)+/i, '').trim().slice(0, 200) || 'Příspěvek bez titulku';
    let text = String(m.getPlainBody() || '').replace(/\r\n?/g, '\n');
    text = text.split(/\n-- ?\n/)[0]                                   // podpis
      .replace(/\n+On .{0,200} wrote:\n[\s\S]*$|\n+Dne .{0,200} napsal\(a\):\n[\s\S]*$/, '') // citace předchozí zprávy
      .split('\n').filter(r => !/^>/.test(r)).join('\n')
      .replace(/<(https?:\/\/[^>\s]+)>/g, ' $1');
    text = prVycistitText_(text).slice(0, PR_TEXT_MAX);
    const lock = LockService.getScriptLock(); lock.waitLock(30000);
    let t, r, id;
    try {
      t = prNacist_(); const col = k => t.h.indexOf(k), ted = new Date();
      r = t.h.map(() => '');
      id = 'P' + Utilities.formatDate(ted, 'Europe/Prague', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
      const set = (k, v) => { if (col(k) >= 0) r[col(k)] = v; };
      set('ID', id); set('Titulek', titulek.replace(/<[^>]*>/g, '').trim() || 'Příspěvek bez titulku');
      set('Text', text); set('Autor', od); set('Zdroj', 'e-mail'); set('Stav', 'ke schválení'); set('Pro koho', 'veřejnost'); set('Připnout', 'NE');
      set('Přílohy', '[]'); set('Vytvořeno', ted); set('Vytvořil', od); set('Upraveno', ted); set('Upravil', od);
      prZapsat_(t, -1, r);
    } finally { lock.releaseLock(); }
    // soubory mimo zámek (zmenšování fotek trvá)
    const slozka = prSlozka_(id), soubory = [], preskoceno = [];
    m.getAttachments({ includeInlineImages: true, includeAttachments: true }).slice(0, PR_MAX_SOUBORU).forEach(a => {
      const nazev = String(a.getName() || 'soubor').replace(/[\/\\<>:"|?*\x00-\x1f]/g, '_').slice(0, 150), mime = String(a.getContentType() || '').split(';')[0].toLowerCase(), vel = a.getSize();
      if (/^image\//.test(mime)) {
        if (vel < 15 * 1024) return;                     // ikony a loga z podpisu
        if (vel > 30 * 1048576) { preskoceno.push(nazev + ' (fotka větší než 30 MB)'); return; }
        const f = prZmensitFoto_(a.copyBlob(), slozka, nazev);
        if (!f) { preskoceno.push(nazev + ' (fotku se nepodařilo zmenšit – nahrajte ji v aplikaci)'); return; }
        soubory.push({ id: f.getId(), n: f.getName(), t: 'foto', m: f.getMimeType() });
      } else if (PR_PRILOHY[mime] && !overitSoubor_(nazev, mime, vel, PR_PRILOHY)) {
        const f = slozka.createFile(a.copyBlob().setName(nazev));
        soubory.push({ id: f.getId(), n: nazev, t: 'priloha', m: mime });
      } else preskoceno.push(nazev + ' (nepovolený typ nebo větší než ' + SOUBOR_MAX_MB + ' MB)');
    });
    const lock2 = LockService.getScriptLock(); lock2.waitLock(30000);
    try {
      t = prNacist_(); const col = k => t.h.indexOf(k), i = prRadek_(t, id);
      if (i >= 0) {
        const r2 = t.v[i].slice();
        r2[col('Přílohy')] = JSON.stringify(soubory); r2[col('Hlavní fotka – ID')] = (soubory.find(x => x.t === 'foto') || {}).id || '';
        r2[col('Fotky – složka')] = 'https://drive.google.com/drive/folders/' + slozka.getId();
        prZapsat_(t, i, r2); r = r2;
      }
    } finally { lock2.releaseLock(); }
    const obj = t.obj(r);
    zaznamZmeny_(od, LIST_PRISPEVKY, id, 'vytvořeno', '', 'e-mailem: ' + titulek + ' (' + soubory.length + ' souborů' + (preskoceno.length ? ', přeskočeno ' + preskoceno.length : '') + ')');
    prUpozornitSchvalovatele_(obj, od);
    const pol = [['Titulek', titulek], ['Fotky', String(soubory.filter(x => x.t === 'foto').length)], ['Přílohy', String(soubory.filter(x => x.t === 'priloha').length)], ['Nepřevzato', preskoceno.join('\n')]];
    const uvod = 'Děkujeme, příspěvek jsme přijali a čeká na schválení. Po zveřejnění vám přijde další e-mail. Upravit ho můžete po vrácení k úpravě v aplikaci.';
    posta_(od, 'Příspěvek přijat: ' + titulek, uvod + '\n\n' + pol.filter(p => p[1] && p[1] !== '0').map(p => p[0] + ': ' + p[1]).join('\n') + '\n\n' + prAppUrl_(id),
      sablona_('Příspěvek přijat: ' + titulek, uvod, pol.filter(p => p[1] !== '0'), ['Otevřít aplikaci', prAppUrl_(id)], 'Automatická zpráva aplikace OSH Praha-západ.'));
    return 'ok';
  } catch (e) {
    console.error('Příspěvek z e-mailu od ' + od + ': ' + e.message);
    try { zaznamZmeny_('aplikace', LIST_PRISPEVKY, '', 'zamítnuto', '', 'CHYBA zpracování e-mailu od ' + od + ': ' + e.message); } catch (x) {}
    return 'chyba';
  }
}

/* ---------- test (režim TEST) ---------- */

/** Jeden zveřejněný příspěvek se dvěma fotkami (zmenší server) a jeden ke schválení. Podruhé nic nepřidá. */
function vlozitTestyPrispevku() {
  const ss = SpreadsheetApp.getActive(), ja = Session.getActiveUser().getEmail(), ted = new Date();
  const t = prNacist_(), col = k => t.h.indexOf(k), ids = t.v.map(r => String(r[col('ID')]));
  const web = nastaveniWeb_('WEB_URL') || 'https://test.oshpz.cz';
  const testy = [
    { 'ID': 'P-TEST1', 'Titulek': 'TEST: Okresní kolo hry Plamen – poděkování pořadatelům', 'Perex': 'Testovací zveřejněný příspěvek se dvěma fotkami. Po testu ho stáhněte.',
      'Text': 'Děkujeme všem **pořadatelům a rozhodčím** za skvělou organizaci.\n\nVýsledky:\n- přípravka: SDH Zahořany\n- mladší: SDH Sloup\n\nPropozice dalšího ročníku najdete na [webu okresu](' + web + ').',
      'Štítky': 'MH, soutěže', 'Pro koho': 'veřejnost', 'Připnout': 'ANO', 'Stav': 'zveřejněno', 'Zveřejněno': ted, 'Adresa': 'test-okresni-kolo-hry-plamen', 'fotky': true },
    { 'ID': 'P-TEST2', 'Titulek': 'TEST: Návrh – školení velitelů JSDH', 'Perex': '', 'Text': 'Testovací příspěvek ke schválení.\n\nVyzkoušejte vrácení k úpravě s poznámkou a zveřejnění.',
      'Štítky': 'okres', 'Pro koho': 'veřejnost', 'Připnout': 'NE', 'Stav': 'ke schválení' }
  ].filter(x => ids.indexOf(x['ID']) < 0);
  testy.forEach(x => {
    const r = t.h.map(k => k in x ? x[k] : '');
    r[col('Autor')] = ja; r[col('Zdroj')] = 'aplikace'; r[col('Vytvořeno')] = ted; r[col('Vytvořil')] = ja; r[col('Upraveno')] = ted; r[col('Upravil')] = ja;
    const soubory = [];
    if (x.fotky) {
      const slozka = prSlozka_(x['ID'], r, t);
      ['assets/ucty/disk-test-motiv.png', 'assets/logo-osh-docasne.png'].forEach(cesta => {
        try {
          const res = UrlFetchApp.fetch(web + '/' + cesta, { muteHttpExceptions: true });
          if (res.getResponseCode() !== 200) return;
          const f = prZmensitFoto_(res.getBlob(), slozka, cesta.split('/').pop());
          if (f) soubory.push({ id: f.getId(), n: f.getName(), t: 'foto', m: f.getMimeType() });
        } catch (e) { console.error(e); }
      });
      r[col('Hlavní fotka – ID')] = (soubory[0] || {}).id || '';
      r[col('Odkaz')] = web + '/?clanek=' + x['Adresa'];
      prSdilet_(soubory, 'veřejnost');
    }
    r[col('Přílohy')] = JSON.stringify(soubory);
    prZapsat_(t, -1, r);
    zaznamZmeny_(ja, LIST_PRISPEVKY, x['ID'], 'vytvořeno', '', 'test: ' + x['Titulek'] + (x.fotky ? ' (' + soubory.length + ' fotek)' : ''));
  });
  prVycistitWeb_('test-okresni-kolo-hry-plamen');
  ss.toast(testy.length ? 'Přidány testovací příspěvky (P-TEST1 zveřejněný, P-TEST2 ke schválení).' : 'Testovací příspěvky už v tabulce jsou.', 'Příspěvky', 8);
}

/** Diagnostika: spusťte ručně, když se e-mail na PRISPEVKY_EMAIL nezpracuje. Vypíše, jak Gmail e-maily vidí (adresát, štítky). */
function diagnostikaPrispevkuEmailem() {
  const adresa = normEmail_(nastaveniWeb_('PRISPEVKY_EMAIL')), mistni = adresa.split('@')[0];
  console.log('Účet skriptu: ' + Session.getEffectiveUser().getEmail() + ' | PRISPEVKY_EMAIL: ' + (adresa || '(prázdné)'));
  ['to:' + adresa, 'deliveredto:' + adresa, 'to:' + mistni, mistni + ' newer_than:14d', 'in:anywhere newer_than:1d has:attachment'].forEach(q => {
    const v = GmailApp.search(q, 0, 5);
    console.log('Hledání „' + q + '“: ' + v.length + ' vláken');
    v.slice(0, 3).forEach(t => { const m = t.getMessages()[0];
      console.log('  „' + m.getSubject() + '“ | od ' + m.getFrom() + ' | komu ' + m.getTo() + ' | kopie ' + m.getCc() + ' | Delivered-To ' + m.getHeader('Delivered-To') +
        ' | X-Original-To ' + m.getHeader('X-Original-To') + ' | štítky ' + t.getLabels().map(l => l.getName()).join(', ') + ' | složka ' + (t.isInInbox() ? 'doručená' : t.isInSpam() ? 'spam' : 'jinde')); });
  });
}
