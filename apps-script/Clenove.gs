/**
 * OSH data – Lidé sborů (B17, přestavba 25. 11. 2026): interní seznam lidí každého sboru pro přihlášky na soutěže a školení.
 *
 * Rozhodnutí starosty OSH (dotazník 25. 11. 2026, docs/b17-lide-sboru.md): aplikace NESMÍ přebírat export z evidence SH ČMS (evidencesdh.cz)
 *   ani vést okresní seznam členů. Seznam je **interní věc sboru** – vidí ho a mění jen daný sbor (pohledSboru_), okres nemá žádné čtení přes sbory.
 *   Každý záznam vzniká aktivním krokem sboru (ručně, nebo tlačítkem „Přidat do seznamu“ u zapsané přihlášky / provedeného přestupu – lidePrekopirovat).
 *   Nikdy automaticky. Jen údaje z přihlášek: jméno, příjmení, datum narození, pohlaví, obec, číslo průkazu (nepovinné, nepáruje se), vztah ke sboru.
 *   Rodné číslo ani adresa se NIKDY neukládají; z udaje.json přihlášky se nečte nic.
 * Odpovědnost: sbor je správcem údajů, okres provozovatelem – před prvním použitím sbor potvrdí poučení (Sbory › Lidé – poučení), bez něj zápisy nejdou.
 * Soupiska družstva (Souteze.gs, sloupec Soupiska v listu Přihlášky družstev): výběr lidí podle věku a pohlaví – cleRozsah_ / clePosoudit_ mají kopii
 *   v soupiska.js (prohlížeč) – měnit obě. Položka nese vztah (z listu) nebo rucne = 1 (zadáno rovnou v přihlášce); sloupec Nečlenů = počet lidí,
 *   kteří nejsou členy přihlašujícího sboru. Okres vidí jen to, co mu sbor v přihlášce pošle.
 * Noční údržba (cleUdrzba_): záznam nepoužitý CLENOVE_VYMAZ_DNY (730) od posledního použití se smaže, CLENOVE_UPOZORNIT_DNY (30) předem e-mail sboru;
 *   soupisky po skončení ročníku soutěže (31. 8.).
 */

const LIST_CLENOVE = 'Lidé sborů';
const CLE_VZTAHY = ['člen sboru', 'člen jiného SDH', 'nečlen'];
const CLE_ZDROJE = ['ručně', 'z přihlášky', 'z přestupu', 'test'];

/* ---------- datum, kategorie, porovnání jmen ---------- */

/** Datum z tabulky nebo aplikace → 'yyyy-MM-dd' ('' když nejde přečíst). Číslo = sériové datum tabulky. */
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
/** Kategorie v seznamu: věk k 1. 9. právě běžícího ročníku (do 15 let mladý hasič, 15–17 dorost, od 18 dospělý). Soutěže mají vlastní pravidla (cleRozsah_). */
function cleKategorie_(narozen, dnes) {
  const d = cleDen_(narozen); if (!d) return '';
  const t = dnes || new Date(), r0 = t.getMonth() >= 8 ? t.getFullYear() : t.getFullYear() - 1; // ročník začíná 1. 9.
  const y = Number(d.slice(0, 4)), md = d.slice(5);
  const vek = r0 - y - (md > '09-01' ? 1 : 0);
  return vek < 15 ? 'mladý hasič' : vek < 18 ? 'dorost' : 'dospělý';
}
const cleBezDiakritiky_ = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** Název sboru pro párování (Skoleni.gs – import kvalifikací): bez „SDH“ / „Sbor dobrovolných hasičů“, diakritiky, teček a mezer navíc. */
const cleNormSbor_ = t => cleBezDiakritiky_(t).replace(/^\s*(sdh|sbor dobrovolnych hasicu)\s+/, '').replace(/[.,\-–]+/g, ' ').replace(/\s+/g, ' ').trim();
const cleKlicOsoby_ = (j, p, n) => [cleBezDiakritiky_(j).trim(), cleBezDiakritiky_(p).trim(), cleDen_(n)].join('|');
const cleDatumCz_ = iso => { const d = cleDen_(iso); return d ? Number(d.slice(8)) + '. ' + Number(d.slice(5, 7)) + '. ' + d.slice(0, 4) : ''; };

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
  if (!dosp) nejmladsi = jednotlivci && /dorost/.test(k) && !zOz ? E - 15 : zOz && jednotlivci ? nejmladsi : null; // mládež: družstvo smí doplnit mladší; jednotlivec dorostu musí mít aspoň 15 let v roce konce ročníku
  const v = CLE_VELIKOST[s.druh] || [5, 10];
  const min = jednotlivci ? 1 : Number(oz.min) || v[0], max = jednotlivci ? 1 : Math.max(Number(oz.max) || v[1], Number(oz.min) || 0);
  return { E: E, rokSoutez: rokSoutez, nejstarsi: nejstarsi, nejmladsi: nejmladsi, vek: vek, zOz: zOz, dosp: dosp, pohlavi: pohlavi, smiseny: /smíšen/.test(k),
    jednotlivci: jednotlivci, min: Math.min(min, max), max: max, jednouVKole: s.druh === 'ZHVB' };
}
/** Důvod, proč člověk do kategorie nesmí ('' = smí). c = { narozen: 'yyyy-MM-dd', pohlavi }. */
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

/* ---------- čtení a zápis listu Lidé sborů ---------- */

