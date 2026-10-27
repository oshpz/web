/**
 * OSH data – přihlášky členů SH ČMS (B7, list Členské přihlášky).
 *
 * Postup: žádost (uchazeč na webu: kategorie podle věku, motivační dopis, fotka; PDF jako nezploštělý formulář) → sbor posoudí:
 * přijato (sportovec + datum schválení výborem) / doplnit (uchazeč opraví přes svůj odkaz) / nepřijato – uchazeč dostane e-mail
 * s osobním odkazem (?stranka=prihlaska&k=…, v tabulce jen otisk). Sbor může přihlášku zadat i sám (rovnou přijato).
 * Přijato → člen zaplatí sboru (Zaplaceno) → podepsaná přihláška: sken nahraje uchazeč přes odkaz, nebo ji přinese → sbor nahraje
 * finální sken (s razítkem a podpisem starosty) a fotku → odvod okresu → předáno okresu (sken u okresu) → schváleno / vráceno
 * (okres, role Přihlášky) → zapsáno (evidenční číslo z evidencesdh.cz). Dál zamítnuto (okres) a zrušeno (zrušil sbor; do 22. 10. 2026 „staženo“).
 *
 * Osobní údaje: v tabulce jen jméno, datum narození, kategorie, kontakt a stav. Rodné číslo, adresa a údaje zákonného
 * zástupce jsou jen ve vyplněném PDF a v udaje.json ve složce Přihlášky/<sbor>/<ID>/ – na Můj disk účtu, pod kterým skript
 * běží (sdílený disk vidí všichni jeho členové), bez sdílení. Server ji čte jen pro roli Přihlášky a pro daný sbor.
 * Noční údržba (prhVymazat_) smaže udaje.json a PDF po lhůtě z Nastavení; sken zůstává jako doklad o podpisu.
 * Do logu, Záznamu změn ani do e-mailů nikdy nejde rodné číslo ani adresa.
 */

const LIST_PRIHLASKY = 'Členské přihlášky';
const PRH_STAVY_SKEN = ['přijato', 'vráceno'];                  // sbor smí nahrát (znovu) sken a fotku a předat okresu
const PRH_STAVY_ZADOST = ['žádost', 'doplnit'];                 // žádost uchazeče, o které sbor ještě nerozhodl
const PRH_STAVY_STAHNOUT = ['žádost', 'doplnit', 'přijato', 'vráceno', 'sken u okresu'];
const PRH_STAVY_PDF = ['přijato', 'vráceno', 'sken u okresu', 'schváleno', 'zapsáno']; // PDF s rodným číslem až po přijetí sborem
const PRH_KATEGORIE = ['dospělý', 'mladý hasič'], PRH_MOTIVACE_MAX = 2000;
const PRH_LIMIT_WEB = 20, PRH_LIMIT_EMAIL = 3;                  // veřejný formulář: za 10 min celý web, za hodinu jeden e-mail
const PRH_PDF_MAX = 3 * 1024 * 1024;
let _prhBezPosty = false; // automatický test (testPrihlaskyOdvod) neposílá e-maily
const PRH_ODVOD_STAVY = ['sken u okresu', 'schváleno', 'zapsáno']; // předané přihlášky: nezaplacený odvod = dluh sboru
const PRH_ODVOD_AKTIVNI = ['přijato', 'vráceno', 'sken u okresu', 'schváleno', 'zapsáno']; // odvod jde zaplatit i před předáním
const PRH_FOTO_MAX = 3 * 1024 * 1024; // fotku zmenší prohlížeč (1600 px, JPEG bez EXIF)

function smiPrihlaskyOkres_(o) { return !!(o && (o.role['Přihlášky'] || o.role['Správce'])); }
function prihlaskyZapnute_() { return String(nastaveniWeb_('PRIHLASKY_ZAPNUTO') || 'ANO').trim().toUpperCase() !== 'NE'; }

/* ---------- rodné číslo (stejná pravidla jako prihlaska.js) ---------- */
function prhMod_(cislice, n) { return String(cislice).split('').reduce((z, c) => (z * 10 + Number(c)) % n, 0); }
function prhRc_(text, kDatu) {
  const s = String(text || '').replace(/[\s/]/g, '');
  if (!/^\d{9,10}$/.test(s)) return { ok: false, chyba: 'Rodné číslo má tvar RRMMDD/XXXX.' };
  const rr = Number(s.slice(0, 2)), dd = Number(s.slice(4, 6));
  let mm = Number(s.slice(2, 4));
  if (s.length === 9 && rr >= 54) return { ok: false, chyba: 'Rodné číslo po roce 1953 má 10 číslic.' };
  const rok = s.length === 9 ? 1900 + rr : (rr < 54 ? 2000 + rr : 1900 + rr);
  if (mm > 70) mm -= 70; else if (mm > 50) mm -= 50; else if (mm > 20) mm -= 20;
  const d = new Date(Date.UTC(rok, mm - 1, dd));
  if (mm < 1 || mm > 12 || d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) return { ok: false, chyba: 'Rodné číslo neobsahuje platné datum narození.' };
  if (s.length === 10 && prhMod_(s, 11) !== 0 && !(prhMod_(s.slice(0, 9), 11) === 10 && s[9] === '0')) return { ok: false, chyba: 'Rodné číslo není platné (kontrolní číslice nesedí).' };
  const k = kDatu || new Date();
  if (d > k) return { ok: false, chyba: 'Rodné číslo obsahuje datum narození v budoucnosti.' };
  let vek = k.getFullYear() - rok; if (k.getMonth() + 1 < mm || (k.getMonth() + 1 === mm && k.getDate() < dd)) vek--;
  return { ok: true, cislo: s.slice(0, 6) + '/' + s.slice(6), datum: rok + '-' + String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0'), vek: vek, kategorie: vek < 18 ? 'mladý hasič' : 'dospělý' };
}
const prhMaska_ = t => { const s = String(t || '').replace(/[\s/]/g, ''); return s.length >= 9 ? '******/' + s.slice(6) : ''; };

/** Kontrola údajů z formuláře (zadost = žádost uchazeče na webu: u dospělého motivační dopis). Vrací { chyba } nebo { d: vyčištěné údaje, rc }. */
function prhKontrola_(vstup, zadost) {
  const t = k => String(vstup[k] == null ? '' : vstup[k]).trim();
  const d = { kategorie: t('kategorie'), jmeno: t('jmeno'), prijmeni: t('prijmeni'), rc: t('rc'), ulice: t('ulice'), obec: t('obec'), psc: t('psc').replace(/\s/g, ''),
    prislusnost: t('prislusnost') || 'ČR', telefon: t('telefon'), email: normEmail_(t('email')), sportovec: vstup.sportovec === true ? true : vstup.sportovec === false ? false : null,
    zzJmeno: t('zzJmeno'), zzNarozeni: t('zzNarozeni'), zzTelefon: t('zzTelefon'), prestupZ: vstup.prestup ? t('prestupZ') : '', motivace: t('motivace'), datumVyboru: t('datumVyboru') };
  const ch = kontrolaTextu_({ jmeno: d.jmeno, prijmeni: d.prijmeni, ulice: d.ulice, obec: d.obec, prislusnost: d.prislusnost, zzJmeno: d.zzJmeno, prestupZ: d.prestupZ },
    { jmeno: 60, prijmeni: 60, ulice: 100, obec: 60, prislusnost: 40, zzJmeno: 120, prestupZ: 100 });
  if (ch) return { chyba: ch };
  if (d.motivace.length > PRH_MOTIVACE_MAX) return { chyba: 'Motivační dopis může mít nejvýš ' + PRH_MOTIVACE_MAX + ' znaků.' };
  d.motivace = d.motivace.replace(/[<>]/g, ''); // jen prostý text
  if (PRH_KATEGORIE.indexOf(d.kategorie) < 0) return { chyba: 'Vyberte, jestli jde o přihlášku dospělého, nebo mladého hasiče.' };
  if (!d.jmeno || !d.prijmeni) return { chyba: 'Vyplňte jméno a příjmení.' };
  const rc = prhRc_(d.rc);
  if (!rc.ok) return { chyba: rc.chyba };
  // kategorii vybírá uchazeč – musí sedět s věkem podle rodného čísla (do 18 let mladý hasič)
  if (rc.kategorie !== d.kategorie) return { chyba: 'Podle rodného čísla je uchazeči ' + rc.vek + ' let – ' + (rc.kategorie === 'mladý hasič' ? 'do 18 let patří přihláška mladého hasiče.' : 'od 18 let patří přihláška dospělého (hasiče).') };
  if (rc.vek < 3) return { chyba: 'Mladým hasičem může být dítě od 3 let (stanovy SH ČMS).' };
  // Stanovy SH ČMS 2025, čl. 19 odst. 2: občan ČR, nebo cizinec s povolením k trvalému pobytu v ČR
  d.trvalyPobyt = vstup.trvalyPobyt === true;
  if (!/^(čr|cr|cz|cze|česk(á|a) republika|česko|czech republic)$/i.test(d.prislusnost) && !d.trvalyPobyt) return { chyba: 'Členem SH ČMS může být občan ČR nebo cizinec s povolením k trvalému pobytu v ČR – potvrďte ho.' };
  if (zadost && d.kategorie === 'dospělý' && d.motivace.length < 20) return { chyba: 'Napište pár vět, proč se chcete stát členem sboru (motivační dopis).' };
  if (d.datumVyboru && !/^\d{4}-\d{2}-\d{2}$/.test(d.datumVyboru)) return { chyba: 'Datum schválení výborem má tvar RRRR-MM-DD.' };
  d.rc = rc.cislo;
  if (!d.ulice || !d.obec) return { chyba: 'Vyplňte adresu trvalého bydliště (ulice a číslo, obec).' };
  if (!/^\d{5}$/.test(d.psc)) return { chyba: 'PSČ má pět číslic.' };
  d.psc = d.psc.slice(0, 3) + ' ' + d.psc.slice(3);
  if (!/^\+?[\d ()-]{9,20}$/.test(d.telefon)) return { chyba: 'Vyplňte platný telefon.' };
  if (d.email.length > 254 || !/^[^@\s<>"']+@[^@\s<>"']+\.[^@\s<>"']+$/.test(d.email)) return { chyba: 'Vyplňte platný e-mail.' };
  if (rc.kategorie === 'mladý hasič') {
    if (!d.zzJmeno) return { chyba: 'U mladého hasiče vyplňte jméno a příjmení zákonného zástupce.' };
    const zn = new Date(d.zzNarozeni);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.zzNarozeni) || isNaN(zn.getTime()) || zn.getFullYear() < 1920 || (Date.now() - zn.getTime()) < 18 * 365.25 * 864e5) return { chyba: 'Vyplňte datum narození zákonného zástupce (musí být zletilý).' };
    if (!/^\+?[\d ()-]{9,20}$/.test(d.zzTelefon)) return { chyba: 'Vyplňte telefon zákonného zástupce.' };
  } else { d.zzJmeno = ''; d.zzNarozeni = ''; d.zzTelefon = ''; }
  if (vstup.prestup && !d.prestupZ) return { chyba: 'Vyberte sbor, ze kterého přestupujete.' };
  if (vstup.souhlas !== true) return { chyba: 'Potvrďte souhlas se zpracováním osobních údajů.' };
  return { d: d, rc: rc };
}

