/**
 * OSH data – členové sborů (B17): seznam členů pro přihlášky na soutěže.
 * Nový soubor „Clenove“ ve stejném projektu.
 *
 * List Členové plní: zápis přihlášky do evidence (B7, prhEvidence_ → cleZPrihlasky_), provedený přestup (Prestupy.gs → cleZPrestupu_)
 *   a import exportu z evidencesdh.cz (importEvidence, jen Správce). Rodné číslo ani adresa se NIKDY neukládají – z exportu se jen
 *   odvodí datum narození a pohlaví, když chybí; zdrojový soubor se po importu dá do koše.
 * Sbor (portál → Členové → Seznam): své členy jen ke čtení, změnu (ukončení, oprava) nahlásí do listu Změny členů;
 *   provede ji okres (role Přihlášky / Správce) – stejný postup jako Změny sborů (B16).
 * Soupiska družstva (Souteze.gs, sloupec Soupiska v listu Přihlášky družstev): výběr členů podle věku a pohlaví –
 *   cleRozsah_ / clePosoudit_ mají kopii v soupiska.js (prohlížeč) – měnit obě.
 * Noční údržba (cleUdrzba_): neaktivní členy smaže po CLENOVE_VYMAZ_DNY, soupisky po skončení ročníku soutěže (31. 8.), vyřízené změny po roce.
 */

const LIST_CLENOVE = 'Členové', LIST_ZMENY_CLENU = 'Změny členů';
const CLE_ZDROJE = ['evidence', 'přihláška', 'přestup', 'test'];
const CLE_ZMENY_STAVY = ['podáno', 'provedeno', 'zamítnuto', 'zrušeno'];
const CLE_NOVY_ZAPIS_DNY = 60; // člen zapsaný z přihlášky / přestupu se při importu staršího exportu neoznačí jako neaktivní

function smiClenoveOkres_(o) { return !!(o && (o.role['Přihlášky'] || o.role['Správce'])); }

/* ---------- datum, kategorie, porovnání jmen ---------- */