function cleTab_() {
  const sh = dataSs_().getSheetByName(LIST_CLENOVE);
  if (!sh) throw new Error('Chybí list „' + LIST_CLENOVE + '“ – okres musí v tabulce OSH data spustit Založit / doplnit strukturu.');
  const h = hlavicka_(sh), col = k => h.indexOf(k);
  const v = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues() : [];
  return { sh, h, col, v };
}
const cleIso_ = v => v instanceof Date && !isNaN(v) ? v.toISOString() : '';
/** Řádek listu → objekt pro aplikaci. `ev` = číslo členského průkazu (nepovinné, netiskne se nikam jinam než do přihlášek). */
function cleJson_(r) {
  const vztah = CLE_VZTAHY.indexOf(r['Vztah']) >= 0 ? r['Vztah'] : 'člen sboru';
  return { id: String(r['ID']), sbor: String(r['Sbor'] || ''), skupina: String(r['Skupina'] || ''), jmeno: String(r['Jméno'] || ''), prijmeni: String(r['Příjmení'] || ''),
    narozen: cleDen_(r['Datum narození']), pohlavi: String(r['Pohlaví'] || ''), obec: String(r['Obec'] || ''), kategorie: cleKategorie_(r['Datum narození']) || String(r['Kategorie'] || ''),
    ev: String(r['Číslo průkazu'] || ''), vztah: vztah, jinySbor: vztah === 'člen jiného SDH' ? String(r['Jiný sbor'] || '') : '', zdroj: String(r['Zdroj'] || ''),
    pridal: String(r['Přidal'] || ''), pridano: cleIso_(r['Přidáno']), pouzito: cleIso_(r['Naposledy použito']), aktualizovano: cleIso_(r['Aktualizováno']) };
}
/** Lidé jednoho sboru (skupina sdh-…). Bez skupiny nejde – seznam přes všechny sbory nesmí existovat (pravidlo 2). */
function cleClenove_(skupina) {
  if (!skupina) throw new Error('cleClenove_: seznam lidí je jen pro jeden sbor (chybí skupina).');
  if (!dataSs_().getSheetByName(LIST_CLENOVE)) return [];
  return radky_(LIST_CLENOVE).filter(r => r['ID'] && String(r['Skupina']) === skupina).map(cleJson_)
    .sort((a, b) => a.prijmeni.localeCompare(b.prijmeni, 'cs') || a.jmeno.localeCompare(b.jmeno, 'cs'));
}
function cleNoveId_() { return 'L' + Utilities.formatDate(new Date(), 'Europe/Prague', 'yyMMddHHmmss') + Math.floor(Math.random() * 9000 + 1000); }
function cleSboryPodleSkupiny_() {
  const m = {}; radkyRychle_('Sbory').forEach(r => { const sk = String(r['Skupina'] || '').split('@')[0].toLowerCase(); if (sk) m[sk] = String(r['Sbor']); }); return m;
}
/** Soupiska nebo přihláška na školení použila záznamy → Naposledy použito (a zruší případné upozornění na výmaz). Jen v rámci jednoho sboru. */
function clePouzito_(skupina, ids) {
  if (!skupina || !ids || !ids.length || !dataSs_().getSheetByName(LIST_CLENOVE)) return;
  try {
    const t = cleTab_(), c = t.col, ted = new Date(); if (c('Naposledy použito') < 0) return;
    t.v.forEach((r, i) => {
      if (String(r[c('Skupina')]) !== skupina || ids.indexOf(String(r[c('ID')])) < 0) return;
      t.sh.getRange(i + 2, c('Naposledy použito') + 1).setValue(ted);
      if (c('Upozorněno') >= 0) t.sh.getRange(i + 2, c('Upozorněno') + 1).setValue('');
    });
  } catch (e) { console.error('Naposledy použito: ' + e.message); }
}

/* ---------- poučení sboru (list Sbory) ---------- */

function clePouceniStav_(sk) {
  const r = radkyRychle_('Sbory').find(x => String(x['Skupina'] || '').split('@')[0].toLowerCase() === sk) || {};
  return { kdy: cleIso_(r['Lidé – poučení']), kdo: String(r['Lidé – poučení potvrdil'] || '') };
}
/** Sbor potvrdí poučení (správce údajů = sbor). Bez něj zápisové akce vrací chybu. */
function clePouceni_(o, u) {
  const sk = u.sbor.skupina;
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = dataSs_().getSheetByName('Sbory'), h = hlavicka_(sh), col = k => h.indexOf(k);
    if (col('Lidé – poučení') < 0) return { ok: false, chyba: 'V listu Sbory chybí sloupce poučení – okres musí spustit Založit / doplnit strukturu.' };
    const v = sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues(), i = v.findIndex(r => String(r[col('Skupina')] || '').toLowerCase().split('@')[0] === sk);
    if (i < 0) return { ok: false, chyba: 'Sbor nenalezen v listu Sbory.' };
    if (!(v[i][col('Lidé – poučení')] instanceof Date)) {
      sh.getRange(i + 2, col('Lidé – poučení') + 1).setValue(new Date());
      if (col('Lidé – poučení potvrdil') >= 0) sh.getRange(i + 2, col('Lidé – poučení potvrdil') + 1).setValue(o.email);
      vycistitMezipamet_('Sbory'); CacheService.getScriptCache().removeAll(['v_sbory', 'v_web']);
      zaznamZmeny_(o.email, 'Sbory', sk, 'upraveno', '', 'poučení k seznamu lidí sboru potvrzeno');
    }
  } finally { lock.releaseLock(); }
  return cleSbor_(u);
}

/* ---------- API (jen přihlášený sbor, pohledSboru_) ---------- */

