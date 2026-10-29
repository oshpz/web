/**
 * OSH data – B19 Hlasování VV ve Spojce: hlasování per rollam a podklady pro zasedání VV s úplnou historií.
 *
 * Role (sloupec VV v listu Uživatelé, kontrola jen tady na serveru):
 *   VV = ANO          člen VV – vidí sekci VV, hlasuje, přidává připomínky, smí založit jednání (pak je jeho navrhovatel).
 *   VV = zapisovatel  stálý zapisovatel (např. kancelář) – člen VV, navíc smí spravovat kterékoli jednání.
 *   Správce           vidí a spravuje jako stálý zapisovatel, hlasuje jen s VV = ANO / zapisovatel.
 * Spravovat jednání (body, podklady, otevřít, stáhnout bod, uzavřít dřív, ruční výsledek zasedání) smí jeho navrhovatel,
 * zapisovatel nebo stálý zapisovatel / Správce. Ostatní členové jen hlasují a přidávají připomínky. Sbory ani jiné role nic.
 *
 * Listy: VV – Jednání, VV – Body, VV – Hlasy (změna hlasu = nový řádek s Nahrazuje – ID, nic se nepřepisuje; platí poslední
 * hlas do termínu), VV – Podklady, VV – Připomínky. Soubory ve složce VV/Jednání/<RRRRMMDD Název> na sdíleném disku bez sdílení,
 * server je posílá jen členům VV. Typ per rollam: online hlasování do termínu, uzavření časovačem (vvKazdouHodinu) nebo dřív,
 * když hlasovali všichni; výsledek podle kvóra (výchozí nadpoloviční většina všech členů VV), PDF záznam o hlasování do složky
 * jednání a kopie do Orgány OSH PZ/VV (dál běžným schválením dokumentů). Typ zasedání: podklady a body, výsledek zapíše ručně
 * zapisovatel po schůzi. Každé otevření, hlas, změna hlasu, uzavření a stažení bodu jde do Záznamu změn.
 */

const VV_L_JEDNANI = 'VV – Jednání', VV_L_BODY = 'VV – Body', VV_L_HLASY = 'VV – Hlasy', VV_L_PODKLADY = 'VV – Podklady', VV_L_PRIP = 'VV – Připomínky';
const VV_TYPY = ['per rollam', 'zasedání'];
const VV_VOLBY = ['pro', 'proti', 'zdržel se'];
const VV_ZPUSOBY = ['WhatsApp', 'telefon', 'e-mail', 'osobně']; // hlas zapsaný zapisovatelem za člena

/* ---------- role a členové ---------- */

function vvJa_(o) {
  const v = o && o.role ? o.role['VV'] : null, spr = !!(o && o.role && o.role['Správce']);
  return { clen: !!v, staly: v === 'zapisovatel' || spr, vidi: !!v || spr };
}
/** Aktivní členové VV (Uživatelé, VV = ANO / zapisovatel). */
function vvClenove_() {
  return radkyRychle_('Uživatelé').filter(u => ano_(u['Aktivní']) && u['E-mail'] && ['ANO', 'ZAPISOVATEL'].indexOf(String(u['VV'] || '').trim().toUpperCase()) >= 0)
    .map(u => ({ email: normEmail_(u['E-mail']), jmeno: String(u['Jméno'] || '').trim() || normEmail_(u['E-mail']), staly: String(u['VV']).trim().toLowerCase() === 'zapisovatel' }));
}
const vvJmeno_ = (cl, email) => { const x = cl.find(c => c.email === email); return x ? x.jmeno : email || ''; };

/* ---------- tabulky ---------- */

function vvTab_(nazev) {
  const sh = dataSs_().getSheetByName(nazev);
  if (!sh) throw new Error('Chybí list „' + nazev + '“ – správce musí v tabulce spustit OSH data → Založit / doplnit strukturu.');
  const h = hlavicka_(sh), col = k => h.indexOf(k);
  const v = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues() : [];
  return { sh, h, col, v, obj: r => h.reduce((x, k, j) => (k && (x[k] = r[j]), x), {}) };
}
function vvNoveId_(p) { return p + Utilities.formatDate(new Date(), 'Europe/Prague', 'yyMMddHHmmss') + Math.floor(Math.random() * 900 + 100); }
const vvIso_ = v => v instanceof Date && !isNaN(v) ? v.toISOString() : String(v || '');
function vvRadek_(t, hodnoty) { const r = t.h.map(() => ''); Object.keys(hodnoty).forEach(k => { if (t.col(k) >= 0) r[t.col(k)] = hodnoty[k]; }); return r; }

/* Kvórum (rozhodnutí VV 28. 10. 2026): per rollam = nadpoloviční většina všech členů VV k okamžiku otevření (sloupec Členů VV),
   zasedání = nadpoloviční většina přítomných (Přítomno z prezence); usnášeníschopné zasedání = přítomna nadpoloviční většina všech členů (jen upozornění). */
const vvVetsina_ = n => Math.floor(n / 2) + 1;
const vvHlasu_ = n => n + (n === 1 ? ' hlas' : n >= 2 && n <= 4 ? ' hlasy' : ' hlasů');
function vvKvorum_(j, clenu) {
  const n = j.clenuVV || clenu, k = { clenu: n, usnaseni: vvVetsina_(n) };
  if (j.typ === 'zasedání') return Object.assign(k, { potreba: j.pritomno ? vvVetsina_(j.pritomno) : 0, zaklad: j.pritomno, popis: 'přítomných',
    pravidlo: j.pritomno ? 'Přijato nadpoloviční většinou přítomných: potřeba ' + vvHlasu_(vvVetsina_(j.pritomno)) + ' Pro z ' + j.pritomno + ' přítomných.'
      : 'Přijato nadpoloviční většinou přítomných členů VV (počet z prezence zapíše zapisovatel). Usnášeníschopné při přítomnosti aspoň ' + vvVetsina_(n) + ' z ' + n + ' členů.' });
  return Object.assign(k, { potreba: vvVetsina_(n), zaklad: n, popis: 'členů VV', pravidlo: 'Přijato nadpoloviční většinou všech členů VV: potřeba ' + vvHlasu_(vvVetsina_(n)) + ' Pro z ' + n + ' členů VV.' });
}
/** „Přijato: 5 Pro z 9 členů VV, potřeba 5“ / „Přijato: 4 Pro z 6 přítomných, potřeba 4“ */
function vvVysledekText_(b, k) {
  if (b.vysledek !== 'přijato' && b.vysledek !== 'nepřijato') return '';
  return (b.vysledek === 'přijato' ? 'Přijato' : 'Nepřijato') + ': ' + b.pro + ' Pro z ' + k.zaklad + ' ' + k.popis + ', potřeba ' + k.potreba;
}

