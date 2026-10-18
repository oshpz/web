/**
 * OSH data – přihlášky členů SH ČMS (B7, list Členské přihlášky).
 *
 * Postup: odesláno (uchazeč na webu nebo sbor v portálu, PDF vyplní prohlížeč) → sken u okresu (sbor nahraje podepsanou
 * přihlášku s razítkem) → schváleno / vráceno (okres, role Přihlášky; vrácení s důvodem) → zapsáno (okres vyplní evidenční
 * číslo z evidencesdh.cz). Dál zamítnuto (okres) a staženo (sbor). Zaplaceno = datum, které vyplní sbor po schválení.
 *
 * Osobní údaje: v tabulce jen jméno, datum narození, kategorie, kontakt a stav. Rodné číslo, adresa a údaje zákonného
 * zástupce jsou jen ve vyplněném PDF a v udaje.json ve složce Přihlášky/<sbor>/<ID>/ – na Můj disk účtu, pod kterým skript
 * běží (sdílený disk vidí všichni jeho členové), bez sdílení. Server ji čte jen pro roli Přihlášky a pro daný sbor.
 * Noční údržba (prVymazat_) smaže udaje.json a PDF po lhůtě z Nastavení; sken zůstává jako doklad o podpisu.
 * Do logu, Záznamu změn ani do e-mailů nikdy nejde rodné číslo ani adresa.
 */

const LIST_PRIHLASKY = 'Členské přihlášky';
const PR_STAVY_SKEN = ['odesláno', 'vráceno'];                 // sbor smí nahrát (znovu) sken
const PR_STAVY_STAHNOUT = ['odesláno', 'vráceno', 'sken u okresu'];
const PR_LIMIT_WEB = 20, PR_LIMIT_EMAIL = 3;                  // veřejný formulář: za 10 min celý web, za hodinu jeden e-mail
const PR_PDF_MAX = 3 * 1024 * 1024;

function smiPrihlaskyOkres_(o) { return !!(o && (o.role['Přihlášky'] || o.role['Správce'])); }
function prihlaskyZapnute_() { return String(nastaveniWeb_('PRIHLASKY_ZAPNUTO') || 'ANO').trim().toUpperCase() !== 'NE'; }

/* ---------- rodné číslo (stejná pravidla jako prihlaska.js) ---------- */
function prMod_(cislice, n) { return String(cislice).split('').reduce((z, c) => (z * 10 + Number(c)) % n, 0); }
function prRc_(text, kDatu) {
  const s = String(text || '').replace(/[\s/]/g, '');
  if (!/^\d{9,10}$/.test(s)) return { ok: false, chyba: 'Rodné číslo má tvar RRMMDD/XXXX.' };
  const rr = Number(s.slice(0, 2)), dd = Number(s.slice(4, 6));
  let mm = Number(s.slice(2, 4));
  if (s.length === 9 && rr >= 54) return { ok: false, chyba: 'Rodné číslo po roce 1953 má 10 číslic.' };
  const rok = s.length === 9 ? 1900 + rr : (rr < 54 ? 2000 + rr : 1900 + rr);
  if (mm > 70) mm -= 70; else if (mm > 50) mm -= 50; else if (mm > 20) mm -= 20;
  const d = new Date(Date.UTC(rok, mm - 1, dd));
  if (mm < 1 || mm > 12 || d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) return { ok: false, chyba: 'Rodné číslo neobsahuje platné datum narození.' };
  if (s.length === 10 && prMod_(s, 11) !== 0 && !(prMod_(s.slice(0, 9), 11) === 10 && s[9] === '0')) return { ok: false, chyba: 'Rodné číslo není platné (kontrolní číslice nesedí).' };
  const k = kDatu || new Date();
  if (d > k) return { ok: false, chyba: 'Rodné číslo obsahuje datum narození v budoucnosti.' };
  let vek = k.getFullYear() - rok; if (k.getMonth() + 1 < mm || (k.getMonth() + 1 === mm && k.getDate() < dd)) vek--;
  return { ok: true, cislo: s.slice(0, 6) + '/' + s.slice(6), datum: rok + '-' + String(mm).padStart(2, '0') + '-' + String(dd).padStart(2, '0'), vek: vek, kategorie: vek < 18 ? 'mladý hasič' : 'dospělý' };
}
const prMaska_ = t => { const s = String(t || '').replace(/[\s/]/g, ''); return s.length >= 9 ? '******/' + s.slice(6) : ''; };