function apiLide_(req) {
  const o = prihlaseny_(req.token);
  if (!o) return { ok: false, chyba: 'Nepřihlášen', odhlasen: true };
  const u = pohledSboru_(o, req.sbor);
  if (!u) return { ok: false, chyba: 'Ke sboru ' + (req.sbor || '(nevybrán)') + ' nemáte přístup.' };
  if (req.akce === 'lideSbor') return cteniJednou_(() => cleSbor_(u));
  if (req.akce === 'lidePouceni') return clePouceni_(o, u);
  if (!clePouceniStav_(u.sbor.skupina).kdy) return { ok: false, chyba: 'Nejdřív potvrďte poučení k seznamu lidí sboru.' };
  if (limit_('lide', o.email, 60, 3600)) return { ok: false, chyba: 'Příliš mnoho změn v seznamu za hodinu. Zkuste to později.' };
  if (req.akce === 'lideUlozit') return cleUlozit_(o, u, req.data || {});
  if (req.akce === 'lideSmazat') return cleSmazat_(o, u, String(req.id || ''));
  if (req.akce === 'lidePrekopirovat') return clePrekopirovat_(o, u, req);
  return { ok: false, chyba: 'Neznámá akce' };
}

/** Seznam sboru + kandidáti k převzetí (zapsané přihlášky a provedené přestupy do sboru, které v seznamu ještě nejsou) + stav poučení. */
function cleSbor_(u) {
  const sk = u.sbor.skupina, data = cleClenove_(sk);
  return { ok: true, data: data, kandidati: cleKandidati_(sk, data), pouceni: clePouceniStav_(sk) };
}
/** Z přihlášek a přestupů jen jméno, příjmení, datum narození a původ – nic z udaje.json. Do seznamu je sbor překopíruje sám (lidePrekopirovat). */
function cleKandidati_(sk, lide) {
  const je = {}; lide.forEach(c => { je[cleKlicOsoby_(c.jmeno, c.prijmeni, c.narozen)] = true; });
  const out = [], ss = dataSs_();
  if (ss.getSheetByName(LIST_PRIHLASKY)) radky_(LIST_PRIHLASKY).forEach(r => {
    if (!r['ID'] || String(r['Skupina']) !== sk || r['Stav'] !== 'zapsáno' || r['Údaje smazány']) return;
    if (je[cleKlicOsoby_(r['Jméno'], r['Příjmení'], r['Datum narození'])]) return;
    out.push({ zdroj: 'prihlaska', id: String(r['ID']), jmeno: String(r['Jméno'] || ''), prijmeni: String(r['Příjmení'] || ''), narozen: cleDen_(r['Datum narození']), kdy: cleDen_(r['Členem od'] || r['Stav od']), odkud: '' });
  });
  if (ss.getSheetByName(LIST_PRESTUPY)) radky_(LIST_PRESTUPY).forEach(r => {
    if (!r['ID'] || String(r['Do skupina']) !== sk || r['Stav'] !== 'provedeno') return;
    if (je[cleKlicOsoby_(r['Jméno'], r['Příjmení'], r['Datum narození'])]) return;
    out.push({ zdroj: 'prestup', id: String(r['ID']), jmeno: String(r['Jméno'] || ''), prijmeni: String(r['Příjmení'] || ''), narozen: cleDen_(r['Datum narození']), kdy: cleDen_(r['Provedeno'] || r['Stav od']), odkud: String(r['Z sboru'] || '') });
  });
  return out.sort((a, b) => String(b.kdy).localeCompare(String(a.kdy)));
}

/** Kontrola údajů člověka z aplikace. Vrací { x } (očištěná data) nebo { chyba }. */
function cleOverit_(d) {
  const x = { jmeno: String(d.jmeno || '').trim(), prijmeni: String(d.prijmeni || '').trim(), narozen: String(d.narozen || '').trim().slice(0, 10), pohlavi: String(d.pohlavi || ''),
    obec: String(d.obec || '').trim(), ev: String(d.ev || '').trim(), vztah: String(d.vztah || 'člen sboru'), jinySbor: String(d.jinySbor || '').trim() };
  if (!x.jmeno || !x.prijmeni) return { chyba: 'Vyplňte jméno a příjmení.' };
  const ch = kontrolaTextu_({ 'Jméno': x.jmeno, 'Příjmení': x.prijmeni, 'Obec': x.obec, 'Číslo průkazu': x.ev, 'Jiný sbor': x.jinySbor }, { 'Jméno': 60, 'Příjmení': 60, 'Obec': 80, 'Číslo průkazu': 20, 'Jiný sbor': 80 });
  if (ch) return { chyba: ch };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(x.narozen) || isNaN(new Date(x.narozen + 'T00:00:00'))) return { chyba: 'Datum narození má tvar RRRR-MM-DD.' };
  const vek = (Date.now() - new Date(x.narozen + 'T00:00:00').getTime()) / (365.25 * 864e5);
  if (vek < 3 || vek > 100) return { chyba: 'Datum narození nevypadá správně (věk 3–100 let).' };
  if (['muž', 'žena'].indexOf(x.pohlavi) < 0) return { chyba: 'Vyberte pohlaví – soupisky dívek / chlapců se bez něj neobejdou.' };
  if (CLE_VZTAHY.indexOf(x.vztah) < 0) return { chyba: 'Vyberte vztah ke sboru.' };
  if (x.vztah === 'člen jiného SDH' && !x.jinySbor) return { chyba: 'U člena jiného sboru napište název jeho SDH.' };
  if (x.vztah !== 'člen jiného SDH') x.jinySbor = '';
  if (x.ev && !/^[\w\/-]{1,20}$/.test(x.ev)) return { chyba: 'Číslo průkazu: písmena, číslice, - a / (do 20 znaků).' };
  return { x };
}

/**
 * Přidat (data.id prázdné) nebo upravit člověka v seznamu sboru. Duplicita ve stejném sboru (jméno + příjmení + datum narození) = chyba.
 * Do Záznamu změn jen ID a sbor, nikdy jméno.
 */