function vvJednaniJson_(r, cl) {
  return { id: String(r['ID']), nazev: String(r['Název'] || ''), typ: String(r['Typ'] || 'per rollam'), termin: vvIso_(r['Termín']), misto: String(r['Místo'] || ''),
    stav: String(r['Stav'] || 'koncept'), kvorum: Number(r['Kvórum']) || 0, clenuVV: Number(r['Členů VV']) || 0, pritomno: Number(r['Přítomno']) || 0, slozka: String(r['Složka podkladů – ID'] || ''), zaznam: String(r['Záznam PDF – ID'] || ''),
    poznamka: String(r['Poznámka'] || ''), navrhovatel: normEmail_(r['Navrhovatel']), zapisovatel: normEmail_(r['Zapisovatel']),
    navrhovatelJmeno: vvJmeno_(cl, normEmail_(r['Navrhovatel'])), zapisovatelJmeno: vvJmeno_(cl, normEmail_(r['Zapisovatel'])),
    otevreno: vvIso_(r['Otevřeno']), uzavreno: vvIso_(r['Uzavřeno']), pripomenuto: vvIso_(r['Připomenuto']), zruseno: String(r['Důvod zrušení'] || '') };
}
function vvBodJson_(r) {
  return { id: String(r['ID']), jednani: String(r['Jednání – ID']), poradi: Number(r['Pořadí']) || 0, nazev: String(r['Název'] || ''), text: String(r['Text usnesení'] || ''),
    vysledek: String(r['Výsledek'] || ''), pro: r['Pro'] === '' ? null : Number(r['Pro']), proti: r['Proti'] === '' ? null : Number(r['Proti']), zdrzel: r['Zdržel se'] === '' ? null : Number(r['Zdržel se']),
    duvod: String(r['Staženo – důvod'] || '') };
}
/** Platné hlasy jednání: poslední hlas každého člena u každého bodu (řádek, který nikdo nenahrazuje). { bodId: { email: { volba, cas, id } } } */
function vvPlatneHlasy_(jid) {
  const t = vvTab_(VV_L_HLASY), c = t.col, nahrazene = {}, out = {};
  const moje = t.v.filter(r => String(r[c('Jednání – ID')]) === jid && ano_(r[c('Platný')]));
  moje.forEach(r => { if (r[c('Nahrazuje – ID')]) nahrazene[String(r[c('Nahrazuje – ID')])] = true; });
  moje.forEach(r => { const id = String(r[c('ID')]); if (nahrazene[id]) return; const b = String(r[c('Bod – ID')]), e = normEmail_(r[c('E-mail')]);
    (out[b] = out[b] || {})[e] = { volba: String(r[c('Volba')]), cas: vvIso_(r[c('Čas')]), id: id, zapsal: c('Zapsal') >= 0 ? normEmail_(r[c('Zapsal')]) : '', zpusob: c('Způsob') >= 0 ? String(r[c('Způsob')] || '') : '' }; });
  return out;
}
function vvNacist_(jid) {
  const tj = vvTab_(VV_L_JEDNANI), i = tj.v.findIndex(r => String(r[tj.col('ID')]) === jid);
  return i < 0 ? null : { t: tj, r: tj.v[i], n: i + 2 };
}
function vvBody_(jid) { const t = vvTab_(VV_L_BODY); return t.v.filter(r => String(r[t.col('Jednání – ID')]) === jid).map(r => vvBodJson_(t.obj(r))).sort((a, b) => a.poradi - b.poradi); }
const vvMuzeSpravovat_ = (ja, o, j) => ja.staly || (ja.clen && (j.navrhovatel === o.email || j.zapisovatel === o.email));
const vvVidiJednani_ = (ja, o, j) => j.stav !== 'koncept' || vvMuzeSpravovat_(ja, o, j);
/** Kolik bodů ještě čeká na můj hlas (per rollam, otevřeno). */
function vvMojeCeka_(j, body, hlasy, email) {
  if (j.typ !== 'per rollam' || j.stav !== 'otevřeno') return 0;
  return body.filter(b => b.vysledek !== 'staženo' && !((hlasy[b.id] || {})[email])).length;
}

/* ---------- API ---------- */

function apiVV_(req) {
  const o = prihlaseny_(req.token);
  if (!o) return { ok: false, chyba: 'Nepřihlášen', odhlasen: true };
  const ja = vvJa_(o);
  if (!ja.vidi) return { ok: false, chyba: 'Sekce VV je jen pro členy výkonného výboru.' };
  const a = req.akce;
  if (a === 'vvSeznam') return vvSeznam_(o, ja);
  if (a === 'vvUlozit') return vvUlozit_(o, ja, req);
  const x = vvNacist_(String(req.id || ''));
  if (!x) return { ok: false, chyba: 'Jednání nenalezeno.' };
  const cl = vvClenove_(), j = vvJednaniJson_(x.t.obj(x.r), cl);
  if (!vvVidiJednani_(ja, o, j)) return { ok: false, chyba: 'Jednání nenalezeno.' };
  if (a === 'vvDetail') return vvDetail_(o, ja, j);
  if (a === 'vvPodkladSoubor') return vvPodkladSoubor_(j, req);
  if (a === 'vvHlasovat') return vvHlasovat_(o, ja, x, j, req);
  if (a === 'vvPripominka') return vvPripominka_(o, ja, j, req);
  if (!vvMuzeSpravovat_(ja, o, j)) return { ok: false, chyba: 'Toto jednání spravuje jeho navrhovatel a zapisovatel.' };
  if (a === 'vvOtevrit') return vvOtevrit_(o, ja, x, j);
  if (a === 'vvPodklad') return vvPodklad_(o, ja, x, j, req);
  if (a === 'vvStahnoutBod') return vvStahnoutBod_(o, ja, j, req);
  if (a === 'vvUzavrit') { if (j.typ !== 'per rollam' || j.stav !== 'otevřeno') return { ok: false, chyba: 'Uzavřít jde jen otevřené hlasování per rollam.' }; vvUzavritInterni_(j.id, o.email, {}); return vvDetail_(o, ja, vvJednaniJson_(vvNacist_(j.id).t.obj(vvNacist_(j.id).r), cl)); }
  if (a === 'vvVysledekZasedani') return vvVysledekZasedani_(o, ja, x, j, req);
  if (a === 'vvPripomenout') { if (j.typ !== 'per rollam' || j.stav !== 'otevřeno') return { ok: false, chyba: 'Připomenout jde jen otevřené hlasování.' }; const n = vvPripomenoutNehlasujicim_(j, cl); return Object.assign(vvDetail_(o, ja, j), { pripomenuto: n }); }
  if (a === 'vvZrusit') return vvZrusit_(o, ja, x, j, req);
  return { ok: false, chyba: 'Neznámá akce' };
}

function vvSeznam_(o, ja) {
  const cl = vvClenove_(), tj = vvTab_(VV_L_JEDNANI), tb = vvTab_(VV_L_BODY), th = vvTab_(VV_L_HLASY);
  const body = {}; tb.v.forEach(r => { const b = vvBodJson_(tb.obj(r)); (body[b.jednani] = body[b.jednani] || []).push(b); });
  const hlasujici = {}, moje = {}; // jednání → set e-mailů, které hlasovaly
  th.v.forEach(r => { if (!ano_(r[th.col('Platný')])) return; const jid = String(r[th.col('Jednání – ID')]), e = normEmail_(r[th.col('E-mail')]);
    (hlasujici[jid] = hlasujici[jid] || {})[e] = true; if (e === o.email) (moje[jid] = moje[jid] || {})[String(r[th.col('Bod – ID')])] = true; });
  const data = tj.v.filter(r => r[tj.col('ID')]).map(r => vvJednaniJson_(tj.obj(r), cl)).filter(j => vvVidiJednani_(ja, o, j)).map(j => {
    const bb = (body[j.id] || []), akt = bb.filter(b => b.vysledek !== 'staženo');
    const ceka = j.typ === 'per rollam' && j.stav === 'otevřeno' && ja.clen ? akt.filter(b => !(moje[j.id] || {})[b.id]).length : 0;
    return Object.assign(j, { bodu: bb.length, hlasovalo: Object.keys(hlasujici[j.id] || {}).length, mojeCeka: ceka, hlasovalJsem: ja.clen && j.typ === 'per rollam' && akt.length > 0 && !ceka && !!moje[j.id],
      muzeSpravovat: vvMuzeSpravovat_(ja, o, j), hledat: (j.nazev + ' ' + bb.map(b => b.nazev + ' ' + b.text).join(' ')).toLowerCase() });
  }).sort((a, b) => String(b.termin).localeCompare(String(a.termin)));
  return { ok: true, data: data, clenove: cl.map(c => ({ email: c.email, jmeno: c.jmeno, staly: c.staly })), ja: { email: o.email, clen: ja.clen, staly: ja.staly } };
}