/** Kontrola údajů z formuláře. Vrací { chyba } nebo { d: vyčištěné údaje, rc }. */
function prKontrola_(vstup) {
  const t = k => String(vstup[k] == null ? '' : vstup[k]).trim();
  const d = { jmeno: t('jmeno'), prijmeni: t('prijmeni'), rc: t('rc'), ulice: t('ulice'), obec: t('obec'), psc: t('psc').replace(/\s/g, ''),
    prislusnost: t('prislusnost') || 'ČR', telefon: t('telefon'), email: normEmail_(t('email')), sportovec: vstup.sportovec === true,
    zzJmeno: t('zzJmeno'), zzNarozeni: t('zzNarozeni'), zzTelefon: t('zzTelefon'), prestupZ: vstup.prestup ? t('prestupZ') : '' };
  const ch = kontrolaTextu_(d, { jmeno: 60, prijmeni: 60, ulice: 100, obec: 60, prislusnost: 40, zzJmeno: 120, prestupZ: 100 });
  if (ch) return { chyba: ch };
  if (!d.jmeno || !d.prijmeni) return { chyba: 'Vyplňte jméno a příjmení.' };
  const rc = prRc_(d.rc);
  if (!rc.ok) return { chyba: rc.chyba };
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
function prSbor_(klic) {
  const slug = t => String(t || '').replace(/^SDH\s+/i, '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const k = slug(klic), sk = String(klic || '').toLowerCase().split('@')[0];
  const r = radkyRychle_('Sbory').find(x => String(x['Aktivní']).trim().toUpperCase() !== 'NE' && (slug(x['Sbor']) === k || (x['Skupina'] && String(x['Skupina']).toLowerCase().split('@')[0] === sk)));
  return r ? { sbor: String(r['Sbor']), skupina: String(r['Skupina'] || '').toLowerCase().split('@')[0], ucet: String(r['Číslo účtu'] || '').trim(), nastaveni: prNastaveniSboru_(r) } : null;
}
/** Nastavení přihlášek sboru (list Sbory): příspěvky (prázdné = výchozí z Nastavení) a výchozí „sportovec“ u mladých hasičů. */
function prNastaveniSboru_(r) {
  const kc = (v, vychozi) => v === '' || v == null ? Number(nastaveniWeb_(vychozi) || 0) : Number(v) || 0;
  return { prispevekDospely: kc(r['Příspěvek dospělý'], 'PRISPEVEK_DOSPELY'), prispevekMH: kc(r['Příspěvek MH'], 'PRISPEVEK_MH'), mhSportovec: ano_(r['MH jako sportovec']),
    vlastniDospely: r['Příspěvek dospělý'] !== '' && r['Příspěvek dospělý'] != null, vlastniMH: r['Příspěvek MH'] !== '' && r['Příspěvek MH'] != null };
}

/* ---------- složky a soubory ---------- */

/** Kořen „Přihlášky členů OSH (důvěrné)“ na Můj disk účtu skriptu (ID ve Vlastnostech skriptu PRIHLASKY_SLOZKA_ID). */
function prKoren_() {
  const p = PropertiesService.getScriptProperties(), id = nastaveniWeb_('PRIHLASKY_SLOZKA_ID') || p.getProperty('PRIHLASKY_SLOZKA_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { console.warn('Složka přihlášek nejde otevřít: ' + e.message); } }
  const f = DriveApp.getRootFolder().createFolder('Přihlášky členů OSH (důvěrné)');
  f.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  p.setProperty('PRIHLASKY_SLOZKA_ID', f.getId());
  return f;
}
function prSlozka_(sbor, id) {
  const koren = prKoren_(), dite = (rodic, jm) => { const it = rodic.getFoldersByName(jm); return it.hasNext() ? it.next() : rodic.createFolder(jm); };
  return dite(dite(koren, sbor), id);
}
function prSouborVeSlozce_(slozkaId, nazev) {
  if (!slozkaId) return null;
  try { const it = DriveApp.getFolderById(slozkaId).getFilesByName(nazev); return it.hasNext() ? it.next() : null; } catch (e) { return null; }
}
function prUdaje_(r) { const f = prSouborVeSlozce_(r['Složka – ID'], 'udaje.json'); if (!f) return null; try { return JSON.parse(f.getBlob().getDataAsString('UTF-8')); } catch (e) { return null; } }

/* ---------- řádky ---------- */

function prRadek_(id) {
  const sh = dataSs_().getSheetByName(LIST_PRIHLASKY), h = hlavicka_(sh), col = k => h.indexOf(k);
  const ids = sh.getLastRow() > 1 ? sh.getRange(2, col('ID') + 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
  const i = ids.indexOf(String(id || ''));
  if (i < 0) return null;
  const rng = sh.getRange(i + 2, 1, 1, h.length), v = rng.getValues()[0];
  return { sh, h, col, rng, v, r: h.reduce((o, k, j) => (o[k] = v[j], o), {}) };
}
function prZapsat_(x, zmeny, kdo) {
  Object.keys(zmeny).forEach(k => { if (x.col(k) >= 0) x.v[x.col(k)] = zmeny[k]; });
  x.v[x.col('Upraveno')] = new Date(); x.v[x.col('Upravil')] = kdo;
  x.rng.setValues([x.v]);
  x.r = x.h.reduce((o, k, j) => (o[k] = x.v[j], o), {});
}
/** Řádek pro aplikaci – jen údaje z tabulky (žádné rodné číslo ani adresa). */
function prJson_(r) {
  const iso = v => v instanceof Date ? v.toISOString() : (v == null ? '' : v);
  const o = {};
  ['ID', 'Sbor', 'Skupina', 'Jméno', 'Příjmení', 'Datum narození', 'Kategorie', 'Sportovec', 'Přestup z', 'E-mail', 'Telefon', 'Zákonný zástupce',
    'Variabilní symbol', 'Zaplaceno', 'Evidenční číslo', 'Stav', 'Stav od', 'Poznámka', 'Zdroj', 'Vytvořeno'].forEach(k => { o[k] = iso(r[k]); });
  o.maSken = !!r['Sken – ID']; o.maPdf = !!r['PDF – ID'] && !r['Údaje smazány'];
  return o;
}

/* ---------- založení (veřejný formulář i sbor) ---------- */

function prZalozit_(vstup, s, kdo, zdroj) {
  const k = prKontrola_(vstup);
  if (k.chyba) return { ok: false, chyba: k.chyba };
  let pdf;
  try { pdf = Utilities.base64Decode(String(vstup.pdf || '')); } catch (e) { return { ok: false, chyba: 'PDF přihlášky se nepodařilo přečíst.' }; }
  if (pdf.length > PR_PDF_MAX) return { ok: false, chyba: 'PDF přihlášky je příliš velké.' };
  const chS = overitSoubor_('prihlaska.pdf', 'application/pdf', pdf.length, null, pdf);
  if (chS) return { ok: false, chyba: chS };
  const d = k.d, ted = new Date();
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = dataSs_().getSheetByName(LIST_PRIHLASKY), h = hlavicka_(sh), col = x => h.indexOf(x);
    const ids = sh.getLastRow() > 1 ? sh.getRange(2, col('ID') + 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
    let vs; do { vs = Utilities.formatDate(ted, 'Europe/Prague', 'yyMMdd') + String(Math.floor(Math.random() * 10000)).padStart(4, '0'); } while (ids.indexOf('P' + vs) >= 0);
    const id = 'P' + vs;
    const slozka = prSlozka_(s.sbor, id);
    const ulozene = Object.assign({ id: id, sbor: s.sbor, kategorie: k.rc.kategorie, datumNarozeni: k.rc.datum, vytvoreno: ted.toISOString() }, d);
    slozka.createFile('udaje.json', JSON.stringify(ulozene, null, 1), 'application/json');
    const fPdf = slozka.createFile(Utilities.newBlob(pdf, 'application/pdf', 'Prihlaska ' + id + '.pdf'));
    const r = h.map(() => ''), set = (x, v) => { if (col(x) >= 0) r[col(x)] = v; };
    set('ID', id); set('Sbor', s.sbor); set('Skupina', s.skupina); set('Jméno', bezVzorce_(d.jmeno)); set('Příjmení', bezVzorce_(d.prijmeni));
    set('Datum narození', new Date(k.rc.datum + 'T00:00:00')); set('Kategorie', k.rc.kategorie); set('Sportovec', d.sportovec ? 'ANO' : 'NE');
    set('Přestup z', bezVzorce_(d.prestupZ)); set('E-mail', d.email); set('Telefon', bezVzorce_(d.telefon)); set('Zákonný zástupce', bezVzorce_(d.zzJmeno));
    set('Variabilní symbol', vs); set('Stav', 'odesláno'); set('Stav od', ted); set('Zdroj', zdroj);
    set('Složka – ID', slozka.getId()); set('PDF – ID', fPdf.getId());
    set('Vytvořeno', ted); set('Vytvořil', kdo); set('Upraveno', ted); set('Upravil', kdo);
    sh.appendRow(r);
    zaznamZmeny_(kdo, LIST_PRIHLASKY, id, 'vytvořeno', '', 'odesláno (' + zdroj + ')');
    prPosta_(s.skupina, 'Nová přihláška člena: ' + d.jmeno + ' ' + d.prijmeni,
      'V portálu sboru je nová přihláška (' + k.rc.kategorie + '): ' + d.jmeno + ' ' + d.prijmeni + ', SDH ' + s.sbor.replace(/^SDH\s+/i, '') + '. ' +
      'Vytiskněte ji, nechte podepsat a nahrajte sken.', 'sbor/' + s.skupina + '/clenove');
    return { ok: true, id: id, vs: vs, kategorie: k.rc.kategorie, data: prJson_(h.reduce((o, x, j) => (o[x] = r[j], o), {})) };
  } finally { lock.releaseLock(); }
}

/** Veřejný formulář na webu (bez přihlášení): Turnstile + limity F3. Chyby vrací jako text, ne výjimkou (anonymní dotaz jinak dostane jen „Chyba serveru“). */
function prihlaskaVerejna_(req) {
  if (!prihlaskyZapnute_()) return { ok: false, chyba: 'Online přihlášky jsou teď vypnuté. Ozvěte se kanceláři OSH.' };
  const ts = overitTurnstile_(req.turnstile, 'prihlaska');
  if (ts) return { ok: false, chyba: ts };
  const d = req.data || {};
  if (limit_('prihlaska-web', 'web', PR_LIMIT_WEB, 600)) return { ok: false, chyba: 'Služba je teď přetížená. Zkuste to za 10 minut.' };
  if (limit_('prihlaska-email', normEmail_(d.email) || 'bez e-mailu', PR_LIMIT_EMAIL, 3600)) return { ok: false, chyba: 'Z tohoto e-mailu už přišlo několik přihlášek. Zkuste to za hodinu.' };
  const s = prSbor_(req.sbor);
  if (!s) return { ok: false, chyba: 'Sbor nenalezen. Otevřete přihlášku z odkazu na stránce sboru.' };
  try { return prZalozit_(d, s, 'veřejný formulář', 'web'); }
  catch (e) { console.error('Přihláška z webu: ' + e.message + '\n' + e.stack); return { ok: false, chyba: 'Přihlášku se nepodařilo uložit. Zkuste to prosím znovu.' + (ostryRezim_() ? '' : ' (TEST: ' + String(e.message).slice(0, 200) + ')') }; } // technický důvod jen v režimu TEST – kvůli ladění
}

/* ---------- e-maily (jen jméno, sbor a odkaz – nikdy rodné číslo ani adresa) ---------- */

function prPosta_(skupina, predmet, text, cesta) {
  const url = (nastaveniWeb_('WEB_URL') || '') + '/Aplikace%20OSH.dc.html#' + cesta;
  const komu = skupina ? [skupina + '@' + (nastaveniWeb_('DOMENA') || 'oshpz.cz')]
    : radky_('Uživatelé').filter(u => ano_(u['Aktivní']) && (ano_(u['Přihlášky']) || ano_(u['Správce']))).map(u => normEmail_(u['E-mail']));
  const html = sablona_(predmet, text, [], ['Otevřít v aplikaci', url], 'Automatická zpráva aplikace OSH Praha-západ.');
  komu.filter(Boolean).forEach(e => { try { posta_(e, predmet, text + '\n\n' + url, html); } catch (x) { console.error('E-mail k přihlášce: ' + x.message); } });
}

/* ---------- API pro přihlášené ---------- */

function apiPrihlasky_(req) {
  const o = prihlaseny_(req.token);
  if (!o) return { ok: false, chyba: 'Nepřihlášen', odhlasen: true };
  const okres = smiPrihlaskyOkres_(o);
  const OKRES = ['prihlaskyOkres', 'prihlaskaDetail', 'prihlaskaRozhodnout', 'prihlaskaEvidence', 'prihlaskyExport'];
  if (OKRES.indexOf(req.akce) >= 0) {
    if (!okres) return { ok: false, chyba: 'Přihlášky členů vyřizuje role Přihlášky nebo Správce.' };
    if (req.akce === 'prihlaskyOkres') return { ok: true, data: radky_(LIST_PRIHLASKY).filter(r => r['ID']).map(prJson_).reverse() };
    if (req.akce === 'prihlaskyExport') return prExport_(o);
    const x = prRadek_(req.id); if (!x) return { ok: false, chyba: 'Přihláška nenalezena.' };
    if (req.akce === 'prihlaskaDetail') return prDetail_(x);
    if (req.akce === 'prihlaskaRozhodnout') return prRozhodnout_(o, x, req);
    if (req.akce === 'prihlaskaEvidence') return prEvidence_(o, x, req);
  }
  // soubory: okres (role) nebo sbor, kterému přihláška patří
  if (req.akce === 'prihlaskaPdf' || req.akce === 'prihlaskaSkenNahled') {
    const x = prRadek_(req.id); if (!x) return { ok: false, chyba: 'Přihláška nenalezena.' };
    if (!okres && !pohledSboru_(o, x.r['Skupina'])) return { ok: false, chyba: 'K této přihlášce nemáte přístup.' };
    return req.akce === 'prihlaskaPdf' ? prPdf_(o, x) : prSkenNahled_(x, req.original === true);
  }
  // portál sboru: jen vlastní sbor
  const u = pohledSboru_(o, req.sbor);
  if (!u) return { ok: false, chyba: 'Ke sboru ' + (req.sbor || '(nevybrán)') + ' nemáte přístup.' };
  const sk = u.sbor.skupina;
  if (req.akce === 'prihlaskySbor') {
    const s = prSbor_(sk) || { ucet: '', nastaveni: prNastaveniSboru_({}) };
    return { ok: true, data: radky_(LIST_PRIHLASKY).filter(r => r['ID'] && String(r['Skupina']) === sk).map(prJson_).reverse(),
      ucet: s.ucet, prispevek: { 'dospělý': s.nastaveni.prispevekDospely, 'mladý hasič': s.nastaveni.prispevekMH }, nastaveni: s.nastaveni,
      zapnuto: prihlaskyZapnute_(), sbory: radkyRychle_('Sbory').filter(r => r['Sbor'] && String(r['Aktivní']).trim().toUpperCase() !== 'NE' && String(r['Skupina'] || '').toLowerCase().split('@')[0] !== sk).map(r => String(r['Sbor'])).sort((a, b) => a.localeCompare(b, 'cs')) };
  }
  if (req.akce === 'prihlaskyNastaveni') return prUlozitNastaveni_(o, sk, req);
  if (req.akce === 'prihlaskaNova') {
    const s = prSbor_(sk); if (!s) return { ok: false, chyba: 'Sbor nenalezen v listu Sbory.' };
    if (limit_('prihlaska-sbor', o.email, 30, 3600)) return { ok: false, chyba: 'Příliš mnoho přihlášek za hodinu. Zkuste to později.' };
    return prZalozit_(req.data || {}, s, o.email, 'sbor');
  }
  const x = prRadek_(req.id); if (!x) return { ok: false, chyba: 'Přihláška nenalezena.' };
  if (String(x.r['Skupina']) !== sk) return { ok: false, chyba: 'Přihláška patří jinému sboru.' };
  if (req.akce === 'prihlaskaSken') return prSken_(o, x, req);
  if (req.akce === 'prihlaskaZaplaceno') return prZaplaceno_(o, x, req);
  if (req.akce === 'prihlaskaStahnout') return prStav_(o, x, 'staženo', PR_STAVY_STAHNOUT, '');
  return { ok: false, chyba: 'Neznámá akce' };
}

/** Sbor si sám nastaví výši příspěvků a výchozí „sportovec“ u MH (vnitřní nastavení sboru – okres to neschvaluje). Prázdná částka = výchozí z Nastavení. */
function prUlozitNastaveni_(o, sk, req) {
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
    const pred = [v[i][col('Příspěvek dospělý')], v[i][col('Příspěvek MH')], v[i][col('MH jako sportovec')]].join(' / ');
    sh.getRange(i + 2, col('Příspěvek dospělý') + 1).setValue(dosp);
    sh.getRange(i + 2, col('Příspěvek MH') + 1).setValue(mh);
    sh.getRange(i + 2, col('MH jako sportovec') + 1).setValue(req.mhSportovec === true ? 'ANO' : 'NE');
    vycistitMezipamet_('Sbory'); CacheService.getScriptCache().removeAll(['v_sbory', 'v_web']);
    zaznamZmeny_(o.email, 'Sbory', sk, 'upraveno', pred, 'nastavení přihlášek: ' + [dosp, mh, req.mhSportovec === true ? 'ANO' : 'NE'].join(' / '));
    return { ok: true, nastaveni: prNastaveniSboru_({ 'Příspěvek dospělý': dosp, 'Příspěvek MH': mh, 'MH jako sportovec': req.mhSportovec === true ? 'ANO' : 'NE' }) };
  } finally { lock.releaseLock(); }
}

function prStav_(o, x, stav, povolene, poznamka, dalsi) {
  const pred = x.r['Stav'];
  if (povolene.indexOf(pred) < 0) return { ok: false, chyba: 'Přihláška ve stavu „' + pred + '“ to neumožňuje.' };
  prZapsat_(x, Object.assign({ 'Stav': stav, 'Stav od': new Date(), 'Poznámka': poznamka == null ? x.r['Poznámka'] : bezVzorce_(poznamka) }, dalsi || {}), o.email);
  zaznamZmeny_(o.email, LIST_PRIHLASKY, x.r['ID'], 'upraveno', pred, stav);
  return { ok: true, data: prJson_(x.r) };
}

function prSken_(o, x, req) {
  if (PR_STAVY_SKEN.indexOf(x.r['Stav']) < 0) return { ok: false, chyba: 'Sken jde nahrát jen k odeslané nebo vrácené přihlášce.' };
  const nazev = String(req.nazev || 'sken').trim(), mime = String(req.mime || '');
  let b; try { b = Utilities.base64Decode(String(req.data || '')); } catch (e) { return { ok: false, chyba: 'Soubor se nepodařilo přečíst.' }; }
  const ch = overitSoubor_(nazev, mime, b.length, null, b); if (ch) return { ok: false, chyba: ch };
  const slozka = DriveApp.getFolderById(x.r['Složka – ID']);
  const pripona = (SOUBORY_POVOLENE[mime] || 'pdf');
  const f = slozka.createFile(Utilities.newBlob(b, mime, 'Sken ' + x.r['ID'] + ' ' + Utilities.formatDate(new Date(), 'Europe/Prague', 'yyyy-MM-dd HH-mm') + '.' + pripona));
  const v = prStav_(o, x, 'sken u okresu', PR_STAVY_SKEN, '', { 'Sken – ID': f.getId() });
  if (v.ok) prPosta_('', 'Přihláška ke kontrole: ' + x.r['Jméno'] + ' ' + x.r['Příjmení'] + ' (' + x.r['Sbor'] + ')',
    'Sbor nahrál sken podepsané přihlášky. Zkontrolujte ho ve správě okresu → Sbory → Přihlášky členů.', 'okres/clenove/' + x.r['ID']);
  return v;
}

function prZaplaceno_(o, x, req) {
  if (['schváleno', 'zapsáno'].indexOf(x.r['Stav']) < 0) return { ok: false, chyba: 'Platbu potvrdíte po schválení přihlášky okresem.' };
  const zap = req.zaplaceno !== false;
  prZapsat_(x, { 'Zaplaceno': zap ? new Date() : '' }, o.email);
  zaznamZmeny_(o.email, LIST_PRIHLASKY, x.r['ID'], 'upraveno', '', zap ? 'zaplaceno' : 'platba zrušena');
  return { ok: true, data: prJson_(x.r) };
}

function prRozhodnout_(o, x, req) {
  const roz = String(req.rozhodnuti || ''), duvod = String(req.duvod || '').trim();
  const ch = kontrolaTextu_({ 'Důvod': duvod }, { 'Důvod': 500 }); if (ch) return { ok: false, chyba: ch };
  if ((roz === 'vrátit' || roz === 'zamítnout') && !duvod) return { ok: false, chyba: 'Napište důvod – sbor ho uvidí.' };
  let v;
  if (roz === 'schválit') v = prStav_(o, x, 'schváleno', ['sken u okresu'], '');
  else if (roz === 'vrátit') v = prStav_(o, x, 'vráceno', ['sken u okresu', 'schváleno'], duvod);
  else if (roz === 'zamítnout') v = prStav_(o, x, 'zamítnuto', ['odesláno', 'sken u okresu', 'vráceno', 'schváleno'], duvod);
  else return { ok: false, chyba: 'Neznámé rozhodnutí.' };
  if (v.ok) {
    const jm = x.r['Jméno'] + ' ' + x.r['Příjmení'];
    const text = roz === 'schválit' ? 'Okres schválil přihlášku ' + jm + '. Potvrďte platbu členského příspěvku (Zaplaceno), nebo pošlete členovi QR platbu.'
      : roz === 'vrátit' ? 'Okres vrátil přihlášku ' + jm + '. Důvod: ' + duvod + '. Opravte ji a nahrajte nový sken.'
      : 'Okres zamítl přihlášku ' + jm + '. Důvod: ' + duvod + '.';
    prPosta_(x.r['Skupina'], (roz === 'schválit' ? 'Přihláška schválena: ' : roz === 'vrátit' ? 'Přihláška vrácena: ' : 'Přihláška zamítnuta: ') + jm, text, 'sbor/' + x.r['Skupina'] + '/clenove');
  }
  return v;
}

function prEvidence_(o, x, req) {
  const cislo = String(req.cislo || '').trim();
  if (!/^[\w\/-]{1,20}$/.test(cislo)) return { ok: false, chyba: 'Vyplňte evidenční číslo z evidencesdh.cz (písmena, číslice, - a /).' };
  return prStav_(o, x, 'zapsáno', ['schváleno', 'zapsáno'], null, { 'Evidenční číslo': bezVzorce_(cislo) });
}

/** Detail pro okres: údaje z tabulky + z udaje.json jen maskované rodné číslo, adresa, zákonný zástupce. */
function prDetail_(x) { // jen pro roli Přihlášky (apiPrihlasky_)
  const u = prUdaje_(x.r) || {};
  return { ok: true, data: prJson_(x.r), detail: { rc: prMaska_(u.rc), ulice: u.ulice || '', obec: u.obec || '', psc: u.psc || '', prislusnost: u.prislusnost || '',
    zzNarozeni: u.zzNarozeni || '', zzTelefon: u.zzTelefon || '', smazano: !!x.r['Údaje smazány'] } };
}

function prPdf_(o, x) {
  if (x.r['Údaje smazány'] || !x.r['PDF – ID']) return { ok: false, chyba: 'Vyplněné PDF už bylo po lhůtě smazáno.' };
  try {
    const f = DriveApp.getFileById(x.r['PDF – ID']);
    zaznamZmeny_(o.email, LIST_PRIHLASKY, x.r['ID'], 'čteno', '', 'stažení PDF');
    return { ok: true, nazev: 'Prihlaska ' + x.r['ID'] + '.pdf', data: Utilities.base64Encode(f.getBlob().getBytes()) };
  } catch (e) { return { ok: false, chyba: 'PDF se nepodařilo otevřít.' }; }
}

/** Náhled skenu (Disk ho zmenší na 1600 px, i z PDF), nebo původní soubor ke stažení. */
function prSkenNahled_(x, original) {
  if (!x.r['Sken – ID']) return { ok: false, chyba: 'Sken zatím není nahraný.' };
  const f = DriveApp.getFileById(x.r['Sken – ID']);
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
function prExport_(o) {
  const radky = radky_(LIST_PRIHLASKY).filter(r => r['ID'] && r['Stav'] === 'schváleno' && !r['Údaje smazány']);
  const SL = ['Příjmení', 'Jméno', 'Rodné číslo', 'Datum narození', 'Státní příslušnost', 'Ulice a číslo', 'Obec', 'PSČ', 'Telefon', 'E-mail', 'Sportovec',
    'Kategorie', 'Sbor', 'Přestup z', 'Zákonný zástupce', 'Datum narození zák. zástupce', 'Telefon zák. zástupce', 'Číslo přihlášky', 'Zaplaceno'];
  const q = v => { const t = String(v == null ? '' : v); return /[";\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  const den = v => v instanceof Date ? Utilities.formatDate(v, 'Europe/Prague', 'd.M.yyyy') : (/^\d{4}-\d{2}-\d{2}/.test(String(v || '')) ? String(v).slice(8, 10).replace(/^0/, '') + '.' + String(v).slice(5, 7).replace(/^0/, '') + '.' + String(v).slice(0, 4) : '');
  const out = [SL.join(';')];
  let chybi = 0;
  radky.forEach(r => {
    const u = prUdaje_(r); if (!u) { chybi++; return; }
    out.push([r['Příjmení'], r['Jméno'], u.rc, den(r['Datum narození']), u.prislusnost, u.ulice, u.obec, u.psc, u.telefon, u.email, r['Sportovec'],
      r['Kategorie'], r['Sbor'], r['Přestup z'], r['Zákonný zástupce'], den(u.zzNarozeni), u.zzTelefon, r['ID'], den(r['Zaplaceno'])].map(q).join(';'));
  });
  zaznamZmeny_(o.email, LIST_PRIHLASKY, '', 'export', '', 'export pro evidenci: ' + (out.length - 1) + ' přihlášek' + (chybi ? ', bez údajů ' + chybi : ''));
  return { ok: true, nazev: 'prihlasky-pro-evidenci-' + Utilities.formatDate(new Date(), 'Europe/Prague', 'yyyy-MM-dd') + '.csv', csv: '﻿' + out.join('\r\n'), pocet: out.length - 1 };
}

/* ---------- noční výmaz údajů po lhůtě ---------- */

/** udaje.json a vyplněné PDF smaže: zapsáno po PRIHLASKY_VYMAZ_ZAPSANO_DNY (90), zamítnuto / staženo po PRIHLASKY_VYMAZ_OSTATNI_DNY (30). Sken zůstává. */
function prVymazat_() {
  const sh = dataSs_().getSheetByName(LIST_PRIHLASKY); if (!sh || sh.getLastRow() < 2) return 0;
  const h = hlavicka_(sh), col = k => h.indexOf(k), rng = sh.getRange(2, 1, sh.getLastRow() - 1, h.length), v = rng.getValues();
  const dZap = Number(nastaveniWeb_('PRIHLASKY_VYMAZ_ZAPSANO_DNY') || 90), dOst = Number(nastaveniWeb_('PRIHLASKY_VYMAZ_OSTATNI_DNY') || 30), ted = Date.now();
  let n = 0;
  v.forEach(r => {
    const stav = r[col('Stav')], od = r[col('Stav od')];
    if (r[col('Údaje smazány')] || !(od instanceof Date)) return;
    const lhuta = stav === 'zapsáno' ? dZap : (stav === 'zamítnuto' || stav === 'staženo') ? dOst : null;
    if (lhuta == null || ted - od.getTime() < lhuta * 864e5) return;
    ['udaje.json'].forEach(nm => { const f = prSouborVeSlozce_(r[col('Složka – ID')], nm); if (f) f.setTrashed(true); });
    if (r[col('PDF – ID')]) { try { DriveApp.getFileById(r[col('PDF – ID')]).setTrashed(true); } catch (e) {} }
    r[col('Údaje smazány')] = new Date();
    zaznamZmeny_('noční údržba', LIST_PRIHLASKY, r[col('ID')], 'upraveno', stav, 'údaje a PDF smazány po ' + lhuta + ' dnech (sken zůstává)');
    n++;
  });
  if (n) rng.setValues(v);
  return n;
}

/* ---------- test ---------- */

/** Tři testovací přihlášky (dospělý, mladý hasič, přestup) se smyšlenými platnými rodnými čísly. PDF = nevyplněná šablona z webu
 *  (vyplněné PDF tvoří až prohlížeč – vyzkoušejte formulář). Jména začínají TEST, takže je smaže Úklid testů. */
function vlozitTestyPrihlasek() {
  const web = nastaveniWeb_('WEB_URL') || 'https://test.oshpz.cz';
  const sablona = k => Utilities.base64Encode(UrlFetchApp.fetch(web + '/assets/sablony/' + (k ? 'prihlaska-clena-mlady-hasic.pdf' : 'prihlaska-clena-hasic.pdf')).getContent());
  const s = prSbor_('kamenny-ujezdec') || prSbor_(radkyRychle_('Sbory')[0]['Sbor']);
  const zaklad = { ulice: 'Testovací 1', obec: 'Kamenný Přívoz', psc: '25282', prislusnost: 'ČR', telefon: '+420 777 000 001', sportovec: false, souhlas: true };
  const testy = [
    Object.assign({}, zaklad, { jmeno: 'TEST Jan', prijmeni: 'Dospělý', rc: '7801233540', email: 'test-dospely@example.cz', sportovec: true, pdf: sablona(false) }),
    Object.assign({}, zaklad, { jmeno: 'TEST Eliška', prijmeni: 'Mladá', rc: '1458141234', email: 'test-mh@example.cz', zzJmeno: 'TEST Marie Mladá', zzNarozeni: '1985-03-12', zzTelefon: '+420 777 000 002', pdf: sablona(true) }),
    Object.assign({}, zaklad, { jmeno: 'TEST Petr', prijmeni: 'Přestupující', rc: '9002020005', email: 'test-prestup@example.cz', prestup: true, prestupZ: 'SDH Čisovice', pdf: sablona(false) })
  ];
  const vysl = testy.map(t => { const r = prZalozit_(t, s, Session.getActiveUser().getEmail() || 'test', 'test'); return r.ok ? r.id + ' (' + r.kategorie + ')' : 'chyba: ' + r.chyba; });
  console.log('Testovací přihlášky pro ' + s.sbor + ': ' + vysl.join(', '));
  try { SpreadsheetApp.getActive().toast(vysl.join(', '), 'Přihlášky', 10); } catch (e) {}
}

/** Test výmazu: dočasně posune „Stav od“ u zapsaných / stažených TEST přihlášek o 365 dní zpět a spustí výmaz. */
function testVymazuPrihlasek() {
  const sh = dataSs_().getSheetByName(LIST_PRIHLASKY), h = hlavicka_(sh), col = k => h.indexOf(k);
  const rng = sh.getRange(2, 1, sh.getLastRow() - 1, h.length), v = rng.getValues();
  v.forEach(r => { if (/^TEST/.test(String(r[col('Jméno')])) && ['zapsáno', 'zamítnuto', 'staženo'].indexOf(r[col('Stav')]) >= 0) r[col('Stav od')] = new Date(Date.now() - 365 * 864e5); });
  rng.setValues(v);
  console.log('Smazáno údajů u přihlášek: ' + prVymazat_());
}