function cleUlozit_(o, u, d) {
  const sk = u.sbor.skupina, v = cleOverit_(d); if (v.chyba) return { ok: false, chyba: v.chyba };
  const x = v.x, id = String(d.id || '').trim();
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  let noveId;
  try {
    const t = cleTab_(), c = t.col, ted = new Date();
    if (c('Vztah') < 0 || c('Naposledy použito') < 0) return { ok: false, chyba: 'List Lidé sborů nemá nové sloupce – okres musí spustit Založit / doplnit strukturu.' };
    const i = id ? t.v.findIndex(r => String(r[c('ID')]) === id && String(r[c('Skupina')]) === sk) : -1;
    if (id && i < 0) return { ok: false, chyba: 'Záznam v seznamu vašeho sboru nenalezen.' };
    const klic = cleKlicOsoby_(x.jmeno, x.prijmeni, x.narozen);
    const dup = t.v.find((r, j) => j !== i && String(r[c('Skupina')]) === sk && cleKlicOsoby_(r[c('Jméno')], r[c('Příjmení')], r[c('Datum narození')]) === klic);
    if (dup) return { ok: false, chyba: x.jmeno + ' ' + x.prijmeni + ' (' + cleDatumCz_(x.narozen) + ') už v seznamu je.' };
    const r = i >= 0 ? t.v[i] : t.h.map(() => ''), set = (k, val) => { if (c(k) >= 0) r[c(k)] = val; };
    if (i < 0) { set('ID', cleNoveId_()); set('Sbor', u.sbor.sbor); set('Skupina', sk); set('Zdroj', CLE_ZDROJE.indexOf(d.zdroj) >= 0 && d.zdroj !== 'test' ? d.zdroj : 'ručně'); set('Přidal', o.email); set('Přidáno', ted); }
    set('Jméno', bezVzorce_(x.jmeno)); set('Příjmení', bezVzorce_(x.prijmeni)); set('Datum narození', new Date(x.narozen + 'T00:00:00')); set('Pohlaví', x.pohlavi);
    set('Obec', x.obec ? bezVzorce_(x.obec) : ''); set('Kategorie', cleKategorie_(x.narozen)); set('Číslo průkazu', x.ev ? bezVzorce_(x.ev) : '');
    set('Vztah', x.vztah); set('Jiný sbor', x.jinySbor ? bezVzorce_(x.jinySbor) : ''); set('Naposledy použito', ted); set('Upozorněno', ''); set('Aktualizováno', ted);
    if (i >= 0) t.sh.getRange(i + 2, 1, 1, t.h.length).setValues([r]); else t.sh.appendRow(r);
    noveId = String(r[c('ID')]);
    zaznamZmeny_(o.email, LIST_CLENOVE, noveId, i >= 0 ? 'upraveno' : 'vytvořeno', '', u.sbor.sbor + (i < 0 ? ' · ' + r[c('Zdroj')] : ''));
  } finally { lock.releaseLock(); }
  return Object.assign(cleSbor_(u), { id: noveId });
}

/** Smaže záznam (opravdu – žádné „neaktivní“). Soupisky a účastníci školení si údaje nesou v sobě, nic se nerozbije. */
function cleSmazat_(o, u, id) {
  const sk = u.sbor.skupina;
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const t = cleTab_(), c = t.col, i = t.v.findIndex(r => String(r[c('ID')]) === id && String(r[c('Skupina')]) === sk);
    if (i < 0) return { ok: false, chyba: 'Záznam v seznamu vašeho sboru nenalezen.' };
    t.sh.deleteRow(i + 2);
    zaznamZmeny_(o.email, LIST_CLENOVE, id, 'smazáno', '', u.sbor.sbor);
  } finally { lock.releaseLock(); }
  return cleSbor_(u);
}

/**
 * Sbor překopíruje člověka ze zapsané členské přihlášky (zdroj 'prihlaska') nebo provedeného přestupu do sboru ('prestup') – jen jméno, příjmení,
 * datum narození; pohlaví a obec doplní sbor v následné úpravě (z udaje.json se nečte nic). Vztah „člen sboru“.
 */
function clePrekopirovat_(o, u, req) {
  const sk = u.sbor.skupina, zdroj = String(req.zdroj || ''), id = String(req.id || '');
  let r, kdeZdroj;
  if (zdroj === 'prihlaska') {
    r = radky_(LIST_PRIHLASKY).find(x => String(x['ID']) === id && String(x['Skupina']) === sk && x['Stav'] === 'zapsáno');
    if (!r) return { ok: false, chyba: 'Zapsaná přihláška vašeho sboru nenalezena.' };
    kdeZdroj = 'z přihlášky';
  } else if (zdroj === 'prestup') {
    r = radky_(LIST_PRESTUPY).find(x => String(x['ID']) === id && String(x['Do skupina']) === sk && x['Stav'] === 'provedeno');
    if (!r) return { ok: false, chyba: 'Provedený přestup do vašeho sboru nenalezen.' };
    kdeZdroj = 'z přestupu';
  } else return { ok: false, chyba: 'Neznámý zdroj.' };
  const x = { jmeno: String(r['Jméno'] || '').trim(), prijmeni: String(r['Příjmení'] || '').trim(), narozen: cleDen_(r['Datum narození']) };
  if (!x.jmeno || !x.prijmeni || !x.narozen) return { ok: false, chyba: 'V přihlášce chybí jméno nebo datum narození – přidejte člověka ručně.' };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  let noveId;
  try {
    const t = cleTab_(), c = t.col, ted = new Date(), klic = cleKlicOsoby_(x.jmeno, x.prijmeni, x.narozen);
    const dup = t.v.find(y => String(y[c('Skupina')]) === sk && cleKlicOsoby_(y[c('Jméno')], y[c('Příjmení')], y[c('Datum narození')]) === klic);
    if (dup) return { ok: false, chyba: x.jmeno + ' ' + x.prijmeni + ' už v seznamu je.' };
    const n = t.h.map(() => ''), set = (k, val) => { if (c(k) >= 0) n[c(k)] = val; };
    set('ID', cleNoveId_()); set('Sbor', u.sbor.sbor); set('Skupina', sk); set('Jméno', bezVzorce_(x.jmeno)); set('Příjmení', bezVzorce_(x.prijmeni));
    set('Datum narození', new Date(x.narozen + 'T00:00:00')); set('Kategorie', cleKategorie_(x.narozen)); set('Vztah', 'člen sboru'); set('Zdroj', kdeZdroj);
    set('Přidal', o.email); set('Přidáno', ted); set('Naposledy použito', ted); set('Aktualizováno', ted);
    t.sh.appendRow(n); noveId = String(n[c('ID')]);
    zaznamZmeny_(o.email, LIST_CLENOVE, noveId, 'vytvořeno', '', u.sbor.sbor + ' · ' + kdeZdroj + ' ' + id);
  } finally { lock.releaseLock(); }
  return Object.assign(cleSbor_(u), { id: noveId, doplnit: true });
}