function vvDetail_(o, ja, j) {
  const cl = vvClenove_(), body = vvBody_(j.id), hlasy = vvPlatneHlasy_(j.id), uzavreno = j.stav === 'uzavřeno';
  const tp = vvTab_(VV_L_PODKLADY), tr = vvTab_(VV_L_PRIP);
  const podklady = tp.v.filter(r => String(r[tp.col('Jednání – ID')]) === j.id).map(r => tp.obj(r)).map(r => ({ id: String(r['ID']), typ: String(r['Typ'] || 'soubor'), nazev: String(r['Název'] || ''),
    url: String(r['Typ']) === 'odkaz' ? String(r['URL'] || '') : '', pridal: vvJmeno_(cl, normEmail_(r['Přidal'])), kdy: vvIso_(r['Kdy']) }));
  const pripominky = tr.v.filter(r => String(r[tr.col('Jednání – ID')]) === j.id).map(r => tr.obj(r)).map(r => ({ id: String(r['ID']), bod: String(r['Bod – ID'] || ''), jmeno: String(r['Jméno'] || ''), text: String(r['Text'] || ''), kdy: vvIso_(r['Kdy']) }));
  const hlasujici = {}; Object.keys(hlasy).forEach(b => Object.keys(hlasy[b]).forEach(e => { hlasujici[e] = true; }));
  const kv = vvKvorum_(j, cl.length);
  const muj = b => (hlasy[b.id] || {})[o.email] || {};
  const b2 = body.map(b => Object.assign(b, { mujHlas: muj(b).volba || '', mujZapsal: muj(b).zapsal && muj(b).zapsal !== o.email ? vvJmeno_(cl, muj(b).zapsal) + (muj(b).zpusob ? ' (' + muj(b).zpusob + ')' : '') : '',
    hlasovalo: Object.keys(hlasy[b.id] || {}).length, vysledekText: vvVysledekText_(b, kv) }));
  const akt = body.filter(b => b.vysledek !== 'staženo'), spravuje = vvMuzeSpravovat_(ja, o, j);
  // zapisovatel vidí, kdo už hlasoval (ne jak) – pro zápis hlasů z WhatsAppu a telefonu
  const hlasovali = spravuje && j.typ === 'per rollam' && j.stav === 'otevřeno' ? cl.map(c => ({ email: c.email, jmeno: c.jmeno, bodu: akt.filter(b => (hlasy[b.id] || {})[c.email]).length, z: akt.length })) : [];
  // kdo jak hlasoval: jen po uzavření (vidí jen členové VV a správci)
  const tabulka = uzavreno && j.typ === 'per rollam' ? cl.map(c => ({ jmeno: c.jmeno, volby: body.map(b => { if (b.vysledek === 'staženo') return 'staženo'; const h = (hlasy[b.id] || {})[c.email];
    return h ? h.volba + (h.zapsal && h.zapsal !== c.email ? ' (' + (h.zpusob || 'zapsal zapisovatel') + ')' : '') : 'nehlasoval/a'; }) })) : [];
  return { ok: true, data: Object.assign(j, { clenu: cl.length, hlasovalo: Object.keys(hlasujici).length, muzeSpravovat: spravuje, hlasovali: hlasovali, zpusoby: VV_ZPUSOBY, muzeHlasovat: ja.clen && j.typ === 'per rollam' && j.stav === 'otevřeno' && new Date(j.termin) > new Date(),
    kv: kv }), body: b2, podklady: podklady, pripominky: pripominky, tabulka: tabulka,
    clenove: cl.map(c => ({ email: c.email, jmeno: c.jmeno })), ja: { email: o.email, clen: ja.clen, staly: ja.staly } };
}

/** Založení / úprava konceptu: data = { nazev, typ, termin (ISO), misto, poznamka, zapisovatel, body: [{ id?, nazev, text }] }. Kvórum se počítá samo (vvKvorum_). */
function vvUlozit_(o, ja, req) {
  const d = req.data || {}, id = String(req.id || '');
  if (!ja.clen && !ja.staly) return { ok: false, chyba: 'Jednání zakládají členové VV.' };
  const body = Array.isArray(d.body) ? d.body : [];
  const chyba = kontrolaTextu_({ 'Název': d.nazev, 'Místo': d.misto, 'Poznámka': d.poznamka }, { 'Název': 200, 'Místo': 200, 'Poznámka': 2000 }) || kontrolaVolby_(d.typ, VV_TYPY, 'Typ') ||
    (body.length > 30 ? 'Nejvýš 30 bodů.' : null) || body.map((b, i) => kontrolaTextu_({ 'Název bodu': b.nazev, 'Text usnesení': b.text }, { 'Název bodu': 200, 'Text usnesení': 5000 })).find(Boolean);
  if (chyba) return { ok: false, chyba: chyba };
  if (!String(d.nazev || '').trim()) return { ok: false, chyba: 'Vyplňte název.' };
  if (!d.termin || isNaN(new Date(d.termin))) return { ok: false, chyba: d.typ === 'zasedání' ? 'Vyplňte datum zasedání.' : 'Vyplňte termín hlasování.' };
  const cl = vvClenove_(), zap = normEmail_(d.zapisovatel);
  if (zap && !cl.some(c => c.email === zap)) return { ok: false, chyba: 'Zapisovatel musí být člen VV.' };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const ted = new Date(), tj = vvTab_(VV_L_JEDNANI), c = tj.col;
    let x = id ? vvNacist_(id) : null;
    if (id && !x) return { ok: false, chyba: 'Jednání nenalezeno.' };
    if (x) { const j = vvJednaniJson_(tj.obj(x.r), cl); if (!vvMuzeSpravovat_(ja, o, j)) return { ok: false, chyba: 'Toto jednání spravuje jeho navrhovatel a zapisovatel.' };
      if (j.stav !== 'koncept') return { ok: false, chyba: 'Po otevření se body ani text nemění – jde jen stáhnout bod s důvodem.' }; }
    const hod = { 'Název': bezVzorce_(String(d.nazev).trim()), 'Typ': d.typ || 'per rollam', 'Termín': new Date(d.termin), 'Místo': bezVzorce_(String(d.misto || '').trim()),
      'Poznámka': bezVzorce_(String(d.poznamka || '')), 'Zapisovatel': zap || (x ? x.r[c('Zapisovatel')] || o.email : o.email), 'Upraveno': ted, 'Upravil': o.email };
    let jid;
    if (x) { Object.keys(hod).forEach(k => { if (c(k) >= 0) x.r[c(k)] = hod[k]; }); tj.sh.getRange(x.n, 1, 1, tj.h.length).setValues([x.r]); jid = String(x.r[c('ID')]); }
    else { jid = vvNoveId_('VVJ'); tj.sh.appendRow(vvRadek_(tj, Object.assign({ 'ID': jid, 'Stav': 'koncept', 'Navrhovatel': o.email, 'Vytvořeno': ted, 'Vytvořil': o.email }, hod))); }
    // body konceptu: smazat staré a zapsat nové v pořadí (jen koncept – po otevření se nemění)
    const tb = vvTab_(VV_L_BODY);
    for (let i = tb.v.length - 1; i >= 0; i--) if (String(tb.v[i][tb.col('Jednání – ID')]) === jid) tb.sh.deleteRow(i + 2);
    const nove = body.filter(b => String(b.nazev || '').trim() || String(b.text || '').trim()).map((b, i) => vvRadek_(tb, { 'ID': /^VVB[\w-]+$/.test(String(b.id || '')) ? String(b.id) : vvNoveId_('VVB') + i, 'Jednání – ID': jid, 'Pořadí': i + 1,
      'Název': bezVzorce_(String(b.nazev || '').trim() || 'Bod ' + (i + 1)), 'Text usnesení': bezVzorce_(String(b.text || '').trim()) }));
    if (nove.length) tb.sh.getRange(tb.sh.getLastRow() + 1, 1, nove.length, tb.h.length).setValues(nove);
    zaznamZmeny_(o.email, VV_L_JEDNANI, jid, x ? 'upraveno' : 'vytvořeno', '', hod['Typ'] + ' · ' + hod['Název'] + ' · bodů ' + nove.length);
    const n = vvNacist_(jid);
    return vvDetail_(o, ja, vvJednaniJson_(n.t.obj(n.r), cl));
  } finally { lock.releaseLock(); }
}

/** Složka jednání VV/Jednání/<RRRRMMDD Název> na sdíleném disku (bez sdílení). */
function vvSlozka_(x, j) {
  const c = x.t.col;
  if (j.slozka) { try { return DriveApp.getFolderById(j.slozka); } catch (e) { console.warn('Složka jednání: ' + e.message); } }
  const disk = DriveApp.getFolderById(nastaveniWeb_('DISK_ID')), dite = (r, n) => { const it = r.getFoldersByName(n); return it.hasNext() ? it.next() : r.createFolder(n); };
  const nazev = Utilities.formatDate(new Date(j.termin), 'Europe/Prague', 'yyyyMMdd') + ' ' + j.nazev.replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 100);
  const sl = dite(dite(dite(disk, 'VV'), 'Jednání'), nazev);
  x.t.sh.getRange(x.n, c('Složka podkladů – ID') + 1).setValue(sl.getId()); j.slozka = sl.getId();
  return sl;
}