/** Datum z tabulky, exportu nebo aplikace → 'yyyy-MM-dd' ('' když nejde přečíst). Číslo = sériové datum Excelu. */
function cleDen_(v) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, 'Europe/Prague', 'yyyy-MM-dd');
  if (typeof v === 'number' && v > 1000 && v < 80000) return Utilities.formatDate(new Date(Math.round((v - 25569) * 864e5) + 12 * 36e5), 'UTC', 'yyyy-MM-dd');
  const t = String(v == null ? '' : v).trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0');
  m = t.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  if (/^\d{5}(\.\d+)?$/.test(t)) return cleDen_(Number(t));
  return '';
}
/** Kategorie člena v seznamu: věk k 1. 9. právě běžícího ročníku (do 15 let mladý hasič, 15–17 dorost, od 18 dospělý). Soutěže mají vlastní pravidla (cleRozsah_). */
function cleKategorie_(narozen, dnes) {
  const d = cleDen_(narozen); if (!d) return '';
  const t = dnes || new Date(), r0 = t.getMonth() >= 8 ? t.getFullYear() : t.getFullYear() - 1; // ročník začíná 1. 9.
  const y = Number(d.slice(0, 4)), md = d.slice(5);
  const vek = r0 - y - (md > '09-01' ? 1 : 0);
  return vek < 15 ? 'mladý hasič' : vek < 18 ? 'dorost' : 'dospělý';
}
const cleBezDiakritiky_ = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Název sboru pro párování: bez „SDH“ / „Sbor dobrovolných hasičů“, diakritiky, teček a mezer navíc. */
const cleNormSbor_ = t => cleBezDiakritiky_(t).replace(/^\s*(sdh|sbor dobrovolnych hasicu)\s+/, '').replace(/[.,\-–]+/g, ' ').replace(/\s+/g, ' ').trim();
const cleKlicOsoby_ = (j, p, n) => [cleBezDiakritiky_(j).trim(), cleBezDiakritiky_(p).trim(), cleDen_(n)].join('|');
function clePohlavi_(v) { const t = cleBezDiakritiky_(v).trim(); return /^(z|zena|f|divka|dorostenka)$/.test(t) ? 'žena' : /^(m|muz|chlapec|dorostenec)$/.test(t) ? 'muž' : ''; }
/** Z rodného čísla jen datum narození a pohlaví (rodné číslo se nikam neukládá). */
function cleZRodnehoCisla_(rc) {
  const s = String(rc || '').replace(/[\s/]/g, ''); if (!/^\d{9,10}$/.test(s)) return null;
  let rr = Number(s.slice(0, 2)), mm = Number(s.slice(2, 4)); const dd = Number(s.slice(4, 6));
  const zena = mm > 50; if (zena) mm -= 50; if (mm > 20) mm -= 20;
  const rok = s.length === 9 ? 1900 + rr : rr < 54 ? 2000 + rr : 1900 + rr;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return { narozen: rok + '-' + String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0'), pohlavi: zena ? 'žena' : 'muž' };
}

/* ---------- pravidla soutěží: kdo smí do kategorie (kopie v soupiska.js – měnit obě) ---------- */

const CLE_VELIKOST = { 'ZHVB': [5, 5], 'Hra Plamen': [5, 10], 'uzlová štafeta': [5, 5], 'požární útok': [7, 9] }; // výchozí počet členů družstva, když OZ neříká jinak

/**
 * Pravidla kategorie: rok konce ročníku (ročník 1. 9. – 31. 8., rozhoduje věk v roce ukončení ročníku – Směrnice hry Plamen, rámcové OZ ZHVB),
 * nejstarší povolený ročník narození (MH a dorost; mladšími se kategorie smí doplnit), u dospělých nejmladší ročník (15 let v roce soutěže),
 * pohlaví podle názvu kategorie, počet členů. Ročníky z OZ soutěže mají přednost (okresní OZ před rámcovým).
 */
function cleRozsah_(s, kat) {
  const od = new Date(s.od || Date.now()), rokSoutez = od.getFullYear(), E = od.getMonth() >= 8 ? rokSoutez + 1 : rokSoutez;
  const k = String(kat || '').toLowerCase(), oz = ((s.oz || {}).kategorie || {})[kat] || {};
  const jednotlivci = /jednotliv/.test(k);
  const dosp = /muži|ženy|dospěl/.test(k) || (s.pro === 'dospělí' && !/dorost|mladš|starš|příprav/.test(k));
  const pohlavi = /dívk|dorostenk|žen/.test(k) ? 'žena' : /chlap|dorostenc|muž/.test(k) ? 'muž' : '';
  let nejstarsi = null, nejmladsi = null, zOz = false, vek = null;
  const roky = (String(oz.rocniky || '').match(/\b(19|20)\d{2}\b/g) || []).map(Number);
  if (roky.length >= 2) { nejstarsi = Math.min.apply(null, roky); nejmladsi = Math.max.apply(null, roky); zOz = true; }
  else if (roky.length === 1) { if (/starš|dřív|a před/.test(String(oz.rocniky))) nejmladsi = roky[0]; else nejstarsi = roky[0]; zOz = true; }
  else if (dosp) nejmladsi = rokSoutez - 15;
  else if (/příprav/.test(k)) { vek = 6; nejstarsi = E - 6; }
  else if (/mladš/.test(k)) { vek = 11; nejstarsi = E - 11; }
  else if (/starš/.test(k)) { vek = 15; nejstarsi = E - 15; }
  else if (/dorost/.test(k)) { vek = 18; nejstarsi = E - 18; }
  if (!dosp) nejmladsi = jednotlivci && /dorost/.test(k) && !zOz ? E - 15 : zOz && jednotlivci ? nejmladsi : null; // mládež: družstvo smí doplnit mladší; jednotlivec dorostu musí mít aspoň 15 let v roce konce ročníku // mládež: kategorii smí doplnit mladší (Směrnice hry Plamen, OZ ZHVB) – hlídá se jen, kdo je moc starý
  const v = CLE_VELIKOST[s.druh] || [5, 10];
  const min = jednotlivci ? 1 : Number(oz.min) || v[0], max = jednotlivci ? 1 : Math.max(Number(oz.max) || v[1], Number(oz.min) || 0);
  return { E: E, rokSoutez: rokSoutez, nejstarsi: nejstarsi, nejmladsi: nejmladsi, vek: vek, zOz: zOz, dosp: dosp, pohlavi: pohlavi, smiseny: /smíšen/.test(k),
    jednotlivci: jednotlivci, min: Math.min(min, max), max: max, jednouVKole: s.druh === 'ZHVB' };
}
/** Důvod, proč člen do kategorie nesmí ('' = smí). c = { narozen: 'yyyy-MM-dd', pohlavi }. */
function clePosoudit_(c, R) {
  const d = cleDen_(c.narozen);
  if (!d) return 'chybí datum narození';
  const y = Number(d.slice(0, 4));
  if (R.nejstarsi && y < R.nejstarsi) return R.vek && !R.zOz ? 'starší než ' + R.vek + ' let v roce ' + R.E + ' (ročník ' + y + ', nejstarší povolený ' + R.nejstarsi + ')' : 'ročník ' + y + ' – podle OZ nejstarší ' + R.nejstarsi;
  if (R.nejmladsi && y > R.nejmladsi) return R.zOz ? 'ročník ' + y + ' – podle OZ nejmladší ' + R.nejmladsi : (R.dosp ? 'v roce ' + R.rokSoutez : 'v roce ' + R.E) + ' mu nebude 15 let (ročník ' + y + ')';
  if (R.pohlavi && c.pohlavi && c.pohlavi !== R.pohlavi) return R.pohlavi === 'žena' ? 'kategorie jen pro dívky / ženy' : 'kategorie jen pro chlapce / muže';
  if (R.pohlavi && !c.pohlavi) return 'chybí pohlaví (kategorie ' + (R.pohlavi === 'žena' ? 'dívek / žen' : 'chlapců / mužů') + ')';
  return '';
}

/* ---------- čtení a zápis listu Členové ---------- */

function cleTab_(nazev) {
  const sh = dataSs_().getSheetByName(nazev || LIST_CLENOVE);
  if (!sh) throw new Error('Chybí list „' + (nazev || LIST_CLENOVE) + '“ – spusťte v tabulce OSH data → Založit / doplnit strukturu.');
  const h = hlavicka_(sh), col = k => h.indexOf(k);
  const v = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues() : [];
  return { sh, h, col, v };
}
function cleJson_(r) {
  return { id: String(r['ID']), sbor: String(r['Sbor'] || ''), skupina: String(r['Skupina'] || ''), jmeno: String(r['Jméno'] || ''), prijmeni: String(r['Příjmení'] || ''),
    narozen: cleDen_(r['Datum narození']), pohlavi: String(r['Pohlaví'] || ''), obec: String(r['Obec'] || ''), kategorie: cleKategorie_(r['Datum narození']) || String(r['Kategorie'] || ''),
    ev: String(r['Evidenční číslo'] || ''), clenemOd: cleDen_(r['Členem od']), aktivni: String(r['Aktivní'] || 'ANO').toUpperCase() !== 'NE', zdroj: String(r['Zdroj'] || ''),
    aktualizovano: cleDen_(r['Aktualizováno']) };
}
function cleClenove_(skupina) {
  return radky_(LIST_CLENOVE).filter(r => r['ID'] && (!skupina || String(r['Skupina']) === skupina)).map(cleJson_)
    .sort((a, b) => a.prijmeni.localeCompare(b.prijmeni, 'cs') || a.jmeno.localeCompare(b.jmeno, 'cs'));
}
function cleNoveId_() { return 'C' + Utilities.formatDate(new Date(), 'Europe/Prague', 'yyMMddHHmmss') + Math.floor(Math.random() * 9000 + 1000); }
function cleSboryPodleSkupiny_() {
  const m = {}; radkyRychle_('Sbory').forEach(r => { const sk = String(r['Skupina'] || '').split('@')[0].toLowerCase(); if (sk) m[sk] = String(r['Sbor']); }); return m;
}

/**
 * Přidá nebo aktualizuje člena (páruje podle evidenčního čísla, bez něj podle jména a data narození ve stejném sboru).
 * x = { sbor, skupina, jmeno, prijmeni, narozen, pohlavi, obec, ev, clenemOd, zdroj }. Vrací ID člena.
 */
function cleZapsatJednoho_(x, kdo) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const t = cleTab_(), c = t.col, ted = new Date();
    let i = x.ev ? t.v.findIndex(r => String(r[c('Evidenční číslo')]).trim() === String(x.ev).trim()) : -1;
    if (i < 0) i = t.v.findIndex(r => String(r[c('Skupina')]) === x.skupina && cleKlicOsoby_(r[c('Jméno')], r[c('Příjmení')], r[c('Datum narození')]) === cleKlicOsoby_(x.jmeno, x.prijmeni, x.narozen));
    const r = i >= 0 ? t.v[i] : t.h.map(() => ''), set = (k, val) => { if (c(k) >= 0 && val !== undefined && val !== '') r[c(k)] = val; };
    if (i < 0) set('ID', cleNoveId_());
    set('Sbor', x.sbor); set('Skupina', x.skupina); set('Jméno', bezVzorce_(x.jmeno)); set('Příjmení', bezVzorce_(x.prijmeni));
    if (x.narozen) set('Datum narození', new Date(x.narozen + 'T00:00:00'));
    set('Pohlaví', x.pohlavi); set('Obec', x.obec ? bezVzorce_(String(x.obec)) : ''); set('Kategorie', cleKategorie_(x.narozen || r[c('Datum narození')])); set('Evidenční číslo', x.ev ? bezVzorce_(String(x.ev)) : '');
    if (x.clenemOd) set('Členem od', new Date(x.clenemOd + 'T00:00:00'));
    r[c('Aktivní')] = 'ANO'; set('Zdroj', x.zdroj); r[c('Aktualizováno')] = ted;
    if (i >= 0) t.sh.getRange(i + 2, 1, 1, t.h.length).setValues([r]); else t.sh.appendRow(r);
    zaznamZmeny_(kdo, LIST_CLENOVE, String(r[c('ID')]), i >= 0 ? 'upraveno' : 'vytvořeno', '', x.zdroj + (x.ev ? ' · ev. č. ' + x.ev : ''));
    return String(r[c('ID')]);
  } finally { lock.releaseLock(); }
}