/* ---------- soupiska družstva (volá Souteze.gs) ---------- */

/**
 * Kontrola a doplnění soupisky: položky { clen: ID } doplní ze seznamu lidí sboru (jméno, datum narození, číslo průkazu, pohlaví, obec, vztah, host = jiný SDH),
 * ruční položky { jmeno, prijmeni, narozen, pohlavi, obec, ev, host } označí rucne = 1. Věk a pohlaví podle cleRozsah_, počet nejvýš max,
 * nikdo dvakrát v družstvu ani ve dvou družstvech téže kategorie (ZHVB: v celé soutěži).
 * jine = soupisky ostatních přihlášek soutěže [{ kat, druzstvo, soupiska }]. → { chyba } nebo { soupiska, neclenu, ids }
 */
function cleSoupiska_(s, kat, skupina, vstup, jine) {
  if (!Array.isArray(vstup)) return { soupiska: [], neclenu: 0, ids: [] };
  const R = cleRozsah_(s, kat), lide = {}, vysl = [], klice = {}, ids = [];
  if (vstup.length > R.max) return { chyba: 'Soupiska má nejvýš ' + R.max + (R.max === 1 ? ' závodníka.' : ' členů.') };
  if (vstup.some(x => x && x.clen)) cleClenove_(skupina).forEach(c => { lide[c.id] = c; });
  for (let i = 0; i < vstup.length; i++) {
    const x = vstup[i] || {};
    let p;
    if (x.clen) {
      const c = lide[String(x.clen)];
      if (!c) return { chyba: 'Člověk na ' + (i + 1) + '. místě není v seznamu vašeho sboru.' };
      p = { clen: c.id, jmeno: c.jmeno, prijmeni: c.prijmeni, narozen: c.narozen, pohlavi: c.pohlavi, obec: c.obec, ev: c.ev, vztah: c.vztah, host: c.vztah === 'člen jiného SDH' ? c.jinySbor : '' };
      ids.push(c.id);
    } else {
      p = { jmeno: String(x.jmeno || '').trim(), prijmeni: String(x.prijmeni || '').trim(), narozen: cleDen_(x.narozen), pohlavi: ['muž', 'žena'].indexOf(x.pohlavi) >= 0 ? x.pohlavi : '',
        obec: String(x.obec || '').trim(), ev: String(x.ev || '').trim(), rucne: 1, host: String(x.host || '').trim() };
      const ch = kontrolaTextu_({ 'Jméno': p.jmeno, 'Příjmení': p.prijmeni, 'Obec': p.obec, 'Číslo průkazu': p.ev, 'Sbor': p.host }, { 'Jméno': 60, 'Příjmení': 60, 'Obec': 80, 'Číslo průkazu': 20, 'Sbor': 80 });
      if (ch) return { chyba: ch };
      if (!p.jmeno || !p.prijmeni || !p.narozen) return { chyba: 'U člověka zadaného ručně na ' + (i + 1) + '. místě vyplňte jméno, příjmení a datum narození.' };
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
  return { soupiska: vysl, neclenu: vysl.filter(cleNeclen_).length, ids: ids };
}
/** Položka soupisky, která není „člen sboru“: zadaná ručně (dřív „mimo“), host z jiného SDH nebo nečlen. */
const cleNeclen_ = p => !!(p.rucne || p.mimo || (p.vztah && p.vztah !== 'člen sboru'));

/* ---------- e-mail sboru ---------- */

function clePosta_(skupina, predmet, text, cesta) {
  const url = (nastaveniWeb_('WEB_URL') || '') + '/Aplikace%20OSH.dc.html#' + cesta;
  const html = sablona_(predmet, text, [], ['Otevřít ve Spojce', url], 'Automatická zpráva.');
  try { posta_(skupina + '@' + (nastaveniWeb_('DOMENA') || 'oshpz.cz'), predmet, text + '\n\n' + url, html); } catch (x) { console.error('E-mail k seznamu lidí: ' + x.message); }
}
/** Věta do e-mailu sboru po zápisu přihlášky / provedení přestupu (Prihlasky.gs, Prestupy.gs). */
const CLE_VETA_SEZNAM = 'Chcete-li ho mít v seznamu lidí sboru pro soutěže a školení, přidejte ho v portálu: Členové → Lidé sboru → K převzetí → Přidat do seznamu. Seznam vede jen váš sbor.';

/* ---------- noční údržba ---------- */

/**
 * Lidé nepoužití CLENOVE_VYMAZ_DNY (730) od posledního použití (jinak od přidání) se smažou; CLENOVE_UPOZORNIT_DNY (30) předem jde sboru jednou e-mail
 * se jmény (jen do e-mailu sboru, ne do Záznamu změn). Soupisky soutěží po skončení ročníku (31. 8.).
 */
function cleUdrzba_() {
  const ss = dataSs_(), dnes = new Date(), zpravy = [];
  if (ss.getSheetByName(LIST_CLENOVE)) {
    const dny = Number(nastaveniWeb_('CLENOVE_VYMAZ_DNY') || 730) || 730, upoz = Number(nastaveniWeb_('CLENOVE_UPOZORNIT_DNY') || 30) || 30;
    const hrSmazat = new Date(Date.now() - dny * 864e5), hrUpozornit = new Date(Date.now() - (dny - upoz) * 864e5), t = cleTab_(), c = t.col;
    const posledni = r => (r[c('Naposledy použito')] instanceof Date ? r[c('Naposledy použito')] : r[c('Přidáno')] instanceof Date ? r[c('Přidáno')] : r[c('Aktualizováno')] instanceof Date ? r[c('Aktualizováno')] : null);
    const smazat = [], upozornit = {}, sbory = {};
    t.v.forEach((r, i) => {
      const p = posledni(r); if (!p) return;
      const sk = String(r[c('Skupina')] || '');
      if (p < hrSmazat) { smazat.push(i); sbory[sk] = (sbory[sk] || 0) + 1; return; }
      if (p < hrUpozornit && c('Upozorněno') >= 0 && !(r[c('Upozorněno')] instanceof Date)) {
        (upozornit[sk] = upozornit[sk] || []).push({ i: i, text: r[c('Jméno')] + ' ' + r[c('Příjmení')] + ' (nar. ' + cleDatumCz_(r[c('Datum narození')]) + ', naposledy použito ' + cleDatumCz_(p) + ')' });
      }
    });
    Object.keys(upozornit).forEach(sk => {
      if (!sk) return;
      const lide = upozornit[sk], sbor = cleSboryPodleSkupiny_()[sk] || sk;
      clePosta_(sk, 'Seznam lidí sboru: za ' + upoz + ' dní se smažou nepoužité záznamy', 'Dobrý den,\n\ntito lidé v seznamu ' + sbor + ' nebyli ' + Math.round((dny - upoz) / 30) + ' měsíců použití v žádné soupisce ani přihlášce na školení. ' +
        'Za ' + upoz + ' dní se ze seznamu automaticky smažou (pravidlo ' + Math.round(dny / 365) + ' roky od posledního použití):\n\n' + lide.map(x => '• ' + x.text).join('\n') +
        '\n\nPokud je chcete ponechat, otevřete je v portálu a uložte (Upravit → Uložit), nebo je použijte v přihlášce. Smazání nic nerozbije – odeslané soupisky a přihlášky zůstávají.', 'sbor/' + sk + '/seznam');
      lide.forEach(x => t.sh.getRange(x.i + 2, c('Upozorněno') + 1).setValue(dnes));
      zpravy.push('upozorněno ' + lide.length);
    });
    smazat.sort((a, b) => b - a).forEach(i => t.sh.deleteRow(i + 2));
    if (smazat.length) zpravy.push('lidé sborů ' + smazat.length + ' (' + Object.keys(sbory).map(k => (cleSboryPodleSkupiny_()[k] || k) + ' ' + sbory[k]).join(', ') + ')');
  }
  // soupisky: ročník soutěže skončil (31. 8. po konání) → jména pryč, družstvo zůstává
  const sh = ss.getSheetByName(LIST_DRUZSTVA);
  if (sh && sh.getLastRow() > 1) {
    const h = hlavicka_(sh), cs = h.indexOf('Soupiska'), cm = h.indexOf('Nečlenů'), cm0 = h.indexOf('Mimo evidenci'), ca = h.indexOf('Akce – ID');
    if (cs >= 0) {
      const od = {}; radky_('Akce').forEach(a => { od[String(a['ID'])] = a['Od']; });
      const rng = sh.getRange(2, 1, sh.getLastRow() - 1, h.length), v = rng.getValues(); let n = 0;
      v.forEach(r => {
        if (!r[cs]) return; const d = od[String(r[ca])]; if (!(d instanceof Date)) return;
        const konec = new Date((d.getMonth() >= 8 ? d.getFullYear() + 1 : d.getFullYear()) + '-09-01T00:00:00');
        if (dnes >= konec) { r[cs] = ''; if (cm >= 0) r[cm] = ''; if (cm0 >= 0) r[cm0] = ''; n++; }
      });
      if (n) { rng.setValues(v); zpravy.push(n + ' soupisek'); }
    }
  }
  if (zpravy.length) zaznamZmeny_('noční údržba', LIST_CLENOVE, '', 'smazáno', '', zpravy.join(', '));
  return zpravy.length;
}

/* ---------- test (jen režim TEST) ---------- */

const CLE_TEST_SBORY = 3, CLE_TEST_ROKY = [2021, 2019, 2017, 2015, 2014, 2013, 2012, 2011, 2010, 2009, 2008, 1995, 1980];
/** Testovací lidé napříč sbory (jen vlozitTestySkoleni) – ID LTEST…; jiné čtení přes sbory neexistuje. */
function cleTestLide_() { return dataSs_().getSheetByName(LIST_CLENOVE) ? radky_(LIST_CLENOVE).filter(r => /^LTEST/.test(String(r['ID']))).map(cleJson_) : []; }
/** Smyšlení lidé pro 3 sbory (různé ročníky od přípravky po dospělé, dívky i chlapci, v každém sboru jeden host z jiného SDH a jeden nečlen). ID s „TEST“ – uklidí je Úklid testů. Jen v režimu TEST. */
function vlozitTestyClenu() {
  if (String(nastaveniWeb_('REZIM') || '').toUpperCase() !== 'TEST') throw new Error('Testovací lidi jde vložit jen v režimu TEST.');
  const sbory = radkyRychle_('Sbory').filter(r => r['Sbor'] && r['Skupina'] && String(r['Aktivní'] || '').toUpperCase() !== 'NE').slice(0, CLE_TEST_SBORY);
  const K = SO_TEST_JMENA, t = cleTab_(), ted = new Date(), radky = [];
  sbory.forEach((s, si) => {
    CLE_TEST_ROKY.forEach((rok, i) => [0, 1].forEach(z => {
      const zena = z === 1, jm = (zena ? K.holky : K.kluci)[(i * 2 + si) % (zena ? K.holky : K.kluci).length], pr = K.prijmeni[(i + si * 5 + z * 3) % K.prijmeni.length][zena ? 1 : 0];
      const r = t.h.map(() => ''), set = (k, v) => { if (t.col(k) >= 0) r[t.col(k)] = v; }, narozen = rok + '-' + String((i % 12) + 1).padStart(2, '0') + '-' + String(10 + si + z).padStart(2, '0');
      const vztah = i === 4 && z === 0 ? 'člen jiného SDH' : i === 6 && z === 1 ? 'nečlen' : 'člen sboru';
      set('ID', 'LTEST' + si + '-' + i + '-' + z); set('Sbor', String(s['Sbor'])); set('Skupina', String(s['Skupina']).split('@')[0].toLowerCase());
      set('Jméno', jm); set('Příjmení', pr); set('Datum narození', new Date(narozen + 'T00:00:00'));
      set('Pohlaví', zena ? 'žena' : 'muž'); set('Obec', ['Ukázkov', 'Vzorová Lhota', 'Příkladov'][si % 3]); set('Kategorie', cleKategorie_(narozen));
      set('Číslo průkazu', vztah === 'nečlen' ? '' : '9' + String(si) + String(i).padStart(2, '0') + z + '00TEST'); set('Vztah', vztah); set('Jiný sbor', vztah === 'člen jiného SDH' ? 'SDH Ukázkov' : '');
      set('Zdroj', 'test'); set('Přidal', 'test'); set('Přidáno', ted); set('Naposledy použito', ted); set('Aktualizováno', ted);
      radky.push(r);
    }));
  });
  // opakované spuštění přepíše stejné řádky (ID), nic nezdvojí
  const kde = {}; t.v.forEach((r, i) => { kde[String(r[t.col('ID')])] = i; });
  const nove = radky.filter(r => { const i = kde[r[t.col('ID')]]; if (i == null) return true; t.sh.getRange(i + 2, 1, 1, t.h.length).setValues([r]); return false; });
  if (nove.length) t.sh.getRange(t.sh.getLastRow() + 1, 1, nove.length, t.h.length).setValues(nove);
  const text = 'Vloženo ' + radky.length + ' testovacích lidí do sborů ' + sbory.map(s => s['Sbor']).join(', ') + ' (ročníky ' + CLE_TEST_ROKY.join(', ') + ', dívky i chlapci, v každém sboru jeden host a jeden nečlen). Poučení si sbor potvrdí v portálu. Uklidí je „Úklid testů“.';
  console.log(text); try { SpreadsheetApp.getActive().toast(text, 'Testovací lidé', 15); } catch (e) {}
  return text;
}

/**
 * Samokontrola seznamu lidí sboru (jen TEST, spustit z editoru: testLide). Nad prvním aktivním sborem založí smyšlené lidi se jménem „TEST …“,
 * ověří kontroly, úpravu, duplicitu, soupisku, převzetí a smazání; vše po sobě uklidí (kdyby ne, uklidí je Úklid testů). Nic neposílá e-mailem.
 */
function testLide() {
  if (String(nastaveniWeb_('REZIM') || '').toUpperCase() !== 'TEST') throw new Error('Samokontrola jde spustit jen v režimu TEST.');
  const vys = [], ok = (nazev, podminka, detail) => { vys.push((podminka ? 'OK     ' : 'CHYBA  ') + nazev + (detail ? ' – ' + detail : '')); return podminka; };
  const r0 = radkyRychle_('Sbory').find(r => r['Sbor'] && r['Skupina'] && String(r['Aktivní'] || '').toUpperCase() !== 'NE');
  if (!r0) throw new Error('V listu Sbory není žádný aktivní sbor se skupinou.');
  const s = { sbor: String(r0['Sbor']), skupina: String(r0['Skupina']).split('@')[0].toLowerCase() }, u = { email: 'test', role: {}, sbory: [s], sbor: s }, o = { email: 'test', role: {} }, sk = s.skupina;
  const ids = [];
  try {
    const zakl = { jmeno: 'TEST Seznam', prijmeni: 'Člověk', narozen: '2012-05-05', pohlavi: 'žena', obec: 'Testov', vztah: 'člen sboru', ev: 'T-1' };
    ok('bez pohlaví se odmítne', !cleUlozit_(o, u, Object.assign({}, zakl, { pohlavi: '' })).ok);
    ok('nesmyslný věk se odmítne', !cleUlozit_(o, u, Object.assign({}, zakl, { narozen: String(new Date().getFullYear()) + '-01-01' })).ok);
    ok('host bez názvu sboru se odmítne', !cleUlozit_(o, u, Object.assign({}, zakl, { vztah: 'člen jiného SDH', jinySbor: '' })).ok);
    ok('číslo průkazu s mezerou se odmítne', !cleUlozit_(o, u, Object.assign({}, zakl, { ev: 'a b' })).ok);
    const a = cleUlozit_(o, u, zakl); if (a.ok) ids.push(a.id);
    ok('založení člověka', a.ok && /^L/.test(a.id || ''), a.chyba);
    ok('duplicita (stejné jméno a datum) se odmítne', !cleUlozit_(o, u, zakl).ok);
    const b = cleUlozit_(o, u, Object.assign({}, zakl, { id: a.id, obec: 'Testov 2' }));
    ok('úprava zachová ID', b.ok && b.id === a.id, b.chyba);
    const j = cleClenove_(sk).find(x => x.id === a.id) || {};
    ok('čtení: kategorie, obec, použito, zdroj ručně', j.kategorie === 'mladý hasič' && j.obec === 'Testov 2' && !!j.pouzito && j.zdroj === 'ručně' && j.vztah === 'člen sboru', JSON.stringify(j));
    const h = cleUlozit_(o, u, { jmeno: 'TEST Host', prijmeni: 'Cizí', narozen: '2013-02-02', pohlavi: 'muž', vztah: 'člen jiného SDH', jinySbor: 'SDH Jinde' }); if (h.ok) ids.push(h.id);
    const jh = h.ok ? cleClenove_(sk).find(x => x.id === h.id) : {};
    ok('host z jiného SDH', h.ok && jh.vztah === 'člen jiného SDH' && jh.jinySbor === 'SDH Jinde', h.chyba);
    const n = cleUlozit_(o, u, { jmeno: 'TEST Nečlen', prijmeni: 'Veřejný', narozen: '2014-03-03', pohlavi: 'muž', vztah: 'nečlen', jinySbor: 'ignorovat' }); if (n.ok) ids.push(n.id);
    ok('nečlen (název sboru se zahodí)', n.ok && (cleClenove_(sk).find(x => x.id === n.id) || {}).jinySbor === '', n.chyba);
    ok('seznam přes všechny sbory neexistuje', (() => { try { cleClenove_(null); return false; } catch (e) { return true; } })());
    ok('jiný sbor záznam nevidí', !cleClenove_(sk + '-jiny').some(x => x.id === a.id));
    // soupiska: Hra Plamen, kategorie starší (ročník 2012 a mladší v roce konce ročníku), příští ročník
    const sout = { od: (new Date().getFullYear() + 1) + '-05-01', druh: 'Hra Plamen', pro: 'MH', oz: {} };
    const sp = cleSoupiska_(sout, 'starší', sk, [{ clen: a.id }, { clen: h.id }, { jmeno: 'TEST Ručně', prijmeni: 'Zadaný', narozen: '2015-01-01', pohlavi: 'muž', host: 'SDH Odjinud' }], []);
    ok('soupiska: 3 lidé, 2 nečleni, 2 ID ze seznamu', !sp.chyba && sp.soupiska.length === 3 && sp.neclenu === 2 && sp.ids.length === 2, sp.chyba);
    ok('soupiska: položky nesou vztah / host / rucne', !sp.chyba && sp.soupiska[0].vztah === 'člen sboru' && !sp.soupiska[0].host && sp.soupiska[1].host === 'SDH Jinde' && sp.soupiska[2].rucne === 1 && sp.soupiska[2].host === 'SDH Odjinud');
    ok('soupiska: cizí ID se odmítne', !!cleSoupiska_(sout, 'starší', sk, [{ clen: 'L000' }], []).chyba);
    ok('soupiska: dívka do kategorie chlapců se odmítne', !!cleSoupiska_(sout, 'starší chlapci', sk, [{ clen: a.id }], []).chyba);
    ok('soupiska: moc starý do mladší se odmítne', !!cleSoupiska_(sout, 'mladší', sk, [{ clen: a.id }], []).chyba);
    const pred = (cleClenove_(sk).find(x => x.id === a.id) || {}).pouzito;
    Utilities.sleep(1100); clePouzito_(sk, [a.id]);
    ok('Naposledy použito se posune', (cleClenove_(sk).find(x => x.id === a.id) || {}).pouzito > pred);
    ok('kandidáti: pole bez chyby', Array.isArray(cleKandidati_(sk, cleClenove_(sk))));
    ok('převzetí neexistující přihlášky se odmítne', !clePrekopirovat_(o, u, { zdroj: 'prihlaska', id: 'P-neni' }).ok && !clePrekopirovat_(o, u, { zdroj: 'prestup', id: 'S-neni' }).ok);
    const kand = cleKandidati_(sk, cleClenove_(sk))[0];
    if (kand) { const p = clePrekopirovat_(o, u, { zdroj: kand.zdroj, id: kand.id }); if (p.ok) ids.push(p.id);
      const jp = p.ok ? cleClenove_(sk).find(x => x.id === p.id) : {};
      ok('převzetí kandidáta (' + kand.zdroj + '): jméno, bez pohlaví, zdroj', p.ok && p.doplnit && jp.jmeno === kand.jmeno && jp.pohlavi === '' && /^z /.test(jp.zdroj), p.chyba);
      ok('převzatý už není mezi kandidáty', p.ok && !cleKandidati_(sk, cleClenove_(sk)).some(k => k.zdroj === kand.zdroj && k.id === kand.id));
    } else vys.push('INFO   sbor ' + s.sbor + ' nemá zapsanou přihlášku ani provedený přestup – převzetí kandidáta se nezkoušelo.');
    ok('poučení: stav jde přečíst', typeof clePouceniStav_(sk).kdy === 'string');
  } finally {
    ids.forEach(id => { const d = cleSmazat_(o, u, id); ok('smazání ' + id, d.ok, d.chyba); });
    if (ids.length) ok('smazaný záznam podruhé nejde smazat', !cleSmazat_(o, u, ids[0]).ok);
  }
  const text = vys.join('\n') + '\n\nCelkem ' + vys.filter(v => /^OK/.test(v)).length + ' OK, ' + vys.filter(v => /^CHYBA/.test(v)).length + ' chyb (sbor ' + s.sbor + ').';
  console.log(text); try { SpreadsheetApp.getUi().alert('Samokontrola Lidé sborů', text, SpreadsheetApp.getUi().ButtonSet.OK); } catch (e) {}
  return text;
}