/** Sbor podle odkazu (?sbor=<slug>), skupiny (sdh-…) nebo názvu – z listu Sbory. */
function prhSbor_(klic) {
  const slug = t => String(t || '').replace(/^SDH\s+/i, '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const k = slug(klic), sk = String(klic || '').toLowerCase().split('@')[0];
  const r = radkyRychle_('Sbory').find(x => String(x['Aktivní']).trim().toUpperCase() !== 'NE' && (slug(x['Sbor']) === k || (x['Skupina'] && String(x['Skupina']).toLowerCase().split('@')[0] === sk)));
  return r ? { sbor: String(r['Sbor']), skupina: String(r['Skupina'] || '').toLowerCase().split('@')[0], ucet: String(r['Číslo účtu'] || '').trim(), nastaveni: prhNastaveniSboru_(r) } : null;
}
/** Nastavení přihlášek sboru (list Sbory): příspěvky (prázdné = výchozí z Nastavení) a výchozí „sportovec“ u mladých hasičů a dospělých (předvyplní se při přijetí). */
function prhNastaveniSboru_(r) {
  const kc = (v, vychozi) => v === '' || v == null ? Number(nastaveniWeb_(vychozi) || 0) : Number(v) || 0;
  return { prispevekDospely: kc(r['Příspěvek dospělý'], 'PRISPEVEK_DOSPELY'), prispevekMH: kc(r['Příspěvek MH'], 'PRISPEVEK_MH'), mhSportovec: ano_(r['MH jako sportovec']), dospelySportovec: ano_(r['Dospělý jako sportovec']),
    regCislo: String(r['Registrační číslo'] == null ? '' : r['Registrační číslo']).trim(), // pevné číslo sboru (vyplní okres) – do PDF přihlášky
    vlastniDospely: r['Příspěvek dospělý'] !== '' && r['Příspěvek dospělý'] != null, vlastniMH: r['Příspěvek MH'] !== '' && r['Příspěvek MH'] != null };
}

/* ---------- složky a soubory ---------- */

/** Kořen „Přihlášky členů OSH (důvěrné)“ na Můj disk účtu skriptu (ID ve Vlastnostech skriptu PRIHLASKY_SLOZKA_ID). */
function prhKoren_() {
  const p = PropertiesService.getScriptProperties(), id = nastaveniWeb_('PRIHLASKY_SLOZKA_ID') || p.getProperty('PRIHLASKY_SLOZKA_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { console.warn('Složka přihlášek nejde otevřít: ' + e.message); } }
  const f = DriveApp.getRootFolder().createFolder('Přihlášky členů OSH (důvěrné)');
  f.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  p.setProperty('PRIHLASKY_SLOZKA_ID', f.getId());
  return f;
}
function prhSlozka_(sbor, id) {
  const koren = prhKoren_(), dite = (rodic, jm) => { const it = rodic.getFoldersByName(jm); return it.hasNext() ? it.next() : rodic.createFolder(jm); };
  return dite(dite(koren, sbor), id);
}
function prhSouborVeSlozce_(slozkaId, nazev) {
  if (!slozkaId) return null;
  try { const it = DriveApp.getFolderById(slozkaId).getFilesByName(nazev); return it.hasNext() ? it.next() : null; } catch (e) { return null; }
}
function prhUdaje_(r) { const f = prhSouborVeSlozce_(r['Složka – ID'], 'udaje.json'); if (!f) return null; try { return JSON.parse(f.getBlob().getDataAsString('UTF-8')); } catch (e) { return null; } }

/* ---------- řádky ---------- */

function prhRadek_(id) {
  const sh = dataSs_().getSheetByName(LIST_PRIHLASKY), h = hlavicka_(sh), col = k => h.indexOf(k);
  const ids = sh.getLastRow() > 1 ? sh.getRange(2, col('ID') + 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
  const i = ids.indexOf(String(id || ''));
  if (i < 0) return null;
  const rng = sh.getRange(i + 2, 1, 1, h.length), v = rng.getValues()[0];
  return { sh, h, col, rng, v, r: h.reduce((o, k, j) => (o[k] = v[j], o), {}) };
}
function prhZapsat_(x, zmeny, kdo) {
  Object.keys(zmeny).forEach(k => { if (x.col(k) >= 0) x.v[x.col(k)] = zmeny[k]; });
  x.v[x.col('Upraveno')] = new Date(); x.v[x.col('Upravil')] = kdo;
  x.rng.setValues([x.v]);
  x.r = x.h.reduce((o, k, j) => (o[k] = x.v[j], o), {});
}
/** Řádek pro aplikaci – jen údaje z tabulky (žádné rodné číslo ani adresa). */
function prhJson_(r) {
  const iso = v => v instanceof Date ? v.toISOString() : (v == null ? '' : v);
  const o = {};
  ['ID', 'Sbor', 'Skupina', 'Jméno', 'Příjmení', 'Datum narození', 'Kategorie', 'Sportovec', 'Přestup z', 'E-mail', 'Telefon', 'Zákonný zástupce',
    'Variabilní symbol', 'Zaplaceno', 'Evidenční číslo', 'Stav', 'Stav od', 'Poznámka', 'Zdroj', 'Vytvořeno', 'Odvod', 'Odvod přijat', 'Odvod zaplacen',
    'Motivační dopis', 'Schváleno výborem', 'Členem od'].forEach(k => { o[k] = iso(r[k]); });
  o.maSken = !!r['Sken – ID']; o.maPdf = !!r['PDF – ID'] && !r['Údaje smazány']; o.maFotku = !!r['Fotka – ID'] && !r['Údaje smazány'];
  o.maSkenUchazece = !!r['Sken uchazeče – ID']; o.maOdkaz = !!r['Odkaz – otisk'];
  return o;
}

/* ---------- založení (veřejný formulář i sbor) ---------- */

/** Fotka z formuláře (base64 JPEG/PNG, zmenšená prohlížečem) → blob, nebo { chyba }. */
function prhFotkaBlob_(data, mime, nazev) {
  const m = String(mime || 'image/jpeg');
  if (!/^image\/(jpeg|png)$/.test(m)) return { chyba: 'Fotka musí být obrázek JPG nebo PNG.' };
  let b; try { b = Utilities.base64Decode(String(data || '')); } catch (e) { return { chyba: 'Fotku se nepodařilo přečíst.' }; }
  if (!b.length || b.length > PRH_FOTO_MAX) return { chyba: 'Fotka je prázdná nebo větší než 3 MB.' };
  const ch = overitSoubor_('fotka.' + (m === 'image/png' ? 'png' : 'jpg'), m, b.length, null, b); if (ch) return { chyba: ch };
  return { blob: Utilities.newBlob(b, m, nazev + (m === 'image/png' ? '.png' : '.jpg')) };
}
/** PDF přihlášky z prohlížeče (base64) → bajty, nebo { chyba }. */
function prhPdfBajty_(data) {
  let pdf; try { pdf = Utilities.base64Decode(String(data || '')); } catch (e) { return { chyba: 'PDF přihlášky se nepodařilo přečíst.' }; }
  if (!pdf.length || pdf.length > PRH_PDF_MAX) return { chyba: 'PDF přihlášky chybí nebo je příliš velké.' };
  const ch = overitSoubor_('prihlaska.pdf', 'application/pdf', pdf.length, null, pdf); if (ch) return { chyba: ch };
  return { pdf: pdf };
}
/** Osobní odkaz uchazeče: náhodný klíč jde jen e-mailem (a na potvrzovací stránku), v tabulce je jen jeho otisk. */
function prhNovyOdkaz_() { const k = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); return { klic: k, otisk: otisk_('prh|' + k) }; } // 64 hex = 2 × UUID
function prhOdkazUrl_(klic) { return String(nastaveniWeb_('WEB_URL') || '').replace(/\/+$/, '') + '/?stranka=prihlaska&k=' + klic; }

/**
 * Založení přihlášky. zdroj 'web' = žádost uchazeče (fotka povinná, sportovce a datum výboru určí sbor při přijetí, uchazeč dostane osobní odkaz);
 * 'sbor' / 'test' = přihláška zadaná sborem – rovnou přijato (sportovec a datum výboru z formuláře, fotka nepovinná).
 */
function prhZalozit_(vstup, s, kdo, zdroj) {
  if (!s.nastaveni || !s.nastaveni.regCislo) return { ok: false, chyba: 'Sbor zatím nemá v evidenci okresu registrační číslo, bez něj přihláška nejde vyplnit. Ozvěte se prosím kanceláři OSH.' };
  const zadost = zdroj === 'web';
  const k = prhKontrola_(vstup, zadost);
  if (k.chyba) return { ok: false, chyba: k.chyba };
  const P = prhPdfBajty_(vstup.pdf); if (P.chyba) return { ok: false, chyba: P.chyba };
  let F = null;
  if (vstup.fotka) { F = prhFotkaBlob_(vstup.fotka, vstup.fotkaMime, 'Fotka'); if (F.chyba) return { ok: false, chyba: F.chyba }; }
  else if (zadost) return { ok: false, chyba: 'Přiložte fotku (obličej zepředu, stačí z mobilu).' };
  if (!zadost && k.d.sportovec === null) return { ok: false, chyba: 'Vyberte, jestli evidovat i jako sportovce.' };
  const d = k.d, ted = new Date(), odkaz = zadost ? prhNovyOdkaz_() : null, stav = zadost ? 'žádost' : 'přijato';
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = dataSs_().getSheetByName(LIST_PRIHLASKY), h = hlavicka_(sh), col = x => h.indexOf(x);
    if (zadost && (col('Odkaz – otisk') < 0 || col('Motivační dopis') < 0)) return { ok: false, chyba: 'Přihlášky se teď upravují – zkuste to prosím za chvíli (okres musí doplnit strukturu tabulky).' };
    const ids = sh.getLastRow() > 1 ? sh.getRange(2, col('ID') + 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
    let vs; do { vs = Utilities.formatDate(ted, 'Europe/Prague', 'yyMMdd') + String(Math.floor(Math.random() * 10000)).padStart(4, '0'); } while (ids.indexOf('P' + vs) >= 0);
    const id = 'P' + vs;
    const slozka = prhSlozka_(s.sbor, id);
    // klíč osobního odkazu jen v důvěrné složce (jako rodné číslo) – další e-maily uchazeči nesou stejný odkaz; v tabulce je jen otisk
    const ulozene = Object.assign({ id: id, sbor: s.sbor, datumNarozeni: k.rc.datum, vytvoreno: ted.toISOString() }, d, odkaz ? { odkazKlic: odkaz.klic } : {});
    slozka.createFile('udaje.json', JSON.stringify(ulozene, null, 1), 'application/json');
    const fPdf = slozka.createFile(Utilities.newBlob(P.pdf, 'application/pdf', 'Prihlaska ' + id + '.pdf'));
    const fFoto = F ? slozka.createFile(F.blob.setName('Fotka ' + id + F.blob.getName().replace(/^Fotka/, ''))) : null;
    const r = h.map(() => ''), set = (x, v) => { if (col(x) >= 0) r[col(x)] = v; };
    set('ID', id); set('Sbor', s.sbor); set('Skupina', s.skupina); set('Jméno', bezVzorce_(d.jmeno)); set('Příjmení', bezVzorce_(d.prijmeni));
    set('Datum narození', new Date(k.rc.datum + 'T00:00:00')); set('Kategorie', d.kategorie); set('Sportovec', d.sportovec === null ? '' : d.sportovec ? 'ANO' : 'NE');
    set('Přestup z', bezVzorce_(d.prestupZ)); set('E-mail', d.email); set('Telefon', bezVzorce_(d.telefon)); set('Zákonný zástupce', bezVzorce_(d.zzJmeno));
    set('Motivační dopis', bezVzorce_(d.motivace)); if (d.datumVyboru) set('Schváleno výborem', new Date(d.datumVyboru + 'T00:00:00'));
    set('Variabilní symbol', vs); set('Stav', stav); set('Stav od', ted); set('Zdroj', zdroj);
    set('Složka – ID', slozka.getId()); set('PDF – ID', fPdf.getId()); if (fFoto) set('Fotka – ID', fFoto.getId()); if (odkaz) set('Odkaz – otisk', odkaz.otisk);
    set('Vytvořeno', ted); set('Vytvořil', kdo); set('Upraveno', ted); set('Upravil', kdo);
    sh.appendRow(r);
    zaznamZmeny_(kdo, LIST_PRIHLASKY, id, 'vytvořeno', '', stav + ' (' + zdroj + ')');
    const jm = d.jmeno + ' ' + d.prijmeni, sborBez = s.sbor.replace(/^SDH\s+/i, '');
    if (zadost) {
      prhPosta_(s.skupina, 'Žádost o členství: ' + jm, 'Na webu přišla žádost o členství ve sboru (' + d.kategorie + '): ' + jm + '. ' +
        'Posuďte ji v portálu sboru (Přihlášky členů) – přijmout, vyžádat doplnění, nebo nepřijmout. Uchazeč dostane e-mail.', 'sbor/' + s.skupina + '/clenove');
      prhPostaUchazeci_(d.email, 'Žádost o členství v SDH ' + sborBez + ' jsme přijali',
        'Dobrý den,\n\nžádost o členství (' + jm + ') je u SDH ' + sborBez + '. Sbor ji posoudí a o výsledku vám dáme vědět e-mailem. ' +
        'Stav žádosti uvidíte na odkazu níže – je jen pro vás, nikomu ho nepřeposílejte.', odkaz.klic);
    }
    return { ok: true, id: id, vs: vs, kategorie: d.kategorie, odkaz: odkaz ? prhOdkazUrl_(odkaz.klic) : '', data: prhJson_(h.reduce((o, x, j) => (o[x] = r[j], o), {})) };
  } finally { lock.releaseLock(); }
}

/** Veřejný formulář na webu (bez přihlášení): Turnstile + limity F3. Chyby vrací jako text, ne výjimkou (anonymní dotaz jinak dostane jen „Chyba serveru“). */
function prihlaskaVerejna_(req) {
  if (!prihlaskyZapnute_()) return { ok: false, chyba: 'Online přihlášky jsou teď vypnuté. Ozvěte se kanceláři OSH.' };
  const ts = overitTurnstile_(req.turnstile, 'prihlaska');
  if (ts) return { ok: false, chyba: ts };
  const d = req.data || {};
  if (limit_('prihlaska-web', 'web', PRH_LIMIT_WEB, 600)) return { ok: false, chyba: 'Služba je teď přetížená. Zkuste to za 10 minut.' };
  if (limit_('prihlaska-email', normEmail_(d.email) || 'bez e-mailu', PRH_LIMIT_EMAIL, 3600)) return { ok: false, chyba: 'Z tohoto e-mailu už přišlo několik přihlášek. Zkuste to za hodinu.' };
  const s = prhSbor_(req.sbor);
  if (!s) return { ok: false, chyba: 'Sbor nenalezen. Otevřete přihlášku z odkazu na stránce sboru.' };
  try { return prhZalozit_(d, s, 'veřejný formulář', 'web'); }
  catch (e) { console.error('Přihláška z webu: ' + e.message + '\n' + e.stack); return { ok: false, chyba: 'Přihlášku se nepodařilo uložit. Zkuste to prosím znovu.' + (ostryRezim_() ? '' : ' (TEST: ' + String(e.message).slice(0, 200) + ')') }; } // technický důvod jen v režimu TEST – kvůli ladění
}

/* ---------- e-maily (jen jméno, sbor a odkaz – nikdy rodné číslo ani adresa) ---------- */

function prhPosta_(skupina, predmet, text, cesta) {
  if (_prhBezPosty) return;
  const url = (nastaveniWeb_('WEB_URL') || '') + '/Aplikace%20OSH.dc.html#' + cesta;
  const komu = skupina ? [skupina + '@' + (nastaveniWeb_('DOMENA') || 'oshpz.cz')]
    : radky_('Uživatelé').filter(u => ano_(u['Aktivní']) && (ano_(u['Přihlášky']) || ano_(u['Správce']))).map(u => normEmail_(u['E-mail']));
  const html = sablona_(predmet, text, [], ['Otevřít ve Spojce', url], 'Automatická zpráva ze Spojky – aplikace OSH Praha-západ.');
  komu.filter(Boolean).forEach(e => { try { posta_(e, predmet, text + '\n\n' + url, html); } catch (x) { console.error('E-mail k přihlášce: ' + x.message); } });
}

/** E-mail uchazeči (v režimu TEST jde na TEST_EMAIL). Jen jméno, sbor a osobní odkaz – nikdy rodné číslo ani adresa. */
function prhPostaUchazeci_(email, predmet, text, klic) {
  if (_prhBezPosty || !email) return;
  const url = klic ? prhOdkazUrl_(klic) : ''; // přihláška zadaná sborem osobní odkaz nemá
  const html = sablona_(predmet, text, [], url ? ['Otevřít přihlášku', url] : null, 'Automatická zpráva Okresního sdružení hasičů Praha-západ.' + (url ? ' Odkaz je jen pro vás.' : ''));
  try { posta_(email, predmet, text + (url ? '\n\n' + url : ''), html); } catch (x) { console.error('E-mail uchazeči: ' + x.message); }
}

/* ---------- API pro přihlášené ---------- */

function apiPrihlasky_(req) {
  const o = prihlaseny_(req.token);
  if (!o) return { ok: false, chyba: 'Nepřihlášen', odhlasen: true };
  const okres = smiPrihlaskyOkres_(o);
  const OKRES = ['prihlaskyOkres', 'prihlaskaDetail', 'prihlaskaRozhodnout', 'prihlaskaEvidence', 'prihlaskyExport', 'prihlaskyOdvod'];
  if (OKRES.indexOf(req.akce) >= 0) {
    if (!okres) return { ok: false, chyba: 'Přihlášky členů vyřizuje role Přihlášky nebo Správce.' };
    if (req.akce === 'prihlaskyOkres') return { ok: true, data: radky_(LIST_PRIHLASKY).filter(r => r['ID']).map(prhJson_).reverse() };
    if (req.akce === 'prihlaskyExport') return prhExport_(o);
    if (req.akce === 'prihlaskyOdvod') return prhOdvod_(o, req);
    const x = prhRadek_(req.id); if (!x) return { ok: false, chyba: 'Přihláška nenalezena.' };
    if (req.akce === 'prihlaskaDetail') return prhDetail_(x);
    if (req.akce === 'prihlaskaRozhodnout') return prhRozhodnout_(o, x, req);
    if (req.akce === 'prihlaskaEvidence') return prhEvidence_(o, x, req);
  }
  // soubory: okres (role) nebo sbor, kterému přihláška patří
  if (req.akce === 'prihlaskaPdf' || req.akce === 'prihlaskaSkenNahled' || req.akce === 'prihlaskaFotka') {
    const x = prhRadek_(req.id); if (!x) return { ok: false, chyba: 'Přihláška nenalezena.' };
    if (!okres && !pohledSboru_(o, x.r['Skupina'])) return { ok: false, chyba: 'K této přihlášce nemáte přístup.' };
    return req.akce === 'prihlaskaPdf' ? prhPdf_(o, x) : req.akce === 'prihlaskaFotka' ? prhFotkaCist_(x) : prhSkenNahled_(x, req.original === true, req.uchazec === true);
  }
  // portál sboru: jen vlastní sbor
  const u = pohledSboru_(o, req.sbor);
  if (!u) return { ok: false, chyba: 'Ke sboru ' + (req.sbor || '(nevybrán)') + ' nemáte přístup.' };
  const sk = u.sbor.skupina;
  if (req.akce === 'prihlaskySbor') {
    const s = prhSbor_(sk) || { ucet: '', nastaveni: prhNastaveniSboru_({}) };
    return { ok: true, data: radky_(LIST_PRIHLASKY).filter(r => r['ID'] && String(r['Skupina']) === sk).map(prhJson_).reverse(),
      ucet: s.ucet, prispevek: { 'dospělý': s.nastaveni.prispevekDospely, 'mladý hasič': s.nastaveni.prispevekMH }, nastaveni: s.nastaveni,
      odvod: Object.assign(prhOdvodSbor_(sk), { ucet: String(nastaveniWeb_('OKRES_UCET') || '').trim(), vs: s.nastaveni.regCislo, sazby: { 'dospělý': prhOdvodKc_('dospělý'), 'mladý hasič': prhOdvodKc_('mladý hasič') } }),
      zapnuto: prihlaskyZapnute_(), sbory: radkyRychle_('Sbory').filter(r => r['Sbor'] && String(r['Aktivní']).trim().toUpperCase() !== 'NE' && String(r['Skupina'] || '').toLowerCase().split('@')[0] !== sk).map(r => String(r['Sbor'])).sort((a, b) => a.localeCompare(b, 'cs')) };
  }
  if (req.akce === 'prihlaskyNastaveni') return prhUlozitNastaveni_(o, sk, req);
  if (req.akce === 'prihlaskaOdvodZaplacen') return prhOdvodZaplacen_(o, sk, req);
  if (req.akce === 'prihlaskaNova') {
    const s = prhSbor_(sk); if (!s) return { ok: false, chyba: 'Sbor nenalezen v listu Sbory.' };
    if (limit_('prihlaska-sbor', o.email, 30, 3600)) return { ok: false, chyba: 'Příliš mnoho přihlášek za hodinu. Zkuste to později.' };
    return prhZalozit_(req.data || {}, s, o.email, 'sbor');
  }
  const x = prhRadek_(req.id); if (!x) return { ok: false, chyba: 'Přihláška nenalezena.' };
  if (String(x.r['Skupina']) !== sk) return { ok: false, chyba: 'Přihláška patří jinému sboru.' };
  if (req.akce === 'prihlaskaSken') return prhSken_(o, x, req);
  if (req.akce === 'prihlaskaPosoudit') return prhPosoudit_(o, x, req);
  if (req.akce === 'prihlaskaFotkaNahrat') return prhFotka_(o, x, req);
  if (req.akce === 'prihlaskaPredat') return prhPredat_(o, x);
  if (req.akce === 'prihlaskaZaplaceno') return prhZaplaceno_(o, x, req);
  if (req.akce === 'prihlaskaStahnout') return prhKonec_(o, x, 'zrušeno', PRH_STAVY_STAHNOUT, '');
  return { ok: false, chyba: 'Neznámá akce' };
}

/** Sbor si sám nastaví výši příspěvků a výchozí „sportovec“ u MH a dospělých (vnitřní nastavení sboru – okres to neschvaluje). Prázdná částka = výchozí z Nastavení. */
function prhUlozitNastaveni_(o, sk, req) {
  const kc = v => v === '' || v == null ? '' : (/^\d{1,5}$/.test(String(v).trim()) ? Number(String(v).trim()) : NaN);
  const dosp = kc(req.prispevekDospely), mh = kc(req.prispevekMH);
  if (Number.isNaN(dosp) || Number.isNaN(mh)) return { ok: false, chyba: 'Příspěvek zadejte jako celé číslo v Kč (0–99999), nebo nechte prázdné.' };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = dataSs_().getSheetByName('Sbory'), h = hlavicka_(sh), col = k => h.indexOf(k);
    if (col('Příspěvek dospělý') < 0 || col('MH jako sportovec') < 0) return { ok: false, chyba: 'V listu Sbory chybí sloupce nastavení přihlášek – okres musí spustit Založit / doplnit strukturu.' };
    const v = sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues();
    const i = v.findIndex(r => String(r[col('Skupina')] || '').toLowerCase().split('@')[0] === sk);
    if (i < 0) return { ok: false, chyba: 'Sbor nenalezen v listu Sbory.' };
    const pred = [v[i][col('Příspěvek dospělý')], v[i][col('Příspěvek MH')], v[i][col('MH jako sportovec')], col('Dospělý jako sportovec') >= 0 ? v[i][col('Dospělý jako sportovec')] : ''].join(' / ');
    const dSport = req.dospelySportovec === true ? 'ANO' : 'NE';
    sh.getRange(i + 2, col('Příspěvek dospělý') + 1).setValue(dosp);
    sh.getRange(i + 2, col('Příspěvek MH') + 1).setValue(mh);
    sh.getRange(i + 2, col('MH jako sportovec') + 1).setValue(req.mhSportovec === true ? 'ANO' : 'NE');
    if (col('Dospělý jako sportovec') >= 0) sh.getRange(i + 2, col('Dospělý jako sportovec') + 1).setValue(dSport);
    vycistitMezipamet_('Sbory'); CacheService.getScriptCache().removeAll(['v_sbory', 'v_web']);
    zaznamZmeny_(o.email, 'Sbory', sk, 'upraveno', pred, 'nastavení přihlášek: ' + [dosp, mh, req.mhSportovec === true ? 'ANO' : 'NE', dSport].join(' / '));
    return { ok: true, nastaveni: prhNastaveniSboru_({ 'Příspěvek dospělý': dosp, 'Příspěvek MH': mh, 'MH jako sportovec': req.mhSportovec === true ? 'ANO' : 'NE', 'Dospělý jako sportovec': dSport, 'Registrační číslo': v[i][col('Registrační číslo')] }) };
  } finally { lock.releaseLock(); }
}

function prhStav_(o, x, stav, povolene, poznamka, dalsi) {
  const pred = x.r['Stav'];
  if (povolene.indexOf(pred) < 0) return { ok: false, chyba: 'Přihláška ve stavu „' + pred + '“ to neumožňuje.' };
  prhZapsat_(x, Object.assign({ 'Stav': stav, 'Stav od': new Date(), 'Poznámka': poznamka == null ? x.r['Poznámka'] : bezVzorce_(poznamka) }, dalsi || {}), o.email);
  zaznamZmeny_(o.email, LIST_PRIHLASKY, x.r['ID'], 'upraveno', pred, stav);
  return { ok: true, data: prhJson_(x.r) };
}

/** Sken podepsané přihlášky – jen nahraje (předání okresu je zvlášť: prhPredat_). Starší skeny zůstávají ve složce jako doklad. */
function prhSken_(o, x, req) {
  if (PRH_STAVY_SKEN.indexOf(x.r['Stav']) < 0) return { ok: false, chyba: 'Sken jde nahrát jen k přihlášce, která ještě není u okresu.' };
  if (!x.r['Zaplaceno']) return { ok: false, chyba: 'Nejdřív potvrďte, že člen zaplatil příspěvek sboru (Zaplaceno).' };
  const nazev = String(req.nazev || 'sken').trim(), mime = String(req.mime || '');
  let b; try { b = Utilities.base64Decode(String(req.data || '')); } catch (e) { return { ok: false, chyba: 'Soubor se nepodařilo přečíst.' }; }
  const ch = overitSoubor_(nazev, mime, b.length, null, b); if (ch) return { ok: false, chyba: ch };
  const slozka = DriveApp.getFolderById(x.r['Složka – ID']);
  const pripona = (SOUBORY_POVOLENE[mime] || 'pdf');
  const f = slozka.createFile(Utilities.newBlob(b, mime, 'Sken ' + x.r['ID'] + ' ' + Utilities.formatDate(new Date(), 'Europe/Prague', 'yyyy-MM-dd HH-mm') + '.' + pripona));
  prhZapsat_(x, { 'Sken – ID': f.getId() }, o.email);
  zaznamZmeny_(o.email, LIST_PRIHLASKY, x.r['ID'], 'upraveno', '', 'sken nahrán');
  return { ok: true, data: prhJson_(x.r) };
}

/** Digitální fotka člena (JPEG/PNG, zmenšená prohlížečem). Nahrazuje předchozí fotku (ta jde do koše). */
function prhFotka_(o, x, req) {
  if (PRH_STAVY_SKEN.indexOf(x.r['Stav']) < 0) return { ok: false, chyba: 'Fotku jde nahrát jen k přihlášce, která ještě není u okresu.' };
  if (x.col('Fotka – ID') < 0) return { ok: false, chyba: 'V listu Členské přihlášky chybí sloupec Fotka – ID – okres musí spustit Založit / doplnit strukturu.' };
  const mime = String(req.mime || '');
  if (!/^image\/(jpeg|png)$/.test(mime)) return { ok: false, chyba: 'Fotka musí být obrázek JPG nebo PNG.' };
  let b; try { b = Utilities.base64Decode(String(req.data || '')); } catch (e) { return { ok: false, chyba: 'Fotku se nepodařilo přečíst.' }; }
  if (!b.length || b.length > PRH_FOTO_MAX) return { ok: false, chyba: 'Fotka je prázdná nebo větší než 3 MB.' };
  const ch = overitSoubor_('fotka.' + (mime === 'image/png' ? 'png' : 'jpg'), mime, b.length, null, b); if (ch) return { ok: false, chyba: ch };
  const f = DriveApp.getFolderById(x.r['Složka – ID']).createFile(Utilities.newBlob(b, mime, 'Fotka ' + x.r['ID'] + (mime === 'image/png' ? '.png' : '.jpg')));
  if (x.r['Fotka – ID']) { try { DriveApp.getFileById(x.r['Fotka – ID']).setTrashed(true); } catch (e) {} }
  prhZapsat_(x, { 'Fotka – ID': f.getId() }, o.email);
  zaznamZmeny_(o.email, LIST_PRIHLASKY, x.r['ID'], 'upraveno', '', 'fotka nahrána');
  return { ok: true, data: prhJson_(x.r) };
}

/** Fotka pro aplikaci (sbor své přihlášky, okres role Přihlášky) jako data URL. */
function prhFotkaCist_(x) {
  if (!x.r['Fotka – ID'] || x.r['Údaje smazány']) return { ok: false, chyba: 'Fotka není nahraná.' };
  try { const b = DriveApp.getFileById(x.r['Fotka – ID']).getBlob(); return { ok: true, nazev: 'Fotka ' + x.r['ID'] + (b.getContentType() === 'image/png' ? '.png' : '.jpg'), mime: b.getContentType(), data: Utilities.base64Encode(b.getBytes()) }; }
  catch (e) { return { ok: false, chyba: 'Fotku se nepodařilo otevřít.' }; }
}

/** Předání okresu: po zaplacení příspěvku sboru, se skenem a fotkou. Odvod okresu vznikne nejpozději teď – nezaplacený je dluh sboru. */
function prhPredat_(o, x) {
  const r = x.r, chybi = [!r['Zaplaceno'] ? 'potvrzení platby člena (Zaplaceno)' : '', !r['Sken – ID'] ? 'sken podepsané přihlášky' : '', !r['Fotka – ID'] ? 'fotka člena' : ''].filter(Boolean);
  if (PRH_STAVY_SKEN.indexOf(r['Stav']) < 0) return { ok: false, chyba: 'Přihláška ve stavu „' + r['Stav'] + '“ už je u okresu nebo vyřízená.' };
  if (chybi.length) return { ok: false, chyba: 'Před předáním okresu chybí: ' + chybi.join(', ') + '.' };
  const v = prhStav_(o, x, 'sken u okresu', PRH_STAVY_SKEN, '', Number(r['Odvod']) > 0 ? {} : { 'Odvod': prhOdvodKc_(r['Kategorie']) || '' });
  if (!v.ok) return v;
  prhPosta_('', 'Přihláška ke kontrole: ' + r['Jméno'] + ' ' + r['Příjmení'] + ' (' + r['Sbor'] + ')',
    'Sbor předal podepsanou přihlášku se skenem a fotkou. Zkontrolujte ji ve správě okresu → Sbory → Přihlášky členů.', 'okres/clenove/' + r['ID']);
  if (Number(x.r['Odvod']) > 0 && !x.r['Odvod zaplacen'] && !x.r['Odvod přijat']) v.upozorneni = 'Odvod okresu ' + x.r['Odvod'] + ' Kč zatím není zaplacený – vedeme ho jako dluh sboru.';
  v.odvod = prhOdvodSbor_(String(r['Skupina']));
  return v;
}

/** Sbor označí odvod okresu za vybrané přihlášky jako zaplacený (nebo označení zruší, dokud ho okres nepřijal). Jde i před předáním. */
function prhOdvodZaplacen_(o, sk, req) {
  const ids = Array.isArray(req.ids) ? req.ids.map(String).slice(0, 300) : [], zap = req.zaplaceno !== false;
  if (!ids.length) return { ok: false, chyba: 'Vyberte přihlášky.' };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = dataSs_().getSheetByName(LIST_PRIHLASKY), h = hlavicka_(sh), col = k => h.indexOf(k);
    if (col('Odvod zaplacen') < 0) return { ok: false, chyba: 'V listu Členské přihlášky chybí sloupec Odvod zaplacen – okres musí spustit Založit / doplnit strukturu.' };
    const rng = sh.getRange(2, 1, sh.getLastRow() - 1, h.length), v = rng.getValues(), ted = new Date(), zaznamy = [], zmenene = [];
    v.forEach(r => {
      if (ids.indexOf(String(r[col('ID')])) < 0 || String(r[col('Skupina')]) !== sk || PRH_ODVOD_AKTIVNI.indexOf(r[col('Stav')]) < 0 || r[col('Odvod přijat')]) return;
      if (!!r[col('Odvod zaplacen')] === zap) return;
      const predano = PRH_ODVOD_STAVY.indexOf(r[col('Stav')]) >= 0;
      if (zap && !(Number(r[col('Odvod')]) > 0)) r[col('Odvod')] = prhOdvodKc_(r[col('Kategorie')]) || '';
      if (zap && !(Number(r[col('Odvod')]) > 0)) return; // okres nemá nastavený odvod (0 Kč)
      if (!zap && !predano) r[col('Odvod')] = ''; // před předáním odvod ještě nevznikl
      r[col('Odvod zaplacen')] = zap ? ted : ''; r[col('Upraveno')] = ted; r[col('Upravil')] = o.email;
      zaznamy.push([o.email, LIST_PRIHLASKY, r[col('ID')], 'upraveno', '', zap ? 'odvod zaplacen sborem (' + r[col('Odvod')] + ' Kč)' : 'označení platby odvodu zrušeno']);
      zmenene.push(r);
    });
    if (!zmenene.length) return { ok: false, chyba: 'Žádná z vybraných přihlášek nemá odvod ke změně (už ho okres přijal, nebo není nastavená částka).' };
    rng.setValues(v);
    zaznamZmenyHromadne_(zaznamy);
    return { ok: true, data: zmenene.map(r => prhJson_(h.reduce((x, k, j) => (x[k] = r[j], x), {}))), odvod: prhOdvodSbor_(sk) };
  } finally { lock.releaseLock(); }
}