function vvOtevrit_(o, ja, x, j) {
  if (j.stav !== 'koncept') return { ok: false, chyba: 'Otevřít jde jen koncept.' };
  const body = vvBody_(j.id), cl = vvClenove_();
  if (!body.length) return { ok: false, chyba: 'Přidejte aspoň jeden bod.' };
  if (j.typ === 'per rollam' && new Date(j.termin) <= new Date(Date.now() + 3600e3)) return { ok: false, chyba: 'Termín hlasování musí být aspoň hodinu od teď.' };
  if (!cl.length) return { ok: false, chyba: 'V listu Uživatelé není žádný člen VV (sloupec VV).' };
  const c = x.t.col, ted = new Date();
  x.r[c('Stav')] = 'otevřeno'; x.r[c('Otevřeno')] = ted;
  if (c('Členů VV') >= 0) x.r[c('Členů VV')] = cl.length; // počet k okamžiku otevření – zpětně se nemění
  x.r[c('Kvórum')] = j.typ === 'per rollam' ? vvVetsina_(cl.length) : ''; // zasedání: až z počtu přítomných
  x.r[c('Upraveno')] = ted; x.r[c('Upravil')] = o.email;
  x.t.sh.getRange(x.n, 1, 1, x.t.h.length).setValues([x.r]);
  vvSlozka_(x, j);
  zaznamZmeny_(o.email, VV_L_JEDNANI, j.id, 'upraveno', 'koncept', 'otevřeno (' + j.typ + ', členů VV ' + cl.length + (j.typ === 'per rollam' ? ', kvórum ' + x.r[c('Kvórum')] : '') + ')');
  const j2 = vvJednaniJson_(x.t.obj(x.r), cl), odkaz = vvOdkaz_(j.id);
  const pol = [['Typ', j.typ], [j.typ === 'zasedání' ? 'Zasedání' : 'Hlasujte do', vvKdy_(j2.termin)], ['Místo', j2.misto], ['Navrhuje', j2.navrhovatelJmeno], ['Zapisuje', j2.zapisovatelJmeno],
    ['Body', body.map((b, i) => (i + 1) + '. ' + b.nazev).join('\n')]];
  const uvod = j.typ === 'zasedání' ? 'K zasedání VV jsou ve Spojce připravené body a podklady.' : 'Ve Spojce je otevřené hlasování per rollam. Hlasovat můžete u každého bodu, hlas jde do termínu změnit.';
  cl.forEach(m => vvPosta_(m.email, (j.typ === 'zasedání' ? 'Zasedání VV: ' : 'Hlasování VV: ') + j.nazev, uvod, pol, ['Otevřít ve Spojce', odkaz]));
  return vvDetail_(o, ja, j2);
}

/** Hlas: hlasy = { bodId: 'pro' | 'proti' | 'zdržel se' }. Nový řádek, starý se nepřepisuje (Nahrazuje – ID). */
/** Hlas člena; za jiného člena (req.clen + req.zpusob – WhatsApp, telefon…) jen navrhovatel, zapisovatel, stálý zapisovatel nebo Správce. */
function vvHlasovat_(o, ja, x, j, req) {
  const cl0 = vvClenove_(), za = normEmail_(req.clen || ''), zaJineho = !!za && za !== o.email;
  if (zaJineho) {
    if (!vvMuzeSpravovat_(ja, o, j)) return { ok: false, chyba: 'Hlas za jiného člena zapisuje navrhovatel nebo zapisovatel jednání.' };
    if (!cl0.some(c => c.email === za)) return { ok: false, chyba: 'Hlas jde zapsat jen za člena VV.' };
    if (VV_ZPUSOBY.indexOf(String(req.zpusob || '')) < 0) return { ok: false, chyba: 'Vyberte, jak člen hlasoval (WhatsApp, telefon…).' };
  } else if (!ja.clen) return { ok: false, chyba: 'Hlasují členové VV.' };
  const volic = zaJineho ? za : o.email;
  if (j.typ !== 'per rollam' || j.stav !== 'otevřeno') return { ok: false, chyba: 'Hlasování není otevřené.' };
  if (new Date(j.termin) <= new Date()) return { ok: false, chyba: 'Termín hlasování už uplynul.' };
  const hlasy = req.hlasy || {}, klice = Object.keys(hlasy);
  if (!klice.length || klice.length > 30) return { ok: false, chyba: 'Vyberte volbu.' };
  if (klice.some(k => VV_VOLBY.indexOf(hlasy[k]) < 0)) return { ok: false, chyba: 'Neplatná volba.' };
  const cl = cl0, ja2 = cl.find(c => c.email === volic);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  let zmeneno = [];
  try {
    const body = vvBody_(j.id), platne = vvPlatneHlasy_(j.id), th = vvTab_(VV_L_HLASY), ted = new Date(), nove = [];
    for (let i = 0; i < klice.length; i++) {
      const b = body.find(y => y.id === klice[i]);
      if (!b) return { ok: false, chyba: 'Bod nenalezen.' };
      if (b.vysledek === 'staženo') return { ok: false, chyba: 'Bod „' + b.nazev + '“ byl stažen.' };
      const pred = (platne[b.id] || {})[volic];
      if (pred && pred.volba === hlasy[b.id]) continue;
      nove.push(vvRadek_(th, { 'ID': vvNoveId_('VVH') + i, 'Bod – ID': b.id, 'Jednání – ID': j.id, 'E-mail': volic, 'Jméno': ja2 ? ja2.jmeno : volic, 'Volba': hlasy[b.id], 'Čas': ted, 'Platný': 'ANO', 'Nahrazuje – ID': pred ? pred.id : '',
        'Zapsal': zaJineho ? o.email : '', 'Způsob': zaJineho ? String(req.zpusob) : 'Spojka' }));
      zmeneno.push((pred ? 'změna ' + pred.volba + ' → ' : '') + hlasy[b.id] + ' · ' + b.nazev);
    }
    if (nove.length) th.sh.getRange(th.sh.getLastRow() + 1, 1, nove.length, th.h.length).setValues(nove);
    if (nove.length) zaznamZmeny_(o.email, VV_L_HLASY, j.id, 'vytvořeno', '', (zaJineho ? 'za ' + volic + ' (' + req.zpusob + '): ' : '') + zmeneno.join('; ').slice(0, 1000));
  } finally { lock.releaseLock(); }
  if (zmeneno.length) { // potvrzení se souhrnem mých voleb
    const body = vvBody_(j.id), pl = vvPlatneHlasy_(j.id);
    vvPosta_(volic, 'Váš hlas: ' + j.nazev, (zaJineho ? vvJmeno_(cl, o.email) + ' zapsal/a do Spojky váš hlas (' + req.zpusob + '). Když nesouhlasí, změňte ho ve Spojce nebo odpovězte na tento e-mail. ' : 'Hlas je uložený. ') +
      'Do termínu ' + vvKdy_(j.termin) + ' ho jde ve Spojce změnit.',
      body.map((b, i) => [(i + 1) + '. ' + b.nazev, b.vysledek === 'staženo' ? 'staženo' : ((pl[b.id] || {})[volic] || {}).volba || 'zatím nehlasováno']), ['Otevřít ve Spojce', vvOdkaz_(j.id)]);
    // hlasovali všichni u všech bodů → uzavřít dřív
    const akt = body.filter(b => b.vysledek !== 'staženo');
    if (akt.length && cl.every(m => akt.every(b => (pl[b.id] || {})[m.email]))) vvUzavritInterni_(j.id, 'hlasovali všichni', {});
  }
  const n = vvNacist_(j.id);
  return vvDetail_(o, ja, vvJednaniJson_(n.t.obj(n.r), cl));
}

function vvPripominka_(o, ja, j, req) {
  const text = String(req.text || '').trim(), bod = String(req.bod || '');
  const ch = kontrolaTextu_({ 'Připomínka': text }, { 'Připomínka': 2000 });
  if (ch) return { ok: false, chyba: ch };
  if (!text) return { ok: false, chyba: 'Napište připomínku.' };
  if (['uzavřeno', 'zrušeno'].indexOf(j.stav) >= 0) return { ok: false, chyba: 'Jednání je ' + j.stav + ' – připomínky už nejde přidat.' }; // záznam PDF vzniká při uzavření
  const cl = vvClenove_(), t = vvTab_(VV_L_PRIP);
  t.sh.appendRow(vvRadek_(t, { 'ID': vvNoveId_('VVP'), 'Jednání – ID': j.id, 'Bod – ID': bod, 'E-mail': o.email, 'Jméno': vvJmeno_(cl, o.email), 'Text': bezVzorce_(text), 'Kdy': new Date() }));
  zaznamZmeny_(o.email, VV_L_PRIP, j.id, 'vytvořeno', '', text.slice(0, 200));
  return vvDetail_(o, ja, j);
}