/** Po zápisu přihlášky do evidence (prhEvidence_): člen se přidá automaticky. Z udaje.json jen pohlaví (z rodného čísla) a obec – rodné číslo ani ulice se nepřepisují. */
function cleZPrihlasky_(r, kdo) {
  if (!dataSs_().getSheetByName(LIST_CLENOVE)) return '';
  let pohlavi = '', obec = '';
  try { const u = prhUdaje_(r) || {}; const z = cleZRodnehoCisla_(u.rc); if (z) pohlavi = z.pohlavi; obec = String(u.obec || '').trim().slice(0, 80); } catch (e) {}
  return cleZapsatJednoho_({ sbor: String(r['Sbor']), skupina: String(r['Skupina']), jmeno: String(r['Jméno']), prijmeni: String(r['Příjmení']), narozen: cleDen_(r['Datum narození']),
    pohlavi: pohlavi, obec: obec, ev: String(r['Evidenční číslo'] || ''), clenemOd: cleDen_(r['Členem od']), zdroj: 'přihláška' }, kdo);
}

/** Provedený přestup (Prestupy.gs): člen přejde do nového sboru (jen sbory okresu). */
function cleZPrestupu_(r, kdo) {
  const sk = String(r['Do skupina'] || '').split('@')[0].toLowerCase();
  if (!sk || !dataSs_().getSheetByName(LIST_CLENOVE)) return '';
  const t = cleTab_(), c = t.col, ev = String(r['Evidenční číslo'] || '').trim(), klic = cleKlicOsoby_(r['Jméno'], r['Příjmení'], r['Datum narození']);
  const puvodni = t.v.find(x => (ev && String(x[c('Evidenční číslo')]).trim() === ev) || cleKlicOsoby_(x[c('Jméno')], x[c('Příjmení')], x[c('Datum narození')]) === klic) || null;
  const sbor = cleSboryPodleSkupiny_()[sk] || String(r['Do sboru'] || '');
  if (puvodni) { // přesun: stejný řádek, nový sbor
    puvodni[c('Sbor')] = sbor; puvodni[c('Skupina')] = sk; puvodni[c('Aktivní')] = 'ANO'; puvodni[c('Aktualizováno')] = new Date();
    if (c('Zdroj') >= 0) puvodni[c('Zdroj')] = 'přestup';
    t.sh.getRange(t.v.indexOf(puvodni) + 2, 1, 1, t.h.length).setValues([puvodni]);
    zaznamZmeny_(kdo, LIST_CLENOVE, String(puvodni[c('ID')]), 'upraveno', '', 'přestup do ' + sbor);
    return String(puvodni[c('ID')]);
  }
  return cleZapsatJednoho_({ sbor: sbor, skupina: sk, jmeno: String(r['Jméno']), prijmeni: String(r['Příjmení']), narozen: cleDen_(r['Datum narození']), ev: ev, zdroj: 'přestup' }, kdo);
}

/* ---------- API ---------- */

function apiClenove_(req) {
  const o = prihlaseny_(req.token);
  if (!o) return { ok: false, chyba: 'Nepřihlášen', odhlasen: true };
  if (['clenoveOkres', 'clenZmenaRozhodnout', 'clenoveImport'].indexOf(req.akce) >= 0) {
    if (!smiClenoveOkres_(o)) return { ok: false, chyba: 'Seznam členů všech sborů vidí role Přihlášky nebo Správce.' };
    if (req.akce === 'clenoveOkres') return cleOkres_();
    if (req.akce === 'clenZmenaRozhodnout') return cleRozhodnout_(o, req);
    if (!o.role['Správce']) return { ok: false, chyba: 'Import z evidence spouští jen Správce.' };
    return cleImport_(o.email);
  }
  const u = pohledSboru_(o, req.sbor);
  if (!u) return { ok: false, chyba: 'Ke sboru ' + (req.sbor || '(nevybrán)') + ' nemáte přístup.' };
  const sk = u.sbor.skupina;
  if (req.akce === 'clenoveSbor') return cleSbor_(sk);
  if (req.akce === 'clenZmenaPodat') return clePodat_(o, u, req);
  if (req.akce === 'clenZmenaZrusit') return cleZrusit_(o, sk, String(req.id || ''));
  return { ok: false, chyba: 'Neznámá akce' };
}

function cleZmenaJson_(r) {
  let pole = {}; try { pole = JSON.parse(r['Údaje'] || '{}') || {}; } catch (e) {}
  return { id: String(r['ID']), clen: String(r['Člen – ID'] || ''), jmeno: String(r['Člen'] || ''), sbor: String(r['Sbor'] || ''), skupina: String(r['Skupina'] || ''),
    zmena: String(r['Změna'] || ''), pole: pole, duvod: String(r['Důvod'] || ''), stav: String(r['Stav'] || ''), podal: String(r['Podal'] || ''), podano: cleDen_(r['Podáno']),
    vyridil: String(r['Vyřídil'] || ''), vyrizeno: cleDen_(r['Vyřízeno']), poznamka: String(r['Poznámka'] || '') };
}
function cleZmeny_(skupina) {
  if (!dataSs_().getSheetByName(LIST_ZMENY_CLENU)) return [];
  return radky_(LIST_ZMENY_CLENU).filter(r => r['ID'] && (!skupina || String(r['Skupina']) === skupina)).map(cleZmenaJson_).reverse();
}
function cleSbor_(sk) { return { ok: true, data: cleClenove_(sk), zmeny: cleZmeny_(sk) }; }
function cleOkres_() {
  const okrsky = {}; radkyRychle_('Sbory').forEach(r => { okrsky[String(r['Sbor'])] = String(r['Okrsek'] || ''); });
  return { ok: true, data: cleClenove_(null).map(c => Object.assign(c, { okrsek: okrsky[c.sbor] || '' })), zmeny: cleZmeny_(null) };
}