/** Zrušení sborem / zamítnutí okresem: nezaplacený odvod zanikne; zaplacený nebo přijatý zůstane s upozorněním na vrácení peněz. */
function prhKonec_(o, x, stav, povolene, duvod) {
  const zaplaceno = !!x.r['Odvod přijat'] || !!x.r['Odvod zaplacen'];
  const v = prhStav_(o, x, stav, povolene, duvod, zaplaceno ? {} : { 'Odvod': '' });
  if (v.ok && zaplaceno && Number(x.r['Odvod']) > 0) v.upozorneni = 'Odvod okresu za tohoto člena už byl zaplacený – vrácení peněz vyřešte mezi sborem a okresem.';
  return v;
}

function prhZaplaceno_(o, x, req) {
  const zap = req.zaplaceno !== false;
  // platba člena sboru je před předáním okresu; zrušit „Zaplaceno“ jde jen, dokud přihláška není u okresu
  if (zap && PRH_STAVY_SKEN.indexOf(x.r['Stav']) < 0) return { ok: false, chyba: 'Platbu potvrdíte u přihlášky, která ještě není u okresu.' };
  if (!zap && PRH_STAVY_SKEN.indexOf(x.r['Stav']) < 0) return { ok: false, chyba: 'Přihláška už je u okresu – platbu zrušit nejde.' };
  prhZapsat_(x, { 'Zaplaceno': zap ? new Date() : '' }, o.email);
  zaznamZmeny_(o.email, LIST_PRIHLASKY, x.r['ID'], 'upraveno', '', zap ? 'zaplaceno' : 'platba zrušena');
  return { ok: true, data: prhJson_(x.r) };
}