/** Povolené podklady: PDF, obrázky, DOCX, XLSX (overitSoubor_). */
function vvPovolene_() {
  return Object.assign({}, SOUBORY_POVOLENE, { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx' });
}
function vvPodklad_(o, ja, x, j, req) {
  if (['uzavřeno', 'zrušeno'].indexOf(j.stav) >= 0 && !/zápis/i.test(String(req.nazev || ''))) return { ok: false, chyba: 'K uzavřenému jednání jde přidat jen zápis (název souboru musí obsahovat „Zápis“).' };
  const t = vvTab_(VV_L_PODKLADY), ted = new Date();
  if (req.typ === 'odkaz') {
    const nazev = String(req.nazev || '').trim(), url = String(req.url || '').trim();
    const ch = kontrolaTextu_({ 'Název': nazev }, { 'Název': 200 }) || kontrolaOdkazu_(url, 'Odkaz');
    if (ch) return { ok: false, chyba: ch };
    if (!url) return { ok: false, chyba: 'Vložte odkaz (https://…).' };
    t.sh.appendRow(vvRadek_(t, { 'ID': vvNoveId_('VVD'), 'Jednání – ID': j.id, 'Typ': 'odkaz', 'Název': bezVzorce_(nazev || url), 'URL': url, 'Přidal': o.email, 'Kdy': ted }));
    zaznamZmeny_(o.email, VV_L_PODKLADY, j.id, 'vytvořeno', '', 'odkaz: ' + (nazev || url));
  } else {
    const nazev = String(req.nazev || '').trim(), mime = String(req.mime || '');
    let bajty; try { bajty = Utilities.base64Decode(String(req.data || '')); } catch (e) { return { ok: false, chyba: 'Soubor se nepodařilo přečíst.' }; }
    const ch = overitSoubor_(nazev, mime, bajty.length, vvPovolene_(), bajty);
    if (ch) return { ok: false, chyba: ch };
    const f = vvSlozka_(x, j).createFile(Utilities.newBlob(bajty, mime, nazev));
    t.sh.appendRow(vvRadek_(t, { 'ID': vvNoveId_('VVD'), 'Jednání – ID': j.id, 'Typ': 'soubor', 'Název': bezVzorce_(nazev), 'Soubor – ID': f.getId(), 'Přidal': o.email, 'Kdy': ted }));
    zaznamZmeny_(o.email, VV_L_PODKLADY, j.id, 'vytvořeno', '', 'soubor: ' + nazev);
  }
  return vvDetail_(o, ja, j);
}
/** Soubor podkladu (nebo záznam o hlasování: podklad = 'zaznam') – jen členům VV a správcům, z Disku bez sdílení. */
function vvPodkladSoubor_(j, req) {
  let id = '';
  if (req.podklad === 'zaznam') id = j.zaznam;
  else { const t = vvTab_(VV_L_PODKLADY), r = t.v.find(y => String(y[t.col('ID')]) === String(req.podklad || '') && String(y[t.col('Jednání – ID')]) === j.id); id = r ? String(r[t.col('Soubor – ID')] || '') : ''; }
  if (!id) return { ok: false, chyba: 'Soubor nenalezen.' };
  const f = DriveApp.getFileById(id);
  return { ok: true, nazev: f.getName(), mime: f.getMimeType(), data: Utilities.base64Encode(f.getBlob().getBytes()) };
}

function vvStahnoutBod_(o, ja, j, req) {
  if (j.stav !== 'otevřeno') return { ok: false, chyba: 'Stáhnout jde bod otevřeného jednání (v konceptu ho stačí smazat).' };
  const duvod = String(req.duvod || '').trim(), ch = kontrolaTextu_({ 'Důvod': duvod }, { 'Důvod': 500 });
  if (ch) return { ok: false, chyba: ch };
  if (!duvod) return { ok: false, chyba: 'Napište důvod stažení.' };
  const t = vvTab_(VV_L_BODY), i = t.v.findIndex(r => String(r[t.col('ID')]) === String(req.bod || '') && String(r[t.col('Jednání – ID')]) === j.id);
  if (i < 0) return { ok: false, chyba: 'Bod nenalezen.' };
  if (t.v[i][t.col('Výsledek')] === 'staženo') return { ok: false, chyba: 'Bod už je stažený.' };
  t.sh.getRange(i + 2, t.col('Výsledek') + 1).setValue('staženo'); t.sh.getRange(i + 2, t.col('Staženo – důvod') + 1).setValue(bezVzorce_(duvod));
  zaznamZmeny_(o.email, VV_L_BODY, String(req.bod), 'upraveno', '', 'staženo: ' + duvod);
  return vvDetail_(o, ja, j);
}

/** Zasedání: výsledek zapíše ručně zapisovatel. pritomno = počet přítomných z prezence (povinný), vysledky = [{ bod, pro, proti, zdrzel }];
    přijato, když Pro ≥ nadpoloviční většina přítomných. Neusnášeníschopné zasedání jen upozorní (vrací upozorneni). */
function vvVysledekZasedani_(o, ja, x, j, req) {
  if (j.typ !== 'zasedání' || j.stav !== 'otevřeno') return { ok: false, chyba: 'Výsledek se zapisuje u zveřejněného zasedání.' };
  const vys = Array.isArray(req.vysledky) ? req.vysledky : [], cl = vvClenove_();
  const cislo = v => v === '' || v == null ? NaN : Number(v);
  const clenu = j.clenuVV || cl.length, pritomno = cislo(req.pritomno);
  if (!(Number.isInteger(pritomno) && pritomno >= 1)) return { ok: false, chyba: 'Vyplňte počet přítomných členů VV podle prezence.' };
  if (pritomno > clenu) return { ok: false, chyba: 'Přítomných nemůže být víc než členů VV (' + clenu + ').' };
  if (vys.some(v => [v.pro, v.proti, v.zdrzel].some(n => !(Number.isInteger(cislo(n)) && cislo(n) >= 0 && cislo(n) <= 99)))) return { ok: false, chyba: 'U každého bodu vyplňte počty Pro, Proti a Zdržel se (celá čísla).' };
  if (vys.some(v => cislo(v.pro) + cislo(v.proti) + cislo(v.zdrzel) > pritomno)) return { ok: false, chyba: 'U bodu je víc hlasů než přítomných (' + pritomno + ').' };
  const t = vvTab_(VV_L_BODY), c = t.col, kvorum = vvVetsina_(pritomno);
  vys.forEach(v => { const i = t.v.findIndex(r => String(r[c('ID')]) === String(v.bod) && String(r[c('Jednání – ID')]) === j.id); if (i < 0 || t.v[i][c('Výsledek')] === 'staženo') return;
    const r = t.v[i]; r[c('Pro')] = cislo(v.pro); r[c('Proti')] = cislo(v.proti); r[c('Zdržel se')] = cislo(v.zdrzel); r[c('Výsledek')] = cislo(v.pro) >= kvorum ? 'přijato' : 'nepřijato';
    t.sh.getRange(i + 2, 1, 1, t.h.length).setValues([r]); });
  const ted = new Date(), xc = x.t.col;
  x.r[xc('Stav')] = 'uzavřeno'; x.r[xc('Uzavřeno')] = ted; x.r[xc('Upraveno')] = ted; x.r[xc('Upravil')] = o.email; x.r[xc('Kvórum')] = kvorum;
  if (xc('Přítomno') >= 0) x.r[xc('Přítomno')] = pritomno; if (xc('Členů VV') >= 0 && !x.r[xc('Členů VV')]) x.r[xc('Členů VV')] = clenu;
  x.t.sh.getRange(x.n, 1, 1, x.t.h.length).setValues([x.r]);
  const neusn = pritomno < vvVetsina_(clenu);
  zaznamZmeny_(o.email, VV_L_JEDNANI, j.id, 'upraveno', 'otevřeno', 'uzavřeno – výsledek zasedání zapsán ručně (přítomno ' + pritomno + ' z ' + clenu + ', kvórum ' + kvorum + (neusn ? ', neusnášeníschopné' : '') + ')');
  return Object.assign(vvDetail_(o, ja, vvJednaniJson_(x.t.obj(x.r), cl)), neusn ? { upozorneni: 'Přítomno ' + pritomno + ' z ' + clenu + ' členů – zasedání nebylo usnášeníschopné (potřeba ' + vvVetsina_(clenu) + '). Výsledek je zapsaný.' } : {});
}

function vvZrusit_(o, ja, x, j, req) {
  if (['koncept', 'otevřeno'].indexOf(j.stav) < 0) return { ok: false, chyba: 'Zrušit jde koncept nebo otevřené jednání.' };
  const duvod = String(req.duvod || '').trim(), ch = kontrolaTextu_({ 'Důvod': duvod }, { 'Důvod': 500 });
  if (ch) return { ok: false, chyba: ch };
  const c = x.t.col, pred = j.stav, cl = vvClenove_();
  x.r[c('Stav')] = 'zrušeno'; if (c('Důvod zrušení') >= 0) x.r[c('Důvod zrušení')] = bezVzorce_(duvod); x.r[c('Upraveno')] = new Date(); x.r[c('Upravil')] = o.email;
  x.t.sh.getRange(x.n, 1, 1, x.t.h.length).setValues([x.r]);
  zaznamZmeny_(o.email, VV_L_JEDNANI, j.id, 'upraveno', pred, 'zrušeno' + (duvod ? ': ' + duvod : ''));
  if (pred === 'otevřeno') cl.forEach(m => vvPosta_(m.email, 'Zrušeno: ' + j.nazev, 'Jednání VV „' + j.nazev + '“ bylo zrušeno.' + (duvod ? ' Důvod: ' + duvod : ''), [], ['Otevřít ve Spojce', vvOdkaz_(j.id)]));
  return vvDetail_(o, ja, vvJednaniJson_(x.t.obj(x.r), cl));
}

/* ---------- uzavření, PDF, připomínky ---------- */

/** Uzavře hlasování per rollam: výsledek podle kvóra, PDF záznam do složky jednání + kopie do Orgány OSH PZ/VV, e-mail členům. */
function vvUzavritInterni_(jid, kdo, moznosti) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  let j, cl, body;
  try {
    const x = vvNacist_(jid); if (!x) return;
    cl = vvClenove_(); j = vvJednaniJson_(x.t.obj(x.r), cl);
    if (j.stav !== 'otevřeno' || j.typ !== 'per rollam') return;
    const hlasy = vvPlatneHlasy_(jid), t = vvTab_(VV_L_BODY), c = t.col, kvorum = vvKvorum_(j, cl.length).potreba;
    t.v.forEach((r, i) => { if (String(r[c('Jednání – ID')]) !== jid || r[c('Výsledek')] === 'staženo') return;
      const h = hlasy[String(r[c('ID')])] || {}, n = v => Object.keys(h).filter(e => h[e].volba === v).length;
      r[c('Pro')] = n('pro'); r[c('Proti')] = n('proti'); r[c('Zdržel se')] = n('zdržel se'); r[c('Výsledek')] = n('pro') >= kvorum ? 'přijato' : 'nepřijato';
      t.sh.getRange(i + 2, 1, 1, t.h.length).setValues([r]); });
    const xc = x.t.col, ted = new Date();
    x.r[xc('Stav')] = 'uzavřeno'; x.r[xc('Uzavřeno')] = ted; x.r[xc('Upraveno')] = ted; x.r[xc('Upravil')] = String(kdo || 'časovač'); x.r[xc('Kvórum')] = kvorum;
    x.t.sh.getRange(x.n, 1, 1, x.t.h.length).setValues([x.r]);
    zaznamZmeny_(String(kdo || 'časovač'), VV_L_JEDNANI, jid, 'upraveno', 'otevřeno', 'uzavřeno (kvórum ' + kvorum + ')');
    j = vvJednaniJson_(x.t.obj(x.r), cl); body = vvBody_(jid);
    try { // PDF záznam o hlasování
      const pdf = Utilities.newBlob(vvZaznamHtml_(j, body, hlasy, cl), 'text/html', 'zaznam.html').getAs('application/pdf');
      const den = Utilities.formatDate(ted, 'Europe/Prague', 'yyyyMMdd'), nazev = 'VV ' + den + ' Hlasování per rollam' + (j.nazev ? ' – ' + j.nazev.replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 80) : '') + '.pdf';
      const f = vvSlozka_(x, j).createFile(pdf.setName(nazev));
      x.t.sh.getRange(x.n, xc('Záznam PDF – ID') + 1).setValue(f.getId()); j.zaznam = f.getId();
      if (!moznosti.bezKopie) { // kopie do složky orgánu VV → dál běžné schválení dokumentů (B4)
        const disk = DriveApp.getFolderById(nastaveniWeb_('DISK_ID')), it = disk.getFoldersByName(nastaveniWeb_('SLOZKA_ORGANY'));
        const it2 = it.hasNext() ? it.next().getFoldersByName('VV') : null;
        if (it2 && it2.hasNext()) f.makeCopy('VV ' + den + ' Hlasování per rollam' + (j.nazev ? ' – ' + j.nazev.replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 80) : '') + '.pdf', it2.next());
        else console.warn('Složka orgánu VV nenalezena – kopie záznamu se nevytvořila.');
      }
    } catch (e) { console.error('Záznam o hlasování (PDF): ' + e.message); }
  } finally { lock.releaseLock(); }
  if (moznosti.bezPosty) return;
  const kv = vvKvorum_(j, cl.length);
  const pol = body.map((b, i) => [(i + 1) + '. ' + b.nazev, b.vysledek === 'staženo' ? 'staženo' : vvVysledekText_(b, kv) + ' (proti ' + b.proti + ', zdržel se ' + b.zdrzel + ')']).concat([['Pravidlo', kv.pravidlo]]);
  const komu = cl.map(m => m.email).concat(j.zapisovatel ? [j.zapisovatel] : []).filter((e, i, a) => e && a.indexOf(e) === i);
  komu.forEach(e => vvPosta_(e, 'Výsledek hlasování VV: ' + j.nazev, 'Hlasování per rollam je uzavřené. Záznam o hlasování (PDF) je ve Spojce a půjde ke schválení mezi dokumenty VV.', pol, ['Otevřít ve Spojce', vvOdkaz_(jid)]));
}