const CLE_POPIS_POLI = { jmeno: 'jméno', prijmeni: 'příjmení', narozen: 'datum narození', pohlavi: 'pohlaví', obec: 'obec', ev: 'evidenční číslo' };
/** Sbor nahlásí ukončení členství nebo opravu údajů (jméno, příjmení, datum narození, pohlaví, obec, evidenční číslo). Provede okres. */
function clePodat_(o, u, req) {
  const sk = u.sbor.skupina, d = req.data || {}, zmena = String(d.zmena || '');
  if (['ukončit', 'opravit'].indexOf(zmena) < 0) return { ok: false, chyba: 'Vyberte, co se má změnit.' };
  const clen = cleClenove_(sk).find(x => x.id === String(d.clen || ''));
  if (!clen) return { ok: false, chyba: 'Člen nenalezen ve vašem sboru.' };
  const duvod = String(d.duvod || '').trim(), pole = {};
  if (zmena === 'opravit') {
    Object.keys(CLE_POPIS_POLI).forEach(k => { const v = String((d.pole || {})[k] == null ? '' : d.pole[k]).trim(); if (v && v !== String(clen[k] || '')) pole[k] = v; });
    if (!Object.keys(pole).length) return { ok: false, chyba: 'Nic se nemění – upravte aspoň jeden údaj.' };
    if (pole.narozen && !/^\d{4}-\d{2}-\d{2}$/.test(pole.narozen)) return { ok: false, chyba: 'Datum narození má tvar RRRR-MM-DD.' };
    if (pole.pohlavi && ['muž', 'žena'].indexOf(pole.pohlavi) < 0) return { ok: false, chyba: 'Pohlaví: muž nebo žena.' };
    if (pole.ev && !/^[\w\/-]{1,20}$/.test(pole.ev)) return { ok: false, chyba: 'Evidenční číslo: písmena, číslice, - a /.' };
  } else {
    pole.ke = String(d.ke || '').trim() || cleDen_(new Date());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pole.ke)) return { ok: false, chyba: 'Datum ukončení má tvar RRRR-MM-DD.' };
  }
  const ch = kontrolaTextu_({ 'Důvod': duvod, 'Jméno': pole.jmeno, 'Příjmení': pole.prijmeni, 'Obec': pole.obec }, { 'Důvod': 500, 'Jméno': 60, 'Příjmení': 60, 'Obec': 80 });
  if (ch) return { ok: false, chyba: ch };
  if (limit_('clen-zmena', o.email, 40, 3600)) return { ok: false, chyba: 'Příliš mnoho hlášení za hodinu. Zkuste to později.' };
  const t = cleTab_(LIST_ZMENY_CLENU), c = t.col;
  if (t.v.some(r => String(r[c('Člen – ID')]) === clen.id && r[c('Stav')] === 'podáno')) return { ok: false, chyba: 'U tohoto člena už jedna změna čeká na okres. Počkejte na vyřízení, nebo ji zrušte.' };
  const r = t.h.map(() => ''), set = (k, v) => { if (c(k) >= 0) r[c(k)] = v; }, ted = new Date(), id = 'ZC' + Utilities.formatDate(ted, 'Europe/Prague', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
  set('ID', id); set('Člen – ID', clen.id); set('Člen', bezVzorce_(clen.jmeno + ' ' + clen.prijmeni)); set('Sbor', u.sbor.sbor); set('Skupina', sk); set('Změna', zmena);
  set('Údaje', JSON.stringify(pole)); set('Důvod', bezVzorce_(duvod)); set('Stav', 'podáno'); set('Podal', o.email); set('Podáno', ted);
  set('Vytvořeno', ted); set('Vytvořil', o.email); set('Upraveno', ted); set('Upravil', o.email);
  t.sh.appendRow(r);
  zaznamZmeny_(o.email, LIST_ZMENY_CLENU, id, 'vytvořeno', '', zmena + ' – ' + clen.id);
  try { prhPosta_('', 'Změna člena ke schválení: ' + u.sbor.sbor, u.sbor.sbor + ' hlásí změnu u člena (' + (zmena === 'ukončit' ? 'ukončení členství' : 'oprava údajů') + '). Vyřiďte ji ve správě okresu → Sbory → Seznam členů. Po provedení ji zapište i do evidencesdh.cz.', 'okres/clenovesez'); } catch (e) { console.error(e); }
  return cleSbor_(sk);
}
function cleZrusit_(o, sk, id) {
  const t = cleTab_(LIST_ZMENY_CLENU), c = t.col, i = t.v.findIndex(r => String(r[c('ID')]) === id && String(r[c('Skupina')]) === sk);
  if (i < 0) return { ok: false, chyba: 'Změna nenalezena.' };
  if (t.v[i][c('Stav')] !== 'podáno') return { ok: false, chyba: 'Změna je už vyřízená.' };
  t.v[i][c('Stav')] = 'zrušeno'; t.v[i][c('Upraveno')] = new Date(); t.v[i][c('Upravil')] = o.email;
  t.sh.getRange(i + 2, 1, 1, t.h.length).setValues([t.v[i]]);
  zaznamZmeny_(o.email, LIST_ZMENY_CLENU, id, 'upraveno', 'podáno', 'zrušeno');
  return cleSbor_(sk);
}
/** Okres: provést (zapíše do listu Členové) nebo zamítnout s důvodem. E-mail sboru. */
function cleRozhodnout_(o, req) {
  const roz = String(req.rozhodnuti || ''), pozn = String(req.poznamka || '').trim();
  const ch = kontrolaTextu_({ 'Poznámka': pozn }, { 'Poznámka': 500 }); if (ch) return { ok: false, chyba: ch };
  if (roz === 'zamítnout' && !pozn) return { ok: false, chyba: 'Napište sboru, proč změnu zamítáte.' };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  let z;
  try {
    const t = cleTab_(LIST_ZMENY_CLENU), c = t.col, i = t.v.findIndex(r => String(r[c('ID')]) === String(req.id || ''));
    if (i < 0) return { ok: false, chyba: 'Změna nenalezena.' };
    z = cleZmenaJson_(t.h.reduce((x, k, j) => (x[k] = t.v[i][j], x), {}));
    if (z.stav !== 'podáno') return { ok: false, chyba: 'Změna je už vyřízená (' + z.stav + ').' };
    if (roz === 'provést') {
      const m = cleTab_(), mc = m.col, j = m.v.findIndex(r => String(r[mc('ID')]) === z.clen);
      if (j < 0) return { ok: false, chyba: 'Člen už v seznamu není.' };
      const r = m.v[j];
      if (z.zmena === 'ukončit') r[mc('Aktivní')] = 'NE';
      else {
        const P = { jmeno: 'Jméno', prijmeni: 'Příjmení', pohlavi: 'Pohlaví', obec: 'Obec', ev: 'Evidenční číslo' };
        Object.keys(P).forEach(k => { if (z.pole[k]) r[mc(P[k])] = bezVzorce_(z.pole[k]); });
        if (z.pole.narozen) { r[mc('Datum narození')] = new Date(z.pole.narozen + 'T00:00:00'); r[mc('Kategorie')] = cleKategorie_(z.pole.narozen); }
      }
      r[mc('Aktualizováno')] = new Date();
      m.sh.getRange(j + 2, 1, 1, m.h.length).setValues([r]);
      zaznamZmeny_(o.email, LIST_CLENOVE, z.clen, 'upraveno', '', z.zmena === 'ukončit' ? 'ukončeno členství' : 'oprava: ' + Object.keys(z.pole).map(k => CLE_POPIS_POLI[k]).join(', '));
    } else if (roz !== 'zamítnout') return { ok: false, chyba: 'Neznámé rozhodnutí.' };
    const ted = new Date();
    t.v[i][c('Stav')] = roz === 'provést' ? 'provedeno' : 'zamítnuto'; t.v[i][c('Vyřídil')] = o.email; t.v[i][c('Vyřízeno')] = ted;
    t.v[i][c('Poznámka')] = bezVzorce_(pozn); t.v[i][c('Upraveno')] = ted; t.v[i][c('Upravil')] = o.email;
    t.sh.getRange(i + 2, 1, 1, t.h.length).setValues([t.v[i]]);
    zaznamZmeny_(o.email, LIST_ZMENY_CLENU, z.id, 'upraveno', 'podáno', t.v[i][c('Stav')]);
  } finally { lock.releaseLock(); }
  try { prhPosta_(z.skupina, (roz === 'provést' ? 'Změna člena provedena: ' : 'Změna člena zamítnuta: ') + z.jmeno,
    roz === 'provést' ? 'Okres provedl změnu u člena ' + z.jmeno + ' (' + (z.zmena === 'ukončit' ? 'ukončení členství' : 'oprava údajů') + ').' : 'Okres změnu u člena ' + z.jmeno + ' zamítl. Důvod: ' + pozn,
    'sbor/' + z.skupina + '/seznam'); } catch (e) { console.error(e); }
  return cleOkres_();
}