function prhRozhodnout_(o, x, req) {
  const roz = String(req.rozhodnuti || ''), duvod = String(req.duvod || '').trim();
  const ch = kontrolaTextu_({ 'Důvod': duvod }, { 'Důvod': 500 }); if (ch) return { ok: false, chyba: ch };
  if ((roz === 'vrátit' || roz === 'zamítnout') && !duvod) return { ok: false, chyba: 'Napište důvod – sbor ho uvidí.' };
  // odvod okresu vznikl předáním (u starších přihlášek ho doplní schválení); vrácení ho nechá (sbor přihlášku předá znovu), zamítnutí zruší nezaplacený
  let v;
  if (roz === 'schválit') v = prhStav_(o, x, 'schváleno', ['sken u okresu'], '', Number(x.r['Odvod']) > 0 ? {} : { 'Odvod': prhOdvodKc_(x.r['Kategorie']) || '' });
  else if (roz === 'vrátit') v = prhStav_(o, x, 'vráceno', ['sken u okresu', 'schváleno'], duvod);
  else if (roz === 'zamítnout') v = prhKonec_(o, x, 'zamítnuto', ['přijato', 'sken u okresu', 'vráceno', 'schváleno'], duvod);
  else return { ok: false, chyba: 'Neznámé rozhodnutí.' };
  if (v.ok) {
    const jm = x.r['Jméno'] + ' ' + x.r['Příjmení'];
    const text = roz === 'schválit' ? 'Okres schválil přihlášku ' + jm + ' a zapíše člena do evidence SH ČMS.'
      : roz === 'vrátit' ? 'Okres vrátil přihlášku ' + jm + '. Důvod: ' + duvod + '. Opravte ji (nový sken nebo fotka) a předejte okresu znovu.'
      : 'Okres zamítl přihlášku ' + jm + '. Důvod: ' + duvod + '.';
    prhPosta_(x.r['Skupina'], (roz === 'schválit' ? 'Přihláška schválena: ' : roz === 'vrátit' ? 'Přihláška vrácena: ' : 'Přihláška zamítnuta: ') + jm, text, 'sbor/' + x.r['Skupina'] + '/clenove');
  }
  return v;
}

/**
 * Sbor posoudí žádost uchazeče (výbor SDH): přijmout (sportovec, datum schválení výborem), vyžádat doplnění, nebo nepřijmout.
 * Poznámka je u doplnění a nepřijetí povinná – uchazeč ji dostane e-mailem s osobním odkazem.
 */