function vvZaznamHtml_(j, body, hlasy, cl) {
  const e = esc_, tr = vvTab_(VV_L_PRIP), pr = tr.v.filter(r => String(r[tr.col('Jednání – ID')]) === j.id).map(r => tr.obj(r));
  const hlavicka = String(nastaveniWeb_('OZ_HLAVICKA') || 'SH ČMS – Okresní sdružení hasičů Praha-západ').split('\\n').map(e).join('<br>');
  const den = d => d ? Utilities.formatDate(new Date(d), 'Europe/Prague', 'd. M. yyyy H:mm') : '', kv = vvKvorum_(j, cl.length);
  return '<html><head><meta charset="utf-8"><style>body{font-family:Arial,Helvetica,sans-serif;color:#201e1d;font-size:10.5pt}.hl{font-size:9pt;color:#5c5958;border-bottom:2px solid #201e1d;padding-bottom:6pt;margin-bottom:10pt}' +
    'h1{font-size:16pt;margin:0 0 4pt}h2{font-size:12pt;margin:14pt 0 4pt;border-bottom:2px solid #201e1d}table{border-collapse:collapse;width:100%}td,th{padding:3pt 6pt;border-bottom:1px solid #bbb;text-align:left;vertical-align:top}th{font-size:9pt;color:#5c5958}.p{color:#5c5958;font-size:9.5pt}.t{white-space:pre-line}</style></head><body>' +
    '<div class="hl">' + hlavicka + '</div><h1>Záznam o hlasování per rollam – ' + e(j.nazev) + '</h1>' +
    '<div class="p">Výkonný výbor OSH Praha-západ · otevřeno ' + e(den(j.otevreno)) + ' · termín ' + e(den(j.termin)) + ' · uzavřeno ' + e(den(j.uzavreno)) + '<br>Navrhovatel: ' + e(j.navrhovatelJmeno) + ' · zapisovatel: ' + e(j.zapisovatelJmeno) +
    ' · členů VV při otevření: ' + kv.clenu + '<br>' + e(kv.pravidlo) + '</div>' +
    '<h2>Výsledek po bodech</h2><table><tr><th>Bod</th><th>Návrh usnesení</th><th>Pro</th><th>Proti</th><th>Zdržel se</th><th>Výsledek</th></tr>' +
    body.map((b, i) => '<tr><td>' + (i + 1) + '. ' + e(b.nazev) + '</td><td class="t">' + e(b.text) + (b.duvod ? '<br><i>Staženo: ' + e(b.duvod) + '</i>' : '') + '</td><td>' + (b.pro == null ? '' : b.pro) + '</td><td>' + (b.proti == null ? '' : b.proti) + '</td><td>' + (b.zdrzel == null ? '' : b.zdrzel) + '</td><td><b>' + e(b.vysledek) + '</b>' + (vvVysledekText_(b, kv) ? '<br><span class="p">' + e(vvVysledekText_(b, kv).replace(/^[^:]+: /, '')) + '</span>' : '') + '</td></tr>').join('') + '</table>' +
    '<h2>Hlasy členů</h2><table><tr><th>Člen VV</th>' + body.map((b, i) => '<th>' + (i + 1) + '.</th>').join('') + '</tr>' +
    cl.map(m => '<tr><td>' + e(m.jmeno) + '</td>' + body.map(b => { const h = (hlasy[b.id] || {})[m.email];
      return '<td>' + e(b.vysledek === 'staženo' ? '–' : h ? h.volba + (h.zapsal && h.zapsal !== m.email ? ' *' : '') : 'nehlasoval/a') + '</td>'; }).join('') + '</tr>').join('') + '</table>' +
    (vvZapsaneZa_(hlasy) ? '<p class="p">* hlas zapsal do Spojky ' + e(vvZapsaneZa_(hlasy, cl)) + ' – člen hlasoval jinak než ve Spojce (WhatsApp, telefon, e-mail, osobně) a dostal o zápisu potvrzení e-mailem.</p>' : '') +
    (pr.length ? '<h2>Připomínky</h2><table>' + pr.map(r => '<tr><td style="width:28%">' + e(r['Jméno']) + '<br><span class="p">' + e(den(r['Kdy'])) + '</span></td><td class="t">' + e(r['Text']) + '</td></tr>').join('') + '</table>' : '') +
    '<p class="p" style="margin-top:14pt">Hlasování proběhlo v aplikaci Spojka. Každý člen hlasoval pod svým účtem po přihlášení jednorázovým kódem zaslaným na jeho e-mail; změna hlasu do termínu je zaznamenaná a platí poslední hlas.</p>' +
    spojkaPata_() + '</body></html>';
}