/* ---------- import exportu z evidencesdh.cz ---------- */

// sloupce exportu → pole (první shoda podle názvu hlavičky, bez diakritiky); z adresy jen obec, ulice, PSČ a další sloupce se nečtou
const CLE_IMPORT_SLOUPCE = [
  ['ev', /^(evidencni cislo|ev\.? ?c(islo)?\.?|cislo clena|cislo prukazu|cislo clenskeho prukazu)$/],
  ['narozen', /^datum narozeni$/], ['prijmeni', /^prijmeni$/], ['jmeno', /^jmeno$/], ['pohlavi', /^pohlavi$/],
  ['sbor', /^(sdh|sbor|nazev sdh|nazev sboru|pobocny spolek|organizacni jednotka)$/], ['ico', /^ico( sdh| sboru)?$/],
  ['clenemOd', /^(datum vstupu|clenem od|datum vzniku clenstvi|vznik clenstvi|datum prijeti)$/], ['rc', /^rodne cislo$/], ['stav', /^(stav|stav clenstvi|aktivni)$/],
  ['obec', /^(mesto|obec|mesto, obec|mesto \/ obec|bydliste|bydliste \(mesto, obec\))$/]]; // z adresy jen obec – ulice a PSČ se nečtou

/** Soubor ve složce CLENOVE_IMPORT_SLOZKA → řádky (pole objektů s klíči z CLE_IMPORT_SLOUPCE). XLSX / XLS se převede na dočasnou tabulku Google. */
function cleImportCist_() {
  const zadano = String(nastaveniWeb_('CLENOVE_IMPORT_SLOZKA') || '').trim();
  if (!zadano) throw new Error('Doplňte v listu Nastavení CLENOVE_IMPORT_SLOZKA = odkaz nebo ID složky Import/ na sdíleném disku (přístup jen okres).');
  const idSlozky = (zadano.match(/[-\w]{25,}/) || [zadano])[0];
  let slozka; try { slozka = DriveApp.getFolderById(idSlozky); } catch (e) { throw new Error('Složku CLENOVE_IMPORT_SLOZKA nevidí účet ' + Session.getEffectiveUser().getEmail() + '. Zkontrolujte ID v Nastavení a přístup ke sdílenému disku.'); }
  const soubory = []; const it = slozka.getFiles(); while (it.hasNext()) soubory.push(it.next());
  const vhodne = soubory.filter(f => /\.(xlsx|xls|csv)$/i.test(f.getName()) || f.getMimeType() === MimeType.GOOGLE_SHEETS).sort((a, b) => b.getLastUpdated() - a.getLastUpdated());
  if (!vhodne.length) throw new Error('Ve složce Import/ není žádný export (XLSX, CSV nebo tabulka Google).');
  if (vhodne.length > 1) throw new Error('Ve složce Import/ je víc souborů (' + vhodne.map(f => f.getName()).join(', ') + '). Nechte tam jen jeden export.');
  const f = vhodne[0];
  let hodnoty, docasna = null;
  if (/\.csv$/i.test(f.getName())) {
    const b = f.getBlob(); let text = b.getDataAsString('UTF-8'); if (/�/.test(text)) text = b.getDataAsString('windows-1250');
    const odd = (text.split('\n')[0].match(/;/g) || []).length >= (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    hodnoty = Utilities.parseCsv(text.replace(/^﻿/, ''), odd);
  } else {
    let ss;
    if (f.getMimeType() === MimeType.GOOGLE_SHEETS) ss = SpreadsheetApp.openById(f.getId());
    else { docasna = Drive.Files.copy({ name: 'import-clenu-docasne', mimeType: MimeType.GOOGLE_SHEETS, parents: [idSlozky] }, f.getId(), { supportsAllDrives: true }); ss = SpreadsheetApp.openById(docasna.id); }
    const list = ss.getSheets().find(sh => { const v = sh.getRange(1, 1, Math.min(10, Math.max(1, sh.getLastRow())), Math.max(1, sh.getLastColumn())).getValues(); return v.some(r => r.some(x => /eviden/i.test(String(x))) && r.some(x => /p[řr][íi]jmen/i.test(String(x)))); }) || ss.getSheets()[0];
    hodnoty = list.getDataRange().getValues();
  }
  try {
    const hi = hodnoty.slice(0, 10).findIndex(r => r.some(x => /eviden/i.test(String(x))) && r.some(x => /p[řr][íi]jmen/i.test(String(x))));
    if (hi < 0) throw new Error('V souboru ' + f.getName() + ' jsem nenašel řádek s hlavičkou (Evidenční číslo, Příjmení…).');
    const hl = hodnoty[hi].map(x => cleBezDiakritiky_(x).replace(/\s+/g, ' ').trim()), mapa = {};
    CLE_IMPORT_SLOUPCE.forEach(([k, re]) => { const i = hl.findIndex(x => re.test(x)); if (i >= 0) mapa[k] = i; });
    ['ev', 'prijmeni', 'jmeno', 'sbor'].forEach(k => { if (mapa[k] == null) throw new Error('V exportu chybí sloupec pro ' + ({ ev: 'Evidenční číslo', prijmeni: 'Příjmení', jmeno: 'Jméno', sbor: 'SDH' })[k] + '.'); });
    if (mapa.narozen == null && mapa.rc == null) throw new Error('V exportu chybí Datum narození.');
    const radky = hodnoty.slice(hi + 1).filter(r => r.some(x => x !== '')).map(r => { const x = {}; Object.keys(mapa).forEach(k => { x[k] = r[mapa[k]]; }); return x; });
    return { soubor: f, radky: radky, sloupce: Object.keys(mapa).filter(k => k !== 'rc') };
  } finally { if (docasna) try { Drive.Files.remove(docasna.id, { supportsAllDrives: true }); } catch (e) { console.error('Dočasná tabulka importu: ' + e.message); } }
}

/** Sbory pro párování: název bez „SDH“, IČO a ruční přiřazení z Nastavení CLENOVE_IMPORT_ALIASY („název v exportu = SDH Název; …“). */
function cleSboryMapa_() {
  const m = { nazev: {}, ico: {} };
  radkyRychle_('Sbory').filter(r => r['Sbor'] && String(r['Aktivní'] || '').trim().toUpperCase() !== 'NE').forEach(r => {
    const s = { sbor: String(r['Sbor']), skupina: String(r['Skupina'] || '').split('@')[0].toLowerCase() };
    m.nazev[cleNormSbor_(r['Sbor'])] = s; const ico = String(r['IČO'] || '').replace(/\D/g, ''); if (ico) m.ico[ico] = s;
  });
  String(nastaveniWeb_('CLENOVE_IMPORT_ALIASY') || '').split(/[;\n]+/).forEach(a => { const p = a.split('='); if (p.length !== 2) return; const cil = m.nazev[cleNormSbor_(p[1])]; if (cil) m.nazev[cleNormSbor_(p[0])] = cil; });
  return m;
}

/**
 * Import (spouští Správce z aplikace nebo menu OSH data): páruje podle evidenčního čísla, aktualizuje, nic nezdvojí.
 * Kdo v exportu chybí (ve sboru, který v exportu je), dostane Aktivní = NE – kromě čerstvě zapsaných z přihlášky / přestupu.
 * Nespárované sbory a vadné řádky jdou do zprávy (bez jmen – jen počty a názvy sborů). Soubor pak do koše. Do Záznamu změn jen počty.
 */
function cleImport_(kdo) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const vstup = cleImportCist_(), S = cleSboryMapa_(), t = cleTab_(), c = t.col, ted = new Date();
    const podleEv = {}; t.v.forEach((r, i) => { const ev = String(r[c('Evidenční číslo')]).trim(); if (ev) podleEv[ev] = i; });
    const nesparovane = {}, vadne = { ev: 0, datum: 0, duplicita: 0 }, videno = {}, sboryVExportu = {};
    let nove = 0, upravene = 0, beze = 0;
    const pridat = [];
    vstup.radky.forEach(x => {
      const ev = String(x.ev == null ? '' : x.ev).replace(/\.0$/, '').trim();
      if (!/^[\w\/-]{1,20}$/.test(ev)) { vadne.ev++; return; }
      if (videno[ev]) { vadne.duplicita++; return; }
      const ico = String(x.ico || '').replace(/\D/g, ''), s = (ico && S.ico[ico]) || S.nazev[cleNormSbor_(x.sbor)];
      if (!s) { const k = String(x.sbor || '(prázdné)').trim(); nesparovane[k] = (nesparovane[k] || 0) + 1; return; }
      const zRc = x.rc ? cleZRodnehoCisla_(x.rc) : null; // jen datum a pohlaví – rodné číslo se nikam nepíše
      const narozen = cleDen_(x.narozen) || (zRc ? zRc.narozen : '');
      if (!narozen) vadne.datum++;
      const pohlavi = clePohlavi_(x.pohlavi) || (zRc ? zRc.pohlavi : '');
      const aktivni = !x.stav || !/ukon|zrus|vystoup|zemrel|ne$/.test(cleBezDiakritiky_(x.stav));
      videno[ev] = true; sboryVExportu[s.skupina] = true;
      const i = podleEv[ev], r = i != null ? t.v[i] : t.h.map(() => ''), set = (k, v) => { if (c(k) >= 0) r[c(k)] = v; };
      const pred = i != null ? JSON.stringify([r[c('Sbor')], r[c('Jméno')], r[c('Příjmení')], cleDen_(r[c('Datum narození')]), r[c('Pohlaví')], r[c('Aktivní')], cleDen_(r[c('Členem od')]), c('Obec') >= 0 ? r[c('Obec')] : '']) : '';
      if (i == null) set('ID', cleNoveId_());
      set('Sbor', s.sbor); set('Skupina', s.skupina); set('Jméno', bezVzorce_(String(x.jmeno || '').trim())); set('Příjmení', bezVzorce_(String(x.prijmeni || '').trim()));
      set('Datum narození', narozen ? new Date(narozen + 'T00:00:00') : ''); set('Pohlaví', pohlavi); set('Kategorie', cleKategorie_(narozen));
      set('Evidenční číslo', ev); const od = cleDen_(x.clenemOd); if (od) set('Členem od', new Date(od + 'T00:00:00'));
      if (x.obec != null && String(x.obec).trim()) set('Obec', bezVzorce_(String(x.obec).trim().slice(0, 80)));
      set('Aktivní', aktivni ? 'ANO' : 'NE'); set('Zdroj', 'evidence');
      const po = JSON.stringify([r[c('Sbor')], r[c('Jméno')], r[c('Příjmení')], narozen, r[c('Pohlaví')], r[c('Aktivní')], cleDen_(r[c('Členem od')]), c('Obec') >= 0 ? r[c('Obec')] : '']);
      if (i == null) { set('Aktualizováno', ted); pridat.push(r); nove++; }
      else if (pred !== po) { set('Aktualizováno', ted); upravene++; } else beze++;
    });
    if (!Object.keys(videno).length) throw new Error('V exportu není žádný člen, kterého by šlo přiřadit ke sboru. Nic jsem nezměnil.' + (Object.keys(nesparovane).length ? ' Nespárované sbory: ' + Object.keys(nesparovane).join(', ') + '.' : ''));
    // chybí v exportu → neaktivní (jen sbory, které v exportu jsou; čerstvě zapsané z přihlášky a přestupu nechat)
    let ukonceno = 0, ponechano = 0;
    const hranice = new Date(Date.now() - CLE_NOVY_ZAPIS_DNY * 864e5);
    t.v.forEach(r => {
      const ev = String(r[c('Evidenční číslo')]).trim();
      if (!sboryVExportu[String(r[c('Skupina')])] || videno[ev] || String(r[c('Aktivní')]).toUpperCase() === 'NE' || r[c('Zdroj')] === 'test') return;
      if (['přihláška', 'přestup'].indexOf(String(r[c('Zdroj')])) >= 0 && r[c('Aktualizováno')] instanceof Date && r[c('Aktualizováno')] > hranice) { ponechano++; return; }
      r[c('Aktivní')] = 'NE'; r[c('Aktualizováno')] = ted; ukonceno++;
    });
    if (t.v.length) t.sh.getRange(2, 1, t.v.length, t.h.length).setValues(t.v);
    if (pridat.length) t.sh.getRange(t.sh.getLastRow() + 1, 1, pridat.length, t.h.length).setValues(pridat);
    const nazev = vstup.soubor.getName();
    let smazano = false; try { vstup.soubor.setTrashed(true); smazano = true; } catch (e) { console.error('Soubor exportu do koše: ' + e.message); }
    const nesp = Object.keys(nesparovane).map(k => k + ' (' + nesparovane[k] + ')');
    const souhrn = 'Import z evidence: nových ' + nove + ', upravených ' + upravene + ', beze změny ' + beze + ', ukončených (chybí v exportu) ' + ukonceno +
      (ponechano ? ', čerstvě zapsaných ponecháno ' + ponechano : '') + (nesp.length ? ', nespárovaných řádků ' + Object.keys(nesparovane).reduce((n, k) => n + nesparovane[k], 0) : '');
    zaznamZmeny_(kdo, LIST_CLENOVE, '', 'import', '', souhrn);
    const zprava = [souhrn + '.',
      'Sbory v exportu: ' + Object.keys(sboryVExportu).length + '. Načtené sloupce: ' + vstup.sloupce.join(', ') + ' (z adresy jen obec – ulice a PSČ se nečtou, rodné číslo jen pro datum a pohlaví).',
      nesp.length ? 'Nespárované sbory (doplňte Nastavení CLENOVE_IMPORT_ALIASY ve tvaru „název v exportu = SDH Název“ a import spusťte znovu): ' + nesp.join(', ') + '.' : 'Všechny sbory spárované.',
      vadne.ev || vadne.duplicita ? 'Vynechané řádky: bez platného evidenčního čísla ' + vadne.ev + ', opakované číslo ' + vadne.duplicita + '.' : '',
      vadne.datum ? 'Bez data narození (do soutěží je nepůjde vybrat): ' + vadne.datum + '.' : '',
      smazano ? 'Soubor „' + nazev + '“ je v koši sdíleného disku – vysypte ho, nebo se smaže sám do 30 dní.' : 'Soubor „' + nazev + '“ se nepodařilo smazat – smažte ho prosím ve složce Import/ ručně.'].filter(Boolean);
    return { ok: true, zprava: zprava, pocty: { nove, upravene, beze, ukonceno, ponechano }, nesparovane: nesp };
  } finally { lock.releaseLock(); }
}
/** Menu OSH data / editor: import exportu členů (jen pro správce – kdo otevře skript nebo tabulku). */
function importEvidence() {
  const v = cleImport_(Session.getActiveUser().getEmail() || 'import');
  const text = v.zprava.join('\n'); console.log(text);
  try { SpreadsheetApp.getUi().alert('Import členů z evidence', text, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {}
  return text;
}

/* ---------- soupiska družstva (volá Souteze.gs) ---------- */

/**
 * Kontrola a doplnění soupisky: položky { clen: ID } doplní ze seznamu členů sboru (jméno, datum narození, ev. číslo, pohlaví),
 * ruční položky { jmeno, prijmeni, narozen, pohlavi, obec, ev, host } označí mimo = 1 („není v evidenci“). Věk a pohlaví podle cleRozsah_,
 * počet nejvýš max, nikdo dvakrát v družstvu ani ve dvou družstvech téže kategorie (ZHVB: v celé soutěži).
 * jine = soupisky ostatních přihlášek soutěže [{ kat, druzstvo, soupiska }]. → { chyba } nebo { soupiska, mimo }
 */
function cleSoupiska_(s, kat, skupina, vstup, jine) {
  if (!Array.isArray(vstup)) return { soupiska: [], mimo: 0 };
  const R = cleRozsah_(s, kat), clenove = {}, vysl = [], klice = {};
  if (vstup.length > R.max) return { chyba: 'Soupiska má nejvýš ' + R.max + (R.max === 1 ? ' závodníka.' : ' členů.') };
  if (vstup.some(x => x && x.clen)) cleClenove_(skupina).forEach(c => { clenove[c.id] = c; });
  for (let i = 0; i < vstup.length; i++) {
    const x = vstup[i] || {};
    let p;
    if (x.clen) {
      const c = clenove[String(x.clen)];
      if (!c || !c.aktivni) return { chyba: 'Člen na ' + (i + 1) + '. místě není v seznamu vašeho sboru.' };
      p = { clen: c.id, jmeno: c.jmeno, prijmeni: c.prijmeni, narozen: c.narozen, pohlavi: c.pohlavi, obec: c.obec, ev: c.ev };
    } else {
      p = { jmeno: String(x.jmeno || '').trim(), prijmeni: String(x.prijmeni || '').trim(), narozen: cleDen_(x.narozen), pohlavi: ['muž', 'žena'].indexOf(x.pohlavi) >= 0 ? x.pohlavi : '',
        obec: String(x.obec || '').trim(), ev: String(x.ev || '').trim(), mimo: 1, host: String(x.host || '').trim() };
      const ch = kontrolaTextu_({ 'Jméno': p.jmeno, 'Příjmení': p.prijmeni, 'Obec': p.obec, 'Evidenční číslo': p.ev, 'Sbor': p.host }, { 'Jméno': 60, 'Příjmení': 60, 'Obec': 80, 'Evidenční číslo': 20, 'Sbor': 80 });
      if (ch) return { chyba: ch };
      if (!p.jmeno || !p.prijmeni || !p.narozen) return { chyba: 'U člena mimo seznam na ' + (i + 1) + '. místě vyplňte jméno, příjmení a datum narození.' };
    }
    const duv = clePosoudit_(p, R);
    if (duv) return { chyba: p.jmeno + ' ' + p.prijmeni + ': ' + duv + '.' };
    const k = p.clen || cleKlicOsoby_(p.jmeno, p.prijmeni, p.narozen);
    if (klice[k]) return { chyba: p.jmeno + ' ' + p.prijmeni + ' je v soupisce dvakrát.' };
    klice[k] = true;
    const jinde = (jine || []).find(d => (R.jednouVKole || d.kat === kat) && (d.soupiska || []).some(y => (y.clen || cleKlicOsoby_(y.jmeno, y.prijmeni, y.narozen)) === k));
    if (jinde) return { chyba: p.jmeno + ' ' + p.prijmeni + ' už je v ' + (R.jednouVKole ? 'soutěži' : 'kategorii ' + kat) + ' v družstvu ' + jinde.druzstvo + (R.jednouVKole ? ' – v ZHVB smí závodník v kole startovat jen jednou.' : '.') };
    Object.keys(p).forEach(z => { if (p[z] === '' || p[z] == null) delete p[z]; });
    vysl.push(p);
  }
  if (R.smiseny && vysl.length >= R.min && !(vysl.some(p => p.pohlavi === 'žena') && vysl.some(p => p.pohlavi === 'muž'))) return { chyba: 'Smíšená hlídka musí mít dívky i chlapce.' };
  return { soupiska: vysl, mimo: vysl.filter(p => p.mimo).length };
}
/** Pro okres: u členů mimo seznam sboru dohledá, jestli jsou v seznamu jiného sboru (jen poznámka pro okres, sbor ji nevidí). */
function cleSoupiskaOkres_(soupiska) {
  if (!soupiska.some(p => p.mimo)) return soupiska;
  const m = {}; cleClenove_(null).forEach(c => { if (c.aktivni) m[cleKlicOsoby_(c.jmeno, c.prijmeni, c.narozen)] = c; });
  return soupiska.map(p => { if (!p.mimo) return p; const c = m[cleKlicOsoby_(p.jmeno, p.prijmeni, p.narozen)]; return Object.assign({}, p, { nalezen: c ? c.sbor + (c.ev ? ' · ev. č. ' + c.ev : '') : '' }); });
}

/* ---------- noční údržba ---------- */

/** Neaktivní členy smaže po CLENOVE_VYMAZ_DNY (365) od poslední změny; soupisky soutěží po skončení ročníku (31. 8.); vyřízené změny členů po roce. */
function cleUdrzba_() {
  const ss = dataSs_(), dnes = new Date(), zpravy = [];
  if (ss.getSheetByName(LIST_CLENOVE)) {
    const dny = Number(nastaveniWeb_('CLENOVE_VYMAZ_DNY') || 365) || 365, hr = new Date(Date.now() - dny * 864e5), t = cleTab_(), c = t.col;
    for (let i = t.v.length - 1; i >= 0; i--) {
      const r = t.v[i];
      if (String(r[c('Aktivní')]).toUpperCase() === 'NE' && r[c('Aktualizováno')] instanceof Date && r[c('Aktualizováno')] < hr) { t.sh.deleteRow(i + 2); zpravy.push('člen'); }
    }
  }
  if (ss.getSheetByName(LIST_ZMENY_CLENU)) {
    const t = cleTab_(LIST_ZMENY_CLENU), c = t.col, hr = new Date(Date.now() - 365 * 864e5);
    for (let i = t.v.length - 1; i >= 0; i--) if (t.v[i][c('Stav')] !== 'podáno' && t.v[i][c('Upraveno')] instanceof Date && t.v[i][c('Upraveno')] < hr) { t.sh.deleteRow(i + 2); zpravy.push('změna'); }
  }
  // soupisky: ročník soutěže skončil (31. 8. po konání) → jména pryč, družstvo zůstává
  const sh = ss.getSheetByName(LIST_DRUZSTVA);
  if (sh && sh.getLastRow() > 1) {
    const h = hlavicka_(sh), cs = h.indexOf('Soupiska'), cm = h.indexOf('Mimo evidenci'), ca = h.indexOf('Akce – ID');
    if (cs >= 0) {
      const od = {}; radky_('Akce').forEach(a => { od[String(a['ID'])] = a['Od']; });
      const rng = sh.getRange(2, 1, sh.getLastRow() - 1, h.length), v = rng.getValues(); let n = 0;
      v.forEach(r => {
        if (!r[cs]) return; const d = od[String(r[ca])]; if (!(d instanceof Date)) return;
        const konec = new Date((d.getMonth() >= 8 ? d.getFullYear() + 1 : d.getFullYear()) + '-09-01T00:00:00');
        if (dnes >= konec) { r[cs] = ''; if (cm >= 0) r[cm] = ''; n++; }
      });
      if (n) { rng.setValues(v); zpravy.push(n + ' soupisek'); }
    }
  }
  if (zpravy.length) zaznamZmeny_('noční údržba', LIST_CLENOVE, '', 'smazáno', '', 'členové ' + zpravy.filter(z => z === 'člen').length + ', změny ' + zpravy.filter(z => z === 'změna').length + (zpravy.find(z => /soupisek/.test(z)) ? ', ' + zpravy.find(z => /soupisek/.test(z)) : ''));
  return zpravy.length;
}

/* ---------- test (jen režim TEST) ---------- */

const CLE_TEST_SBORY = 3, CLE_TEST_ROKY = [2021, 2019, 2017, 2015, 2014, 2013, 2012, 2011, 2010, 2009, 2008, 1995, 1980];
/** Smyšlení členové pro 3 sbory (různé ročníky od přípravky po dospělé, dívky i chlapci). ID s „TEST“ – uklidí je Úklid testů. Jen v režimu TEST. */
function vlozitTestyClenu() {
  if (String(nastaveniWeb_('REZIM') || '').toUpperCase() !== 'TEST') throw new Error('Testovací členy jde vložit jen v režimu TEST.');
  const sbory = radkyRychle_('Sbory').filter(r => r['Sbor'] && r['Skupina'] && String(r['Aktivní'] || '').toUpperCase() !== 'NE').slice(0, CLE_TEST_SBORY);
  const K = SO_TEST_JMENA, t = cleTab_(), ted = new Date(), radky = [];
  sbory.forEach((s, si) => {
    CLE_TEST_ROKY.forEach((rok, i) => [0, 1].forEach(z => {
      const zena = z === 1, jm = (zena ? K.holky : K.kluci)[(i * 2 + si) % (zena ? K.holky : K.kluci).length], pr = K.prijmeni[(i + si * 5 + z * 3) % K.prijmeni.length][zena ? 1 : 0];
      const r = t.h.map(() => ''), set = (k, v) => { if (t.col(k) >= 0) r[t.col(k)] = v; }, narozen = rok + '-' + String((i % 12) + 1).padStart(2, '0') + '-' + String(10 + si + z).padStart(2, '0');
      set('ID', 'CTEST' + si + '-' + i + '-' + z); set('Sbor', String(s['Sbor'])); set('Skupina', String(s['Skupina']).split('@')[0].toLowerCase());
      set('Jméno', jm); set('Příjmení', pr); set('Datum narození', new Date(narozen + 'T00:00:00'));
      set('Pohlaví', zena ? 'žena' : 'muž'); set('Obec', ['Ukázkov', 'Vzorová Lhota', 'Příkladov'][si % 3]); set('Kategorie', cleKategorie_(narozen)); set('Evidenční číslo', '9' + String(si) + String(i).padStart(2, '0') + z + '00TEST');
      set('Členem od', new Date('2024-01-15T00:00:00')); set('Aktivní', 'ANO'); set('Zdroj', 'test'); set('Aktualizováno', ted);
      radky.push(r);
    }));
  });
  // opakované spuštění přepíše stejné řádky (ID), nic nezdvojí
  const kde = {}; t.v.forEach((r, i) => { kde[String(r[t.col('ID')])] = i; });
  const nove = radky.filter(r => { const i = kde[r[t.col('ID')]]; if (i == null) return true; t.sh.getRange(i + 2, 1, 1, t.h.length).setValues([r]); return false; });
  if (nove.length) t.sh.getRange(t.sh.getLastRow() + 1, 1, nove.length, t.h.length).setValues(nove);
  const text = 'Vloženo ' + radky.length + ' testovacích členů do sborů ' + sbory.map(s => s['Sbor']).join(', ') + ' (ročníky ' + CLE_TEST_ROKY.join(', ') + ', dívky i chlapci). Uklidí je „Úklid testů“.';
  console.log(text); try { SpreadsheetApp.getActive().toast(text, 'Testovací členové', 15); } catch (e) {}
  return text;
}
/** Ukázkový export (smyšlená data, stejné sloupce jako export z evidencesdh.cz včetně adresy, kterou import nesmí převzít) do složky Import/. Jen TEST. */
function vytvoritUkazkovyExport() {
  if (String(nastaveniWeb_('REZIM') || '').toUpperCase() !== 'TEST') throw new Error('Ukázkový export jde vytvořit jen v režimu TEST.');
  const zadano = String(nastaveniWeb_('CLENOVE_IMPORT_SLOZKA') || '').trim(); if (!zadano) throw new Error('Doplňte v Nastavení CLENOVE_IMPORT_SLOZKA.');
  const sbory = radkyRychle_('Sbory').filter(r => r['Sbor'] && r['Skupina']).slice(0, CLE_TEST_SBORY), K = SO_TEST_JMENA;
  const out = [['Evidenční číslo', 'Datum narození', 'Příjmení', 'Jméno', 'Pohlaví', 'SDH', 'okrsek', 'Ulice', 'Město', 'PSČ', 'Datum vstupu']];
  sbory.forEach((s, si) => CLE_TEST_ROKY.forEach((rok, i) => {
    const zena = i % 3 === 0, nazev = String(s['Sbor']).replace(/^SDH\s+/i, '');
    out.push(['9' + si + String(i).padStart(2, '0') + '000' + (zena ? 1 : 0), (i % 27 + 1) + '.' + (i % 12 + 1) + '.' + rok, K.prijmeni[(i + si) % K.prijmeni.length][zena ? 1 : 0], (zena ? K.holky : K.kluci)[i % 10],
      zena ? 'žena' : 'muž', nazev, 'Okrsek č. ' + String(s['Okrsek'] || 1).padStart(2, '0'), 'Ukázková ' + (i + 1), 'Ukázkov', '25000', '1.3.2020']);
  }));
  out.push(['9999000099', '1.1.2000', 'Mimookresní', 'Petr', 'muž', 'Neexistující Lhota', 'Okrsek č. 99', 'Ukázková 1', 'Ukázkov', '25000', '1.1.2020']);
  const csv = out.map(r => r.map(x => /[;"]/.test(x) ? '"' + String(x).replace(/"/g, '""') + '"' : x).join(';')).join('\r\n');
  const f = DriveApp.getFolderById((zadano.match(/[-\w]{25,}/) || [zadano])[0]).createFile(Utilities.newBlob('﻿' + csv, 'text/csv', 'ukazkovy-export-clenu.csv'));
  const text = 'Ukázkový export (' + (out.length - 1) + ' smyšlených členů, 1 řádek s neexistujícím sborem) je ve složce Import/ jako ' + f.getName() + '. Spusťte import.';
  console.log(text); try { SpreadsheetApp.getActive().toast(text, 'Ukázkový export', 15); } catch (e) {}
  return text;
}