function prhPosoudit_(o, x, req) {
  const roz = String(req.rozhodnuti || ''), pozn = String(req.poznamka || '').trim();
  const ch = kontrolaTextu_({ 'Poznámka': pozn }, { 'Poznámka': 1000 }); if (ch) return { ok: false, chyba: ch };
  if (PRH_STAVY_ZADOST.indexOf(x.r['Stav']) < 0) return { ok: false, chyba: 'O přihlášce už je rozhodnuto (' + x.r['Stav'] + ').' };
  if ((roz === 'doplnit' || roz === 'nepřijmout') && !pozn) return { ok: false, chyba: roz === 'doplnit' ? 'Napište uchazeči, co má doplnit.' : 'Napište uchazeči důvod.' };
  const jm = x.r['Jméno'] + ' ' + x.r['Příjmení'], sbor = String(x.r['Sbor']).replace(/^SDH\s+/i, ''), kp = String(x.r['Kategorie']) === 'mladý hasič';
  let v, predmet, text;
  if (roz === 'přijmout') {
    if (req.sportovec !== true && req.sportovec !== false) return { ok: false, chyba: 'Vyberte, jestli evidovat i jako sportovce.' };
    const dv = String(req.datumVyboru || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dv)) return { ok: false, chyba: 'Vyplňte datum, kdy výbor SDH přijetí schválil.' };
    v = prhStav_(o, x, 'přijato', PRH_STAVY_ZADOST, pozn, { 'Sportovec': req.sportovec ? 'ANO' : 'NE', 'Schváleno výborem': new Date(dv + 'T00:00:00') });
    predmet = 'Vítejte v SDH ' + sbor + ' – žádost přijata';
    text = 'Dobrý den,\n\nvýbor SDH ' + sbor + ' přijal ' + (kp ? 'přihlášku mladého hasiče ' : 'vaši žádost o členství – ') + jm + '.' + (pozn ? '\n\nPoznámka sboru: ' + pozn : '') +
      '\n\nDalší postup najdete na odkazu níže: zaplaťte členský příspěvek sboru (QR platba), stáhněte přihlášku, ' + (kp ? 'nechte ji podepsat zákonného zástupce' : 'podepište ji') +
      ' a nahrajte podepsaný sken – nebo ji přineste do sboru. Sbor ji pak předá okresu k zápisu do evidence SH ČMS.';
  } else if (roz === 'doplnit') {
    v = prhStav_(o, x, 'doplnit', PRH_STAVY_ZADOST, pozn);
    predmet = 'SDH ' + sbor + ': doplňte prosím žádost o členství';
    text = 'Dobrý den,\n\nSDH ' + sbor + ' prosí o doplnění žádosti (' + jm + '):\n' + pozn + '\n\nÚdaje opravíte a žádost znovu odešlete na odkazu níže.';
  } else if (roz === 'nepřijmout') {
    v = prhKonec_(o, x, 'nepřijato', PRH_STAVY_ZADOST, pozn);
    predmet = 'SDH ' + sbor + ': žádost o členství';
    text = 'Dobrý den,\n\nSDH ' + sbor + ' vaši žádost o členství (' + jm + ') nepřijal.\n\nDůvod: ' + pozn;
  } else return { ok: false, chyba: 'Neznámé rozhodnutí.' };
  const klic = v.ok && x.r['Odkaz – otisk'] ? (prhUdaje_(x.r) || {}).odkazKlic : '';
  if (klic) {
    prhPostaUchazeci_(String(x.r['E-mail'] || ''), predmet, text, klic);
    if (!ostryRezim_()) v.odkaz = prhOdkazUrl_(klic); // jen v TESTu – e-mail jde na TEST_EMAIL, odkaz pro vyzkoušení
  }
  return v;
}

/** Uchazeč podle osobního odkazu (?stranka=prihlaska&k=…) – bez přihlášení; klíč porovnáváme s otiskem v tabulce. */
function prhPodleOdkazu_(klic) {
  if (!/^[a-f0-9]{64}$/.test(String(klic || ''))) return null;
  const ot = otisk_('prh|' + klic), sh = dataSs_().getSheetByName(LIST_PRIHLASKY), h = hlavicka_(sh), c = h.indexOf('Odkaz – otisk');
  if (c < 0 || sh.getLastRow() < 2) return null;
  const v = sh.getRange(2, c + 1, sh.getLastRow() - 1, 1).getValues(), i = v.findIndex(r => r[0] === ot);
  return i < 0 ? null : prhRadek_(sh.getRange(i + 2, h.indexOf('ID') + 1).getValue());
}

/**
 * Veřejná akce prihlaskaUchazec { k, krok }: stav (co uchazeč vidí a má udělat), pdf (po přijetí), sken (podepsaná přihláška),
 * doplnit (opravené údaje při „doplnit“ – znovu jde sboru k posouzení). Údaje (rodné číslo, adresa) vrací jen ve stavu doplnit k opravě.
 */
function prihlaskaUchazec_(req) {
  const x = prhPodleOdkazu_(req.k);
  if (!x) return { ok: false, chyba: 'Odkaz neplatí. Použijte prosím odkaz z posledního e-mailu, nebo se ozvěte sboru.' };
  if (limit_('prihlaska-odkaz', String(x.r['ID']), 60, 3600)) return { ok: false, chyba: 'Příliš mnoho pokusů. Zkuste to za hodinu.' };
  const r = x.r, krok = String(req.krok || 'stav'), stav = r['Stav'], kdo = 'uchazeč (' + normEmail_(r['E-mail']) + ')';
  const sb = prhSbor_(r['Skupina']) || { ucet: '', nastaveni: {} };
  if (krok === 'stav') {
    const castka = r['Kategorie'] === 'mladý hasič' ? sb.nastaveni.prispevekMH : sb.nastaveni.prispevekDospely;
    const out = { ok: true, data: { id: r['ID'], stav: stav, jmeno: r['Jméno'] + ' ' + r['Příjmení'], sbor: r['Sbor'], kategorie: r['Kategorie'], poznamka: String(r['Poznámka'] || ''),
      prestup: !!r['Přestup z'], zaplaceno: !!r['Zaplaceno'], evidencniCislo: stav === 'zapsáno' ? String(r['Evidenční číslo'] || '') : '',
      clenemOd: stav === 'zapsáno' && r['Členem od'] instanceof Date ? Utilities.formatDate(r['Členem od'], 'Europe/Prague', 'yyyy-MM-dd') : '', maSken: !!r['Sken uchazeče – ID'], maPdf: !!r['PDF – ID'] && !r['Údaje smazány'] && PRH_STAVY_PDF.indexOf(stav) >= 0,
      platba: { ucet: sb.ucet, castka: Number(castka) || 0, vs: String(r['Variabilní symbol'] || '') } } };
    if (stav === 'doplnit') {
      const u = prhUdaje_(r) || {};
      out.udaje = { kategorie: r['Kategorie'], jmeno: u.jmeno, prijmeni: u.prijmeni, rc: u.rc, ulice: u.ulice, obec: u.obec, psc: u.psc, prislusnost: u.prislusnost,
        telefon: u.telefon, email: u.email, trvalyPobyt: !!u.trvalyPobyt, zzJmeno: u.zzJmeno, zzNarozeni: u.zzNarozeni, zzTelefon: u.zzTelefon, prestupZ: u.prestupZ, motivace: u.motivace || String(r['Motivační dopis'] || '') };
    }
    return out;
  }
  if (krok === 'pdf') {
    if (PRH_STAVY_PDF.indexOf(stav) < 0 || !r['PDF – ID'] || r['Údaje smazány']) return { ok: false, chyba: 'Přihláška k tisku teď není k dispozici.' };
    zaznamZmeny_(kdo, LIST_PRIHLASKY, r['ID'], 'čteno', '', 'stažení PDF uchazečem');
    return Object.assign({ ok: true, nazev: 'Prihlaska ' + r['ID'] + '.pdf', data: Utilities.base64Encode(DriveApp.getFileById(r['PDF – ID']).getBlob().getBytes()) }, prhDoplnitPdf_(r));
  }
  if (krok === 'sken') {
    if (PRH_STAVY_SKEN.indexOf(stav) < 0) return { ok: false, chyba: 'Podepsanou přihlášku teď nahrát nejde (stav ' + stav + ').' };
    if (x.col('Sken uchazeče – ID') < 0) return { ok: false, chyba: 'Nahrávání se teď upravuje – zkuste to prosím za chvíli.' };
    const nazev = String(req.nazev || 'sken').trim(), mime = String(req.mime || '');
    let b; try { b = Utilities.base64Decode(String(req.data || '')); } catch (e) { return { ok: false, chyba: 'Soubor se nepodařilo přečíst.' }; }
    const chS = overitSoubor_(nazev, mime, b.length, null, b); if (chS) return { ok: false, chyba: chS };
    const f = DriveApp.getFolderById(r['Složka – ID']).createFile(Utilities.newBlob(b, mime, 'Podepsaná přihláška od uchazeče ' + r['ID'] + '.' + (SOUBORY_POVOLENE[mime] || 'pdf')));
    prhZapsat_(x, { 'Sken uchazeče – ID': f.getId() }, kdo);
    zaznamZmeny_(kdo, LIST_PRIHLASKY, r['ID'], 'upraveno', '', 'uchazeč nahrál podepsanou přihlášku');
    prhPosta_(r['Skupina'], 'Podepsaná přihláška: ' + r['Jméno'] + ' ' + r['Příjmení'], 'Uchazeč nahrál podepsanou přihlášku. Stáhněte si ji v portálu sboru (Přihlášky členů), ' +
      'doplňte razítko a podpis starosty a nahrajte finální sken pro okres.', 'sbor/' + r['Skupina'] + '/clenove');
    return { ok: true };
  }
  if (krok === 'doplnit') {
    if (stav !== 'doplnit') return { ok: false, chyba: 'Žádost teď doplnit nejde – sbor o ní už rozhodl.' };
    const k = prhKontrola_(req.data || {}, true); if (k.chyba) return { ok: false, chyba: k.chyba };
    const P = prhPdfBajty_((req.data || {}).pdf); if (P.chyba) return { ok: false, chyba: P.chyba };
    let F = null; if ((req.data || {}).fotka) { F = prhFotkaBlob_(req.data.fotka, req.data.fotkaMime, 'Fotka ' + r['ID']); if (F.chyba) return { ok: false, chyba: F.chyba }; }
    const d = k.d, slozka = DriveApp.getFolderById(r['Složka – ID']), puvodni = prhUdaje_(r) || {};
    const uf = prhSouborVeSlozce_(r['Složka – ID'], 'udaje.json');
    const nove = JSON.stringify(Object.assign({}, puvodni, d, { datumNarozeni: k.rc.datum, doplneno: new Date().toISOString() }), null, 1);
    if (uf) uf.setContent(nove); else slozka.createFile('udaje.json', nove, 'application/json');
    const fPdf = slozka.createFile(Utilities.newBlob(P.pdf, 'application/pdf', 'Prihlaska ' + r['ID'] + '.pdf'));
    try { DriveApp.getFileById(r['PDF – ID']).setTrashed(true); } catch (e) {}
    const zm = { 'Jméno': bezVzorce_(d.jmeno), 'Příjmení': bezVzorce_(d.prijmeni), 'Datum narození': new Date(k.rc.datum + 'T00:00:00'), 'Kategorie': d.kategorie,
      'E-mail': d.email, 'Telefon': bezVzorce_(d.telefon), 'Zákonný zástupce': bezVzorce_(d.zzJmeno), 'Přestup z': bezVzorce_(d.prestupZ), 'Motivační dopis': bezVzorce_(d.motivace),
      'PDF – ID': fPdf.getId() };
    if (F) { const ff = slozka.createFile(F.blob); if (r['Fotka – ID']) { try { DriveApp.getFileById(r['Fotka – ID']).setTrashed(true); } catch (e) {} } zm['Fotka – ID'] = ff.getId(); }
    const v = prhStav_({ email: kdo }, x, 'žádost', ['doplnit'], '', zm);
    if (v.ok) prhPosta_(r['Skupina'], 'Doplněná žádost: ' + d.jmeno + ' ' + d.prijmeni, 'Uchazeč doplnil žádost o členství. Posuďte ji znovu v portálu sboru (Přihlášky členů).', 'sbor/' + r['Skupina'] + '/clenove');
    return v.ok ? { ok: true } : v;
  }
  return { ok: false, chyba: 'Neznámá akce' };
}

/** Chyby veřejné akce vrací jako text (anonymní dotaz by jinak dostal jen „Chyba serveru“). */
function prihlaskaUchazecBezpecne_(req) {
  try { return prihlaskaUchazec_(req); }
  catch (e) { console.error('Odkaz uchazeče: ' + e.message + '\n' + e.stack); return { ok: false, chyba: 'Akce se nepodařila. Zkuste to prosím znovu.' + (ostryRezim_() ? '' : ' (TEST: ' + String(e.message).slice(0, 200) + ')') }; }
}

/** Jednorázově (Založit / doplnit strukturu): stav „odesláno“ se od žádostí uchazečů jmenuje „přijato“ (přihláška u sboru, po přijetí). */
function prhMigrace_() {
  const sh = dataSs_().getSheetByName(LIST_PRIHLASKY); if (!sh || sh.getLastRow() < 2) return 0;
  const h = hlavicka_(sh), c = h.indexOf('Stav'); if (c < 0) return 0;
  const rng = sh.getRange(2, c + 1, sh.getLastRow() - 1, 1), v = rng.getValues(); let n = 0;
  v.forEach(r => { if (r[0] === 'odesláno') { r[0] = 'přijato'; n++; } });
  if (n) rng.setValues(v);
  return n;
}

/** Výše odvodu okresu za nového člena podle kategorie (Nastavení ODVOD_DOSPELY / ODVOD_MH). */
function prhOdvodKc_(kategorie) { return Number(nastaveniWeb_(kategorie === 'mladý hasič' ? 'ODVOD_MH' : 'ODVOD_DOSPELY') || 0) || 0; }