/** Kdo zapisoval hlasy za členy (pro poznámku v PDF): „Petra Vzorová (WhatsApp)“. Bez cl jen true / false. */
function vvZapsaneZa_(hlasy, cl) {
  const z = {}; Object.keys(hlasy).forEach(b => Object.keys(hlasy[b]).forEach(e => { const h = hlasy[b][e]; if (h.zapsal && h.zapsal !== e) (z[h.zapsal] = z[h.zapsal] || {})[h.zpusob || '?'] = true; }));
  if (!cl) return Object.keys(z).length > 0;
  return Object.keys(z).map(k => vvJmeno_(cl, k) + ' (' + Object.keys(z[k]).join(', ') + ')').join(', ');
}

/** Připomínka těm, kdo ještě nehlasovali (časovač 24 h před termínem, nebo ručně). Vrací počet adresátů. */
function vvPripomenoutNehlasujicim_(j, cl) {
  const body = vvBody_(j.id), hlasy = vvPlatneHlasy_(j.id), akt = body.filter(b => b.vysledek !== 'staženo');
  const kdo = cl.filter(m => akt.some(b => !(hlasy[b.id] || {})[m.email]));
  kdo.forEach(m => vvPosta_(m.email, 'Připomínka – hlasování VV: ' + j.nazev, 'Ještě jste nehlasoval/a u všech bodů. Hlasování končí ' + vvKdy_(j.termin) + '.', [], ['Hlasovat ve Spojce', vvOdkaz_(j.id)]));
  const x = vvNacist_(j.id); if (x) x.t.sh.getRange(x.n, x.t.col('Připomenuto') + 1).setValue(new Date());
  zaznamZmeny_('časovač', VV_L_JEDNANI, j.id, 'upraveno', '', 'připomínka nehlasujícím: ' + kdo.length);
  return kdo.length;
}

/** Časovač každou hodinu: připomínka 24 h před termínem, uzavření v termínu. */
function vvKazdouHodinu() {
  if (!dataSs_().getSheetByName(VV_L_JEDNANI)) return;
  const cl = vvClenove_(), ted = Date.now(), tj = vvTab_(VV_L_JEDNANI);
  tj.v.filter(r => r[tj.col('ID')]).map(r => vvJednaniJson_(tj.obj(r), cl)).filter(j => j.typ === 'per rollam' && j.stav === 'otevřeno').forEach(j => {
    const konec = new Date(j.termin).getTime();
    if (konec <= ted) vvUzavritInterni_(j.id, 'časovač', {});
    else if (konec - ted <= 24 * 3600e3 && !j.pripomenuto) vvPripomenoutNehlasujicim_(j, cl);
  });
}

/** Odznak a přehled okresu (souhrn): jednání, kde přihlášený člen ještě nehlasoval. */
function vvCekaNaMe_(o) {
  if (!vvJa_(o).clen || !dataSs_().getSheetByName(VV_L_JEDNANI)) return [];
  const cl = vvClenove_(), tj = vvTab_(VV_L_JEDNANI);
  return tj.v.filter(r => r[tj.col('ID')]).map(r => vvJednaniJson_(tj.obj(r), cl)).filter(j => j.typ === 'per rollam' && j.stav === 'otevřeno' && new Date(j.termin) > new Date())
    .filter(j => vvMojeCeka_(j, vvBody_(j.id), vvPlatneHlasy_(j.id), o.email) > 0).map(j => ({ id: j.id, nazev: j.nazev, termin: j.termin }));
}

const vvOdkaz_ = id => String(nastaveniWeb_('WEB_URL') || '').replace(/\/+$/, '') + '/Aplikace%20OSH.dc.html#okres/vv/' + encodeURIComponent(id);
const vvKdy_ = iso => iso ? Utilities.formatDate(new Date(iso), 'Europe/Prague', 'd. M. yyyy H:mm') : '';
function vvPosta_(komu, predmet, uvod, polozky, tlacitko) {
  const primo = String(nastaveniWeb_('VV_POSTA_PRIMO') || '').trim().toUpperCase() === 'ANO' ? 'vzdy' : false; // skutečné hlasování VV i na testovacím prostředí
  try { posta_(komu, predmet, uvod + (tlacitko ? '\n\n' + tlacitko[1] : ''), sablona_(predmet, uvod, polozky || [], tlacitko, 'Automatická zpráva pro členy výkonného výboru.'), primo); }
  catch (e) { console.error('E-mail VV: ' + e.message); }
}

/* ---------- testovací data (jen TEST) ---------- */

/**
 * Tři jednání pro test (ID s TEST, uklidí Úklid testů): uzavřené per rollam v historii (navrhuje i zapisuje stálý zapisovatel – kancelář),
 * otevřené per rollam se 3 body a 2 podklady (navrhuje jiný člen VV, zapisuje Petra), připravované zasedání (navrhuje i zapisuje člen VV)
 * a uzavřené zasedání se 6 přítomnými z 9 členů (kvórum 4 – vymyšlené počty, nezávisle na listu Uživatelé).
 * Potřebuje členy VV v listu Uživatelé (sloupec VV); „kancelář“ = první stálý zapisovatel (VV = zapisovatel), jinak první člen.
 */