/** Odvody sboru: dluh = předané přihlášky s odvodem, který sbor ještě nezaplatil; ceka = sbor zaplatil, okres zatím nepotvrdil. */
function prhOdvodSbor_(sk) {
  const vse = radky_(LIST_PRIHLASKY).filter(r => r['ID'] && String(r['Skupina']) === sk && Number(r['Odvod']) > 0 && !r['Odvod přijat']);
  const dluh = vse.filter(r => PRH_ODVOD_STAVY.indexOf(r['Stav']) >= 0 && !r['Odvod zaplacen']), ceka = vse.filter(r => PRH_ODVOD_AKTIVNI.indexOf(r['Stav']) >= 0 && r['Odvod zaplacen']);
  const kc = a => a.reduce((n, r) => n + Number(r['Odvod']), 0);
  return { dluh: kc(dluh), pocet: dluh.length, ids: dluh.map(r => String(r['ID'])), ceka: kc(ceka), cekaPocet: ceka.length };
}

/** Okres označí odvody za vybrané přihlášky jako přijaté (nebo přijetí zruší). ids = pole ID, nejvýš 300. */
function prhOdvod_(o, req) {
  const ids = Array.isArray(req.ids) ? req.ids.map(String).slice(0, 300) : [], prijato = req.prijato !== false;
  if (!ids.length) return { ok: false, chyba: 'Vyberte přihlášky.' };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = dataSs_().getSheetByName(LIST_PRIHLASKY), h = hlavicka_(sh), col = k => h.indexOf(k);
    if (col('Odvod přijat') < 0) return { ok: false, chyba: 'V listu Členské přihlášky chybí sloupce odvodu – spusťte Založit / doplnit strukturu.' };
    const rng = sh.getRange(2, 1, sh.getLastRow() - 1, h.length), v = rng.getValues(), ted = new Date(), zaznamy = [], zmenene = [];
    v.forEach(r => {
      if (ids.indexOf(String(r[col('ID')])) < 0 || !(Number(r[col('Odvod')]) > 0) || PRH_ODVOD_AKTIVNI.indexOf(r[col('Stav')]) < 0) return;
      if (!!r[col('Odvod přijat')] === prijato) return;
      r[col('Odvod přijat')] = prijato ? ted : ''; r[col('Upraveno')] = ted; r[col('Upravil')] = o.email;
      zaznamy.push([o.email, LIST_PRIHLASKY, r[col('ID')], 'upraveno', '', prijato ? 'odvod přijat (' + r[col('Odvod')] + ' Kč)' : 'přijetí odvodu zrušeno']);
      zmenene.push(r);
    });
    if (!zmenene.length) return { ok: false, chyba: 'Žádná z vybraných přihlášek nemá odvod ke změně.' };
    rng.setValues(v);
    zaznamZmenyHromadne_(zaznamy);
    return { ok: true, data: zmenene.map(r => prhJson_(h.reduce((x, k, j) => (x[k] = r[j], x), {}))) };
  } finally { lock.releaseLock(); }
}

/** Zápis do Centrální evidence: evidenční číslo a den vzniku členství. Poprvé jde novému členovi e-mail (Stanovy SH ČMS 2025, čl. 19 odst. 5: SDH ho neprodleně vyrozumí o zápisu a dni vzniku členství přes kontakt z přihlášky). */
function prhEvidence_(o, x, req) {
  const cislo = String(req.cislo || '').trim(), den = String(req.clenemOd || '').trim() || Utilities.formatDate(new Date(), 'Europe/Prague', 'yyyy-MM-dd');
  if (!/^[\w\/-]{1,20}$/.test(cislo)) return { ok: false, chyba: 'Vyplňte evidenční číslo z evidencesdh.cz (písmena, číslice, - a /).' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(den)) return { ok: false, chyba: 'Den zápisu do evidence má tvar RRRR-MM-DD.' };
  const poprve = x.r['Stav'] !== 'zapsáno';
  const v = prhStav_(o, x, 'zapsáno', ['schváleno', 'zapsáno'], null, { 'Evidenční číslo': bezVzorce_(cislo), 'Členem od': new Date(den + 'T00:00:00') });
  if (v.ok) try { cleZPrihlasky_(x.r, o.email); } catch (e) { console.error('Člen do seznamu (B17): ' + e.message); } // seznam členů pro soutěže (Clenove.gs)
  if (v.ok && poprve && x.r['E-mail']) {
    const sbor = String(x.r['Sbor']).replace(/^SDH\s+/i, ''), jm = x.r['Jméno'] + ' ' + x.r['Příjmení'], kp = String(x.r['Kategorie']) === 'mladý hasič';
    const denCz = Number(den.slice(8)) + '. ' + Number(den.slice(5, 7)) + '. ' + den.slice(0, 4);
    const text = 'Dobrý den,\n\n' + (kp ? jm + ' je' : 'jste') + ' od ' + denCz + ' členem SH ČMS ve Sboru dobrovolných hasičů ' + sbor + ' – členství vzniklo zápisem do Centrální evidence členů SH ČMS. ' +
      'Evidenční číslo: ' + cislo + '.\n\nVítejte mezi hasiči! Členský průkaz a další informace vám předá sbor.\n\nSDH ' + sbor + ' a Okresní sdružení hasičů Praha-západ';
    prhPostaUchazeci_(String(x.r['E-mail']), 'Vznik členství v SH ČMS – SDH ' + sbor, text, x.r['Odkaz – otisk'] ? (prhUdaje_(x.r) || {}).odkazKlic : '');
    v.vyrozumen = true;
  }
  return v;
}

/** Detail pro okres: údaje z tabulky + z udaje.json jen maskované rodné číslo, adresa, zákonný zástupce. */
function prhDetail_(x) { // jen pro roli Přihlášky (apiPrihlasky_)
  const u = prhUdaje_(x.r) || {};
  return { ok: true, data: prhJson_(x.r), detail: { rc: prhMaska_(u.rc), ulice: u.ulice || '', obec: u.obec || '', psc: u.psc || '', prislusnost: u.prislusnost || '',
    zzNarozeni: u.zzNarozeni || '', zzTelefon: u.zzTelefon || '', smazano: !!x.r['Údaje smazány'] } };
}

/** PDF přihlášky (koncept s rodným číslem) až po přijetí sborem; sportovce a datum výboru doplní a zploští prohlížeč (OSH_PRIHLASKA.dokoncit). */
function prhPdf_(o, x) {
  if (x.r['Údaje smazány'] || !x.r['PDF – ID']) return { ok: false, chyba: 'Vyplněné PDF už bylo po lhůtě smazáno.' };
  if (PRH_STAVY_PDF.indexOf(x.r['Stav']) < 0) return { ok: false, chyba: 'PDF s rodným číslem a adresou je k dispozici až po přijetí žádosti sborem.' };
  try {
    const f = DriveApp.getFileById(x.r['PDF – ID']);
    zaznamZmeny_(o.email, LIST_PRIHLASKY, x.r['ID'], 'čteno', '', 'stažení PDF');
    return Object.assign({ ok: true, nazev: 'Prihlaska ' + x.r['ID'] + '.pdf', data: Utilities.base64Encode(f.getBlob().getBytes()) }, prhDoplnitPdf_(x.r));
  } catch (e) { return { ok: false, chyba: 'PDF se nepodařilo otevřít.' }; }
}
/** Co doplnit do konceptu PDF: sportovec (null = nerozhodnuto) a datum schválení výborem. */
function prhDoplnitPdf_(r) {
  const den = v => v instanceof Date ? Utilities.formatDate(v, 'Europe/Prague', 'yyyy-MM-dd') : String(v || '').slice(0, 10);
  return { sportovec: r['Sportovec'] === 'ANO' ? true : r['Sportovec'] === 'NE' ? false : null, datumVyboru: den(r['Schváleno výborem']) };
}

/** Náhled skenu (Disk ho zmenší na 1600 px, i z PDF), nebo původní soubor ke stažení. uchazec = sken, který nahrál uchazeč přes svůj odkaz. */
function prhSkenNahled_(x, original, uchazec) {
  const sl = uchazec ? 'Sken uchazeče – ID' : 'Sken – ID';
  if (!x.r[sl]) return { ok: false, chyba: uchazec ? 'Uchazeč zatím nenahrál podepsanou přihlášku.' : 'Sken zatím není nahraný.' };
  const f = DriveApp.getFileById(x.r[sl]);
  if (original) return { ok: true, nazev: f.getName(), mime: f.getMimeType(), data: Utilities.base64Encode(f.getBlob().getBytes()) };
  let link = '';
  try { link = Drive.Files.get(f.getId(), { fields: 'thumbnailLink' }).thumbnailLink || ''; } catch (e) { console.warn(e.message); }
  if (link) {
    const res = UrlFetchApp.fetch(link.replace(/=s\d+(-[a-z0-9-]+)?$/i, '') + '=s1600', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (res.getResponseCode() === 200) { const b = res.getBlob(); return { ok: true, nahled: 'data:' + (b.getContentType() || 'image/png') + ';base64,' + Utilities.base64Encode(b.getBytes()), mime: f.getMimeType() }; }
  }
  // Disk náhled ještě nepřipravil (čerstvě nahraný soubor) – obrázek do 3 MB rovnou
  if (/^image\/(jpeg|png|webp)$/.test(f.getMimeType()) && f.getSize() < 3 * 1024 * 1024) return { ok: true, nahled: 'data:' + f.getMimeType() + ';base64,' + Utilities.base64Encode(f.getBlob().getBytes()), mime: f.getMimeType() };
  return { ok: true, nahled: '', mime: f.getMimeType(), pozdeji: true };
}

/** Export pro ruční přepis do evidencesdh.cz: schválené (ještě nezapsané) přihlášky se všemi údaji. Každý export do Záznamu změn. */
function prhExport_(o) {
  const radky = radky_(LIST_PRIHLASKY).filter(r => r['ID'] && r['Stav'] === 'schváleno' && !r['Údaje smazány']);
  const SL = ['Příjmení', 'Jméno', 'Rodné číslo', 'Datum narození', 'Státní příslušnost', 'Ulice a číslo', 'Obec', 'PSČ', 'Telefon', 'E-mail', 'Sportovec',
    'Kategorie', 'Sbor', 'Přestup z', 'Zákonný zástupce', 'Datum narození zák. zástupce', 'Telefon zák. zástupce', 'Číslo přihlášky', 'Zaplaceno'];
  const q = v => { const t = String(v == null ? '' : v); return /[";\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  const den = v => v instanceof Date ? Utilities.formatDate(v, 'Europe/Prague', 'd.M.yyyy') : (/^\d{4}-\d{2}-\d{2}/.test(String(v || '')) ? String(v).slice(8, 10).replace(/^0/, '') + '.' + String(v).slice(5, 7).replace(/^0/, '') + '.' + String(v).slice(0, 4) : '');
  const out = [SL.join(';')];
  let chybi = 0;
  radky.forEach(r => {
    const u = prhUdaje_(r); if (!u) { chybi++; return; }
    out.push([r['Příjmení'], r['Jméno'], u.rc, den(r['Datum narození']), u.prislusnost, u.ulice, u.obec, u.psc, u.telefon, u.email, r['Sportovec'],
      r['Kategorie'], r['Sbor'], r['Přestup z'], r['Zákonný zástupce'], den(u.zzNarozeni), u.zzTelefon, r['ID'], den(r['Zaplaceno'])].map(q).join(';'));
  });
  zaznamZmeny_(o.email, LIST_PRIHLASKY, '', 'export', '', 'export pro evidenci: ' + (out.length - 1) + ' přihlášek' + (chybi ? ', bez údajů ' + chybi : ''));
  return { ok: true, nazev: 'prihlasky-pro-evidenci-' + Utilities.formatDate(new Date(), 'Europe/Prague', 'yyyy-MM-dd') + '.csv', csv: '﻿' + out.join('\r\n'), pocet: out.length - 1 };
}

/* ---------- noční výmaz údajů po lhůtě ---------- */

/** udaje.json, vyplněné PDF a fotku smaže: zapsáno po PRIHLASKY_VYMAZ_ZAPSANO_DNY (90), zamítnuto / zrušeno po PRIHLASKY_VYMAZ_OSTATNI_DNY (30). Sken zůstává. */
function prhVymazat_() {
  const sh = dataSs_().getSheetByName(LIST_PRIHLASKY); if (!sh || sh.getLastRow() < 2) return 0;
  const h = hlavicka_(sh), col = k => h.indexOf(k), rng = sh.getRange(2, 1, sh.getLastRow() - 1, h.length), v = rng.getValues();
  const dZap = Number(nastaveniWeb_('PRIHLASKY_VYMAZ_ZAPSANO_DNY') || 90), dOst = Number(nastaveniWeb_('PRIHLASKY_VYMAZ_OSTATNI_DNY') || 30), ted = Date.now();
  let n = 0;
  v.forEach(r => {
    const stav = r[col('Stav')], od = r[col('Stav od')];
    if (r[col('Údaje smazány')] || !(od instanceof Date)) return;
    const lhuta = stav === 'zapsáno' ? dZap : (stav === 'zamítnuto' || stav === 'zrušeno' || stav === 'staženo' || stav === 'nepřijato') ? dOst : null;
    if (lhuta == null || ted - od.getTime() < lhuta * 864e5) return;
    ['udaje.json'].forEach(nm => { const f = prhSouborVeSlozce_(r[col('Složka – ID')], nm); if (f) f.setTrashed(true); });
    if (r[col('PDF – ID')]) { try { DriveApp.getFileById(r[col('PDF – ID')]).setTrashed(true); } catch (e) {} }
    if (col('Fotka – ID') >= 0 && r[col('Fotka – ID')]) { try { DriveApp.getFileById(r[col('Fotka – ID')]).setTrashed(true); } catch (e) {} }
    r[col('Údaje smazány')] = new Date();
    zaznamZmeny_('noční údržba', LIST_PRIHLASKY, r[col('ID')], 'upraveno', stav, 'údaje, PDF a fotka smazány po ' + lhuta + ' dnech (sken zůstává)');
    n++;
  });
  if (n) rng.setValues(v);
  return n;
}

/* ---------- registrační čísla sborů (jednorázové doplnění) ---------- */

/** Registrační čísla sborů SH ČMS z exportu Evidence OSH (18. 10. 2026) – jen čísla, žádné kontakty. Klíč = název sboru bez „SDH“. */
const PRH_REG_CISLA = {
  'Bojanovice': '220037',
  'Bojov': '220047',
  'Bratřínov': '220053',
  'Buš': '220059',
  'Čičovice': '220011',
  'Čisovice': '220004',
  'Davle': '220015',
  'Dobřichovice': '220070',
  'Dolní Břežany': '220022',
  'Dolní Jirčany': '220062',
  'Drahelčice': '220056',
  'Hodkovice': '220058',
  'Horoměřice': '220029',
  'Hostivice': '220020',
  'Hradištko': '220044',
  'Hvozdnice': '220025',
  'Choteč': '220043',
  'Chýně': '220072',
  'Jílové u Prahy': '220001',
  'Jíloviště': '220068',
  'Jinočany': '220040',
  'Kamenný Újezdec': '220051',
  'Klínec': '220030',
  'Kněževes': '220023',
  'Kosoř': '220018',
  'Kozinec': '220032',
  'Kytín': '220008',
  'Lety': '220026',
  'Lhota': '220066',
  'Libčice': '220019',
  'Letky': '220009',
  'Libeň': '220060',
  'Libeř': '220038',
  'Líšnice': '220002',
  'Luka': '220048',
  'Malá Lečice': '220035',
  'Masečín': '220036',
  'Mníšek pod Brdy': '220003',
  'Mokropsy': '220042',
  'Nučice': '220021',
  'Ohrobec': '220061',
  'Okrouhlo': '220033',
  'Ořech': '220024',
  'Osnice': '220010',
  'Petrov': '220052',
  'Pikovice': '220055',
  'Pohoří': '220046',
  'Průhonice': '220012',
  'Psáry': '220034',
  'Roztoky': '220006',
  'Rudná': '220016',
  'Rymáně': '220067',
  'Řevnice': '220027',
  'Senešnice': '220039',
  'Skochovice': '220050',
  'Slapy nad Vltavou': '220007',
  'Sloup': '220065',
  'Solopisky': '220064',
  'Středokluky': '220028',
  'Stříbrná Lhota': '220063',
  'Svrkyně': '220069',
  'Štěchovice': '220014',
  'Trnová': '220057',
  'Třebotov': '220013',
  'Úholičky': '220041',
  'Úhonice': '220017',
  'Vestec': '220071',
  'Vonoklasy': '220031',
  'Zahořany': '220049',
  'Zlatníky': '220005',
  'Zvole': '220045'
};

/** Doplní Registrační číslo do listu Sbory tam, kde chybí (OSH data → Přihlášky: doplnit registrační čísla). Existující jiné číslo nepřepíše – vypíše ho. */
function doplnitRegistracniCisla() {
  const sh = dataSs_().getSheetByName('Sbory'), h = hlavicka_(sh), col = k => h.indexOf(k);
  if (col('Registrační číslo') < 0) throw new Error('V listu Sbory chybí sloupec Registrační číslo – nejdřív spusťte Založit / doplnit strukturu.');
  const rng = sh.getRange(2, col('Registrační číslo') + 1, sh.getLastRow() - 1, 1), v = rng.getValues(), jm = sh.getRange(2, col('Sbor') + 1, sh.getLastRow() - 1, 1).getValues();
  let n = 0; const jine = [], chybi = [];
  jm.forEach((r, i) => {
    const k = String(r[0] || '').replace(/^SDH\s+/i, '').trim(); if (!k) return;
    const c = PRH_REG_CISLA[k];
    if (!c) { if (!String(v[i][0] || '').trim()) chybi.push(k); return; }
    const ted = String(v[i][0] || '').trim();
    if (!ted) { v[i][0] = c; n++; } else if (ted !== c) jine.push(k + ' (v listu ' + ted + ', v exportu ' + c + ')');
  });
  if (n) { rng.setNumberFormat('@'); rng.setValues(v); vycistitMezipamet_('Sbory'); CacheService.getScriptCache().removeAll(['v_sbory', 'v_web']); zaznamZmeny_(Session.getActiveUser().getEmail() || 'skript', 'Sbory', '', 'upraveno', '', 'registrační čísla doplněna: ' + n); }
  const text = 'Doplněno ' + n + ' registračních čísel.' + (chybi.length ? ' Bez čísla: ' + chybi.join(', ') + '.' : '') + (jine.length ? ' Jiné číslo než v exportu (nezměněno): ' + jine.join('; ') + '.' : '');
  console.log(text); try { SpreadsheetApp.getActive().toast(text, 'Registrační čísla', 15); } catch (e) {}
  return text;
}

/* ---------- automatický test postupu a odvodů (spustit z editoru, nic nezůstane) ---------- */

/** Projde celý postup na dvou zkušebních přihláškách (dospělý, mladý hasič) skutečnými funkcemi serveru a ověří stavy,
 *  platbu před skenem, vznik a zánik odvodu, dluh sboru, přijetí odvodu a že rodné číslo není v tabulce.
 *  E-maily neposílá. Na konci zkušební řádky smaže a složky dá do koše. Výsledek: protokol + hláška (OK / CHYBA u kroků). */
function testPrihlaskyOdvod() {
  const vys = [], ok = (nazev, podminka, detail) => { vys.push((podminka ? 'OK     ' : 'CHYBA  ') + nazev + (detail ? ' – ' + detail : '')); return podminka; };
  const o = { email: Session.getActiveUser().getEmail() || 'test', role: { 'Správce': true }, sbory: [] };
  const sbor = radkyRychle_('Sbory').map(r => prhSbor_(r['Sbor'])).find(x => x && x.nastaveni.regCislo);
  if (!sbor) throw new Error('Žádný sbor nemá registrační číslo – doplňte je (OSH data → Přihlášky: doplnit registrační čísla sborů).');
  const sazba = { 'dospělý': prhOdvodKc_('dospělý'), 'mladý hasič': prhOdvodKc_('mladý hasič') };
  if (!sazba['dospělý'] || !sazba['mladý hasič']) vys.push('POZOR  ODVOD_DOSPELY nebo ODVOD_MH v Nastavení je prázdné – odvody se počítají jako 0 Kč, test je slabší.');
  const web = nastaveniWeb_('WEB_URL'); if (!web) throw new Error('V Nastavení chybí WEB_URL.');
  const pdf = Utilities.base64Encode(UrlFetchApp.fetch(web + '/assets/sablony/prihlaska-clena-hasic.pdf').getContent());
  const dluh0 = prhOdvodSbor_(sbor.skupina);
  const RC = { d: '7801233540', mh: '1458141234' };
  const zaklad = { ulice: 'Testovací 1', obec: 'Testov', psc: '25282', prislusnost: 'ČR', telefon: '+420 777 000 001', souhlas: true, pdf: pdf };
  const nove = [];
  _prhBezPosty = true;
  try {
    const a = prhZalozit_(Object.assign({}, zaklad, { kategorie: 'dospělý', sportovec: false, datumVyboru: '2026-10-01', jmeno: 'TEST Odvod', prijmeni: 'Dospělý', rc: RC.d, email: 'test-odvod-d@example.cz' }), sbor, o.email, 'test');
    const b = prhZalozit_(Object.assign({}, zaklad, { kategorie: 'mladý hasič', sportovec: true, jmeno: 'TEST Odvod', prijmeni: 'Mladý', rc: RC.mh, email: 'test-odvod-mh@example.cz', zzJmeno: 'TEST Rodič', zzNarozeni: '1985-03-12', zzTelefon: '+420 777 000 002' }), sbor, o.email, 'test');
    if (a.ok) nove.push(a.id); if (b.ok) nove.push(b.id);
    ok('založení dvou přihlášek', a.ok && b.ok, (a.chyba || '') + (b.chyba || ''));
    ok('kategorie podle výběru a věku', a.kategorie === 'dospělý' && b.kategorie === 'mladý hasič', a.kategorie + ' / ' + b.kategorie);
    const R = id => prhRadek_(id), skenData = { nazev: 'sken.pdf', mime: 'application/pdf', data: pdf };
    ok('přihláška od sboru je rovnou přijatá se sportovcem a datem výboru', R(a.id).r['Stav'] === 'přijato' && R(a.id).r['Sportovec'] === 'NE' && !!R(a.id).r['Schváleno výborem'] && R(b.id).r['Sportovec'] === 'ANO');
    ok('kategorie, která nesedí s věkem, se odmítne', !prhZalozit_(Object.assign({}, zaklad, { kategorie: 'mladý hasič', sportovec: false, jmeno: 'TEST', prijmeni: 'Věk', rc: RC.d, email: 'test-vek@example.cz' }), sbor, o.email, 'test').ok);
    // fotka: nejmenší platný PNG (1 × 1 px)
    const fotka = { mime: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' };
    ok('sken bez platby se odmítne', !prhSken_(o, R(a.id), skenData).ok);
    ok('Zaplaceno u přijaté', prhZaplaceno_(o, R(a.id), { zaplaceno: true }).ok && !!R(a.id).r['Zaplaceno']);
    prhZaplaceno_(o, R(b.id), { zaplaceno: true });
    ok('sken po zaplacení – přihláška zůstává u sboru', prhSken_(o, R(a.id), skenData).ok && R(a.id).r['Stav'] === 'přijato' && !!R(a.id).r['Sken – ID']);
    ok('předání bez fotky se odmítne', !prhPredat_(o, R(a.id)).ok && R(a.id).r['Stav'] === 'přijato');
    ok('fotka nahrána', prhFotka_(o, R(a.id), fotka).ok && !!R(a.id).r['Fotka – ID']);
    const f1 = R(a.id).r['Fotka – ID'];
    ok('nová fotka nahradí starou (stará v koši)', prhFotka_(o, R(a.id), fotka).ok && R(a.id).r['Fotka – ID'] !== f1 && DriveApp.getFileById(f1).isTrashed());
    ok('fotka jde přečíst', prhFotkaCist_(R(a.id)).ok);
    // B zaplatí odvod okresu předem, A ne
    const zb = prhOdvodZaplacen_(o, sbor.skupina, { ids: [b.id], zaplaceno: true });
    ok('sbor zaplatí odvod před předáním', zb.ok && !!R(b.id).r['Odvod zaplacen'] && Number(R(b.id).r['Odvod']) === sazba['mladý hasič'], zb.chyba || '');
    ok('cizí sbor odvod neoznačí', !prhOdvodZaplacen_(o, 'sdh-neexistuje', { ids: [a.id], zaplaceno: true }).ok);
    const pa = prhPredat_(o, R(a.id));
    ok('předání okresu (sken + fotka + platba)', pa.ok && R(a.id).r['Stav'] === 'sken u okresu', pa.chyba || '');
    ok('odvod vznikne předáním, nezaplacený = upozornění', Number(R(a.id).r['Odvod']) === sazba['dospělý'] && (!sazba['dospělý'] || /dluh/.test(pa.upozorneni || '')));
    ok('předání B bez skenu se odmítne', !prhPredat_(o, R(b.id)).ok);
    prhSken_(o, R(b.id), skenData); prhFotka_(o, R(b.id), fotka);
    ok('předání B', prhPredat_(o, R(b.id)).ok && R(b.id).r['Stav'] === 'sken u okresu');
    const d1 = prhOdvodSbor_(sbor.skupina);
    ok('dluh = jen nezaplacený odvod A', d1.dluh - dluh0.dluh === sazba['dospělý'] && d1.ids.indexOf(a.id) >= 0 && d1.ids.indexOf(b.id) < 0, (d1.dluh - dluh0.dluh) + ' Kč');
    ok('B čeká na potvrzení okresu', d1.ceka - dluh0.ceka === sazba['mladý hasič']);
    ok('vrácení bez důvodu se odmítne', !prhRozhodnout_(o, R(a.id), { rozhodnuti: 'vrátit', duvod: '' }).ok);
    ok('vrácení s důvodem (odvod zůstává)', prhRozhodnout_(o, R(a.id), { rozhodnuti: 'vrátit', duvod: 'TEST chybí razítko' }).ok && R(a.id).r['Stav'] === 'vráceno' && Number(R(a.id).r['Odvod']) === sazba['dospělý']);
    ok('nový sken a znovu předání', prhSken_(o, R(a.id), skenData).ok && prhPredat_(o, R(a.id)).ok && R(a.id).r['Stav'] === 'sken u okresu');
    prhRozhodnout_(o, R(a.id), { rozhodnuti: 'schválit' }); prhRozhodnout_(o, R(b.id), { rozhodnuti: 'schválit' });
    ok('schválení nemění odvod', Number(R(a.id).r['Odvod'] || 0) === sazba['dospělý'] && Number(R(b.id).r['Odvod'] || 0) === sazba['mladý hasič']);
    ok('Zaplaceno po předání zrušit nejde', !prhZaplaceno_(o, R(a.id), { zaplaceno: false }).ok);
    if (sazba['dospělý'] > 0) {
      ok('sbor označí odvod A, pak zruší', prhOdvodZaplacen_(o, sbor.skupina, { ids: [a.id], zaplaceno: true }).ok && prhOdvodZaplacen_(o, sbor.skupina, { ids: [a.id], zaplaceno: false }).ok && !R(a.id).r['Odvod zaplacen'] && Number(R(a.id).r['Odvod']) === sazba['dospělý']);
      ok('okres přijme odvod za dospělého', prhOdvod_(o, { ids: [a.id], prijato: true }).ok && !!R(a.id).r['Odvod přijat']);
      ok('dluh klesl o přijatý odvod', prhOdvodSbor_(sbor.skupina).dluh === d1.dluh - sazba['dospělý']);
      ok('přijatý odvod sbor už nezmění', !prhOdvodZaplacen_(o, sbor.skupina, { ids: [a.id], zaplaceno: false }).ok);
      ok('zrušení přijetí a znovu přijetí', prhOdvod_(o, { ids: [a.id], prijato: false }).ok && !R(a.id).r['Odvod přijat'] && prhOdvod_(o, { ids: [a.id], prijato: true }).ok);
    }
    const zam = prhRozhodnout_(o, R(b.id), { rozhodnuti: 'zamítnout', duvod: 'TEST zamítnutí' });
    ok('zamítnutí se zaplaceným odvodem: odvod zůstane, upozornění', zam.ok && Number(R(b.id).r['Odvod']) === sazba['mladý hasič'] && (!sazba['mladý hasič'] || /vrácení peněz/.test(zam.upozorneni || '')));
    ok('zamítnutá B se nepočítá do dluhu ani čekajících', prhOdvodSbor_(sbor.skupina).ceka === dluh0.ceka);
    ok('dluh sboru zpět na původní', prhOdvodSbor_(sbor.skupina).dluh === dluh0.dluh, prhOdvodSbor_(sbor.skupina).dluh + ' / ' + dluh0.dluh + ' Kč');
    ok('zápis do evidence', prhEvidence_(o, R(a.id), { cislo: 'TEST-1' }).ok && R(a.id).r['Stav'] === 'zapsáno' && (!sazba['dospělý'] || !!R(a.id).r['Odvod přijat']));
    // žádost uchazeče z webu: posouzení sborem a osobní odkaz
    const zw = Object.assign({}, zaklad, { kategorie: 'dospělý', jmeno: 'TEST Žádost', prijmeni: 'Uchazeč', rc: RC.d, email: 'test-zadost@example.cz', fotka: fotka.data, fotkaMime: fotka.mime });
    ok('žádost bez motivačního dopisu se odmítne', !prhZalozit_(zw, sbor, 'test', 'web').ok);
    ok('žádost bez fotky se odmítne', !prhZalozit_(Object.assign({}, zw, { motivace: 'Chci pomáhat a jezdit na soutěže.', fotka: '' }), sbor, 'test', 'web').ok);
    const c = prhZalozit_(Object.assign({}, zw, { motivace: 'Chci pomáhat a jezdit na soutěže.' }), sbor, 'test', 'web');
    if (c.ok) nove.push(c.id);
    const kl = ((c.odkaz || '').match(/[?&]k=([a-f0-9]{64})/) || [])[1];
    ok('žádost z webu: stav žádost, fotka, odkaz', c.ok && R(c.id).r['Stav'] === 'žádost' && !!R(c.id).r['Fotka – ID'] && !!kl && R(c.id).r['Sportovec'] === '', c.chyba || '');
    ok('otisk odkazu v tabulce, klíč ne', !!kl && R(c.id).r['Odkaz – otisk'] !== kl && JSON.stringify(R(c.id).v).indexOf(kl) < 0);
    ok('cizí odkaz neplatí', !prihlaskaUchazec_({ k: 'a'.repeat(64) }).ok);
    ok('PDF před přijetím sbor ani uchazeč nedostane', !prhPdf_(o, R(c.id)).ok && !prihlaskaUchazec_({ k: kl, krok: 'pdf' }).ok);
    ok('doplnění bez poznámky se odmítne', !prhPosoudit_(o, R(c.id), { rozhodnuti: 'doplnit', poznamka: '' }).ok);
    ok('sbor vyžádá doplnění', prhPosoudit_(o, R(c.id), { rozhodnuti: 'doplnit', poznamka: 'TEST pošlete jinou fotku' }).ok && R(c.id).r['Stav'] === 'doplnit');
    const st = prihlaskaUchazec_({ k: kl, krok: 'stav' });
    ok('uchazeč vidí poznámku a své údaje k opravě', st.ok && st.data.stav === 'doplnit' && /fotku/.test(st.data.poznamka) && st.udaje && st.udaje.rc === '780123/3540');
    const dop = prihlaskaUchazec_({ k: kl, krok: 'doplnit', data: Object.assign({}, zw, { motivace: 'Doplněno – chci pomáhat.', fotka: fotka.data }) });
    ok('uchazeč doplní žádost (stejný odkaz platí)', dop.ok && R(c.id).r['Stav'] === 'žádost' && /Doplněno/.test(R(c.id).r['Motivační dopis']), dop.chyba || '');
    ok('přijetí bez data výboru se odmítne', !prhPosoudit_(o, R(c.id), { rozhodnuti: 'přijmout', sportovec: true }).ok);
    ok('sbor přijme se sportovcem a datem výboru', prhPosoudit_(o, R(c.id), { rozhodnuti: 'přijmout', sportovec: true, datumVyboru: '2026-10-20' }).ok && R(c.id).r['Stav'] === 'přijato' && R(c.id).r['Sportovec'] === 'ANO');
    const pd = prihlaskaUchazec_({ k: kl, krok: 'pdf' });
    ok('po přijetí uchazeč stáhne PDF (sportovec a datum k doplnění)', pd.ok && pd.sportovec === true && pd.datumVyboru === '2026-10-20');
    ok('uchazeč nahraje podepsaný sken', prihlaskaUchazec_({ k: kl, krok: 'sken', nazev: 'podepsana.pdf', mime: 'application/pdf', data: pdf }).ok && !!R(c.id).r['Sken uchazeče – ID']);
    ok('sbor vidí sken uchazeče', prhSkenNahled_(R(c.id), true, true).ok);
    ok('o přijaté žádosti už znovu rozhodnout nejde', !prhPosoudit_(o, R(c.id), { rozhodnuti: 'nepřijmout', poznamka: 'x' }).ok);
    const e2 = prhZalozit_(Object.assign({}, zw, { motivace: 'Druhá žádost na nepřijetí.', email: 'test-zadost2@example.cz' }), sbor, 'test', 'web');
    if (e2.ok) nove.push(e2.id);
    ok('nepřijetí s důvodem', e2.ok && prhPosoudit_(o, R(e2.id), { rozhodnuti: 'nepřijmout', poznamka: 'TEST plný stav' }).ok && R(e2.id).r['Stav'] === 'nepřijato');
    const sh = dataSs_().getSheetByName(LIST_PRIHLASKY), vse = JSON.stringify(sh.getDataRange().getDisplayValues());
    ok('rodné číslo ani adresa nejsou v tabulce', [RC.d, RC.mh, '780123/3540', '145814/1234', 'Testovací 1'].every(t => vse.indexOf(t) < 0));
    ok('udaje.json je ve složce a má rodné číslo', (prhUdaje_(R(a.id).r) || {}).rc === '780123/3540');
  } catch (e) { vys.push('CHYBA  výjimka: ' + e.message); }
  finally {
    _prhBezPosty = false;
    // úklid: řádky pryč, složky do koše
    const sh = dataSs_().getSheetByName(LIST_PRIHLASKY), h = hlavicka_(sh), v = sh.getDataRange().getValues();
    for (let i = v.length - 1; i >= 1; i--) if (nove.indexOf(String(v[i][h.indexOf('ID')])) >= 0) {
      try { DriveApp.getFolderById(v[i][h.indexOf('Složka – ID')]).setTrashed(true); } catch (e) {}
      sh.deleteRow(i + 1);
    }
    vys.push('úklid: smazáno ' + nove.length + ' zkušebních přihlášek');
  }
  const chyb = vys.filter(x => x.indexOf('CHYBA') === 0).length, text = (chyb ? 'CHYBY: ' + chyb : 'Vše OK') + '\n' + vys.join('\n');
  console.log(text); try { SpreadsheetApp.getActive().toast(chyb ? chyb + ' kroků selhalo – detail v protokolu' : 'Všech ' + (vys.length - 1) + ' kroků OK', 'Test přihlášek', 15); } catch (e) {}
  return text;
}

/* ---------- test ---------- */

/** Tři testovací přihlášky (dospělý, mladý hasič, přestup) se smyšlenými platnými rodnými čísly. PDF = nevyplněná šablona z webu
 *  (vyplněné PDF tvoří až prohlížeč – vyzkoušejte formulář). Jména začínají TEST, takže je smaže Úklid testů. */
function vlozitTestyPrihlasek() {
  const web = nastaveniWeb_('WEB_URL'); if (!web) throw new Error('V Nastavení chybí WEB_URL.');
  const sablona = k => Utilities.base64Encode(UrlFetchApp.fetch(web + '/assets/sablony/' + (k ? 'prihlaska-clena-mlady-hasic.pdf' : 'prihlaska-clena-hasic.pdf')).getContent());
  const s = prhSbor_('kamenny-ujezdec') || prhSbor_(radkyRychle_('Sbory')[0]['Sbor']);
  const zaklad = { ulice: 'Testovací 1', obec: 'Kamenný Přívoz', psc: '25282', prislusnost: 'ČR', telefon: '+420 777 000 001', sportovec: false, souhlas: true };
  const testy = [
    Object.assign({}, zaklad, { jmeno: 'TEST Jan', prijmeni: 'Dospělý', rc: '7801233540', email: 'test-dospely@example.cz', sportovec: true, pdf: sablona(false) }),
    Object.assign({}, zaklad, { jmeno: 'TEST Eliška', prijmeni: 'Mladá', rc: '1458141234', email: 'test-mh@example.cz', zzJmeno: 'TEST Marie Mladá', zzNarozeni: '1985-03-12', zzTelefon: '+420 777 000 002', pdf: sablona(true) }),
    Object.assign({}, zaklad, { jmeno: 'TEST Petr', prijmeni: 'Přestupující', rc: '9002020005', email: 'test-prestup@example.cz', prestup: true, prestupZ: 'SDH Čisovice', pdf: sablona(false) })
  ];
  const vysl = testy.map(t => { const r = prhZalozit_(t, s, Session.getActiveUser().getEmail() || 'test', 'test'); return r.ok ? r.id + ' (' + r.kategorie + ')' : 'chyba: ' + r.chyba; });
  console.log('Testovací přihlášky pro ' + s.sbor + ': ' + vysl.join(', '));
  try { SpreadsheetApp.getActive().toast(vysl.join(', '), 'Přihlášky', 10); } catch (e) {}
}

/** Test výmazu: dočasně posune „Stav od“ u zapsaných / stažených TEST přihlášek o 365 dní zpět a spustí výmaz. */
function testVymazuPrihlasek() {
  const sh = dataSs_().getSheetByName(LIST_PRIHLASKY), h = hlavicka_(sh), col = k => h.indexOf(k);
  const rng = sh.getRange(2, 1, sh.getLastRow() - 1, h.length), v = rng.getValues();
  v.forEach(r => { if (/^TEST/.test(String(r[col('Jméno')])) && ['zapsáno', 'zamítnuto', 'zrušeno', 'staženo'].indexOf(r[col('Stav')]) >= 0) r[col('Stav od')] = new Date(Date.now() - 365 * 864e5); });
  rng.setValues(v);
  console.log('Smazáno údajů u přihlášek: ' + prhVymazat_());
}