function vlozitTestyVV() {
  if (String(nastaveniWeb_('REZIM') || '').toUpperCase() !== 'TEST') throw new Error('Testovací jednání VV jde vložit jen v režimu TEST.');
  const cl = vvClenove_();
  if (!cl.length) throw new Error('V listu Uživatelé není žádný člen VV. Doplňte sloupec VV (ANO / zapisovatel) aspoň u sebe a u kanceláře (zapisovatel) a spusťte znovu.');
  const petra = cl.find(c => c.staly) || cl[0], jiny = cl.find(c => c.email !== petra.email) || petra, treti = cl.filter(c => c.email !== petra.email)[1] || jiny;
  const tj = vvTab_(VV_L_JEDNANI), tb = vvTab_(VV_L_BODY), th = vvTab_(VV_L_HLASY), tp = vvTab_(VV_L_PODKLADY), tr = vvTab_(VV_L_PRIP);
  const uz = {}; tj.v.forEach(r => { uz[String(r[tj.col('ID')])] = true; });
  const ted = new Date(), den = n => new Date(ted.getTime() + n * 864e5), kvorum = Math.floor(cl.length / 2) + 1, hlaseni = [];
  const jednani = (id, nazev, typ, termin, stav, navrh, zapis, misto, jine) => tj.sh.appendRow(vvRadek_(tj, Object.assign({ 'ID': id, 'Název': nazev, 'Typ': typ, 'Termín': termin, 'Místo': misto || '', 'Stav': stav,
    'Kvórum': typ === 'per rollam' ? kvorum : '', 'Členů VV': cl.length, 'Navrhovatel': navrh.email, 'Zapisovatel': zapis.email, 'Otevřeno': stav === 'koncept' ? '' : den(-1), 'Poznámka': 'Testovací jednání – vymyšlené údaje.', 'Vytvořeno': ted, 'Vytvořil': 'test' }, jine || {})));
  const bod = (id, jid, poradi, nazev, text, jine) => tb.sh.appendRow(vvRadek_(tb, Object.assign({ 'ID': id, 'Jednání – ID': jid, 'Pořadí': poradi, 'Název': nazev, 'Text usnesení': text }, jine || {})));
  // 1. uzavřené per rollam v historii
  if (!uz['VVJTEST-1']) {
    jednani('VVJTEST-1', 'TEST: Schválení rozpočtu okresní soutěže', 'per rollam', den(-8), 'otevřeno', petra, petra);
    bod('VVBTEST-1a', 'VVJTEST-1', 1, 'Rozpočet soutěže', 'VV schvaluje rozpočet okresního kola hry Plamen ve výši 25 000 Kč.');
    bod('VVBTEST-1b', 'VVJTEST-1', 2, 'Startovné', 'VV schvaluje startovné 300 Kč za družstvo.');
    cl.forEach((m, i) => ['VVBTEST-1a', 'VVBTEST-1b'].forEach((b, k) => th.sh.appendRow(vvRadek_(th, { 'ID': 'VVHTEST-1-' + i + '-' + k, 'Bod – ID': b, 'Jednání – ID': 'VVJTEST-1', 'E-mail': m.email, 'Jméno': m.jmeno,
      'Volba': i === 1 && k === 1 ? 'proti' : i === 2 ? 'zdržel se' : 'pro', 'Čas': den(-9), 'Platný': 'ANO', 'Nahrazuje – ID': '' }))));
    tr.sh.appendRow(vvRadek_(tr, { 'ID': 'VVPTEST-1', 'Jednání – ID': 'VVJTEST-1', 'E-mail': petra.email, 'Jméno': petra.jmeno, 'Text': 'Startovné stejné jako loni.', 'Kdy': den(-9) }));
    vvUzavritInterni_('VVJTEST-1', 'test', { bezPosty: true, bezKopie: true });
    hlaseni.push('uzavřené per rollam');
  }
  // 2. otevřené per rollam se 3 body a 2 podklady
  if (!uz['VVJTEST-2']) {
    jednani('VVJTEST-2', 'TEST: Ocenění členů a nákup vybavení', 'per rollam', den(3), 'otevřeno', jiny, petra);
    bod('VVBTEST-2a', 'VVJTEST-2', 1, 'Čestné uznání', 'VV uděluje čestné uznání OSH dvěma členům SDH Ukázkov za dlouholetou práci s mládeží.');
    bod('VVBTEST-2b', 'VVJTEST-2', 2, 'Nákup časomíry', 'VV schvaluje nákup elektronické časomíry do 40 000 Kč z rozpočtu okresu.');
    bod('VVBTEST-2c', 'VVJTEST-2', 3, 'Termín valné hromady', 'VV stanovuje termín okresního shromáždění představitelů na sobotu 14. 3. 2027.');
    const x = vvNacist_('VVJTEST-2'), j = vvJednaniJson_(x.t.obj(x.r), cl), sl = vvSlozka_(x, j);
    const f = sl.createFile(Utilities.newBlob('<html><body><h1>Nabídka – časomíra</h1><p>Testovací podklad, vymyšlené údaje.</p></body></html>', 'text/html', 'nabidka.html').getAs('application/pdf').setName('Nabídka časomíra.pdf'));
    tp.sh.appendRow(vvRadek_(tp, { 'ID': 'VVDTEST-2a', 'Jednání – ID': 'VVJTEST-2', 'Typ': 'soubor', 'Název': 'Nabídka časomíra.pdf', 'Soubor – ID': f.getId(), 'Přidal': petra.email, 'Kdy': den(-1) }));
    tp.sh.appendRow(vvRadek_(tp, { 'ID': 'VVDTEST-2b', 'Jednání – ID': 'VVJTEST-2', 'Typ': 'odkaz', 'Název': 'Směrnice o hospodaření (web OSH)', 'URL': 'https://test.oshpz.cz/?stranka=dokumenty', 'Přidal': petra.email, 'Kdy': den(-1) }));
    hlaseni.push('otevřené per rollam (3 body, 2 podklady)');
  }
  // 3. připravované zasedání
  if (!uz['VVJTEST-3']) {
    jednani('VVJTEST-3', 'TEST: Zasedání VV – listopad', 'zasedání', den(14), 'otevřeno', treti, treti, 'Zbraslav, K Výtopně 1224');
    bod('VVBTEST-3a', 'VVJTEST-3', 1, 'Kontrola usnesení', 'VV bere na vědomí plnění usnesení z minulého zasedání.');
    bod('VVBTEST-3b', 'VVJTEST-3', 2, 'Plán školení 2027', 'VV schvaluje plán školení na rok 2027.');
    hlaseni.push('připravované zasedání');
  }
  // 4. uzavřené zasedání: 6 přítomných z 9 členů → kvórum 4 (bod 2 přijat 4 hlasy, bod 3 nepřijat 3 hlasy)
  if (!uz['VVJTEST-4']) {
    jednani('VVJTEST-4', 'TEST: Zasedání VV – září', 'zasedání', den(-40), 'uzavřeno', treti, petra, 'Zbraslav, K Výtopně 1224',
      { 'Členů VV': 9, 'Přítomno': 6, 'Kvórum': 4, 'Otevřeno': den(-47), 'Uzavřeno': den(-40), 'Poznámka': 'Testovací jednání – vymyšlené údaje (6 přítomných z 9 členů VV).' });
    bod('VVBTEST-4a', 'VVJTEST-4', 1, 'Zpráva o hospodaření', 'VV schvaluje zprávu o hospodaření za 1. pololetí.', { 'Výsledek': 'přijato', 'Pro': 6, 'Proti': 0, 'Zdržel se': 0 });
    bod('VVBTEST-4b', 'VVJTEST-4', 2, 'Příspěvek na dopravu', 'VV schvaluje příspěvek 5 000 Kč na dopravu družstva na krajské kolo.', { 'Výsledek': 'přijato', 'Pro': 4, 'Proti': 1, 'Zdržel se': 1 });
    bod('VVBTEST-4c', 'VVJTEST-4', 3, 'Nákup praporu', 'VV schvaluje nákup nového praporu okresu.', { 'Výsledek': 'nepřijato', 'Pro': 3, 'Proti': 2, 'Zdržel se': 1 });
    hlaseni.push('uzavřené zasedání (6 přítomných z 9)');
  }
  vycistitMezipamet_('Uživatelé');
  const text = 'Testovací jednání VV: ' + (hlaseni.join(', ') || 'už v tabulce jsou') + '. Kancelář (navrhuje i zapisuje) = ' + petra.jmeno + ', jiný navrhovatel = ' + jiny.jmeno + ', zasedání = ' + treti.jmeno + ' (členů VV: ' + cl.length + '). Uklidí je „Úklid testů“.';
  console.log(text); try { SpreadsheetApp.getActive().toast(text, 'Testovací jednání VV', 15); } catch (e) {}
  return text;
}
