/**
 * OSH data – přihlášky členů SH ČMS (B7, list Členské přihlášky).
 *
 * Postup: odesláno (uchazeč na webu nebo sbor v portálu, PDF vyplní prohlížeč) → člen zaplatí sboru, sbor vyplní Zaplaceno →
 * sken u okresu (sbor nahraje podepsanou přihlášku s razítkem – jen po zaplacení, aby sbor neodváděl okresu za neplatiče) →
 * schváleno / vráceno (okres, role Přihlášky; vrácení s důvodem) → zapsáno (evidenční číslo z evidencesdh.cz). Dál zamítnuto a staženo (= zrušeno sborem).
 *
 * Osobní údaje: v tabulce jen jméno, datum narození, kategorie, kontakt a stav. Rodné číslo, adresa a údaje zákonného
 * zástupce jsou jen ve vyplněném PDF a v udaje.json ve složce Přihlášky/<sbor>/<ID>/ – na Můj disk účtu, pod kterým skript
 * běží (sdílený disk vidí všichni jeho členové), bez sdílení. Server ji čte jen pro roli Přihlášky a pro daný sbor.
 * Noční údržba (prhVymazat_) smaže udaje.json a PDF po lhůtě z Nastavení; sken zůstává jako doklad o podpisu.
 * Do logu, Záznamu změn ani do e-mailů nikdy nejde rodné číslo ani adresa.
 */

const LIST_PRIHLASKY = 'Členské přihlášky';
const PRH_STAVY_SKEN = ['odesláno', 'vráceno'];                 // sbor smí nahrát (znovu) sken a fotku a předat okresu
const PRH_STAVY_STAHNOUT = ['odesláno', 'vráceno', 'sken u okresu'];
const PRH_LIMIT_WEB = 20, PRH_LIMIT_EMAIL = 3;                  // veřejný formulář: za 10 min celý web, za hodinu jeden e-mail
const PRH_PDF_MAX = 3 * 1024 * 1024;
let _prhBezPosty = false; // automatický test (testPrihlaskyOdvod) neposílá e-maily
const PRH_ODVOD_STAVY = ['sken u okresu', 'schváleno', 'zapsáno']; // předané přihlášky: nezaplacený odvod = dluh sboru
const PRH_ODVOD_AKTIVNI = ['odesláno', 'vráceno', 'sken u okresu', 'schváleno', 'zapsáno']; // odvod jde zaplatit i před předáním
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

/** Kontrola údajů z formuláře. Vrací { chyba } nebo { d: vyčištěné údaje, rc }. */
function prhKontrola_(vstup) {
  const t = k => String(vstup[k] == null ? '' : vstup[k]).trim();
  const d = { jmeno: t('jmeno'), prijmeni: t('prijmeni'), rc: t('rc'), ulice: t('ulice'), obec: t('obec'), psc: t('psc').replace(/\s/g, ''),
    prislusnost: t('prislusnost') || 'ČR', telefon: t('telefon'), email: normEmail_(t('email')), sportovec: vstup.sportovec === true,
    zzJmeno: t('zzJmeno'), zzNarozeni: t('zzNarozeni'), zzTelefon: t('zzTelefon'), prestupZ: vstup.prestup ? t('prestupZ') : '' };
  const ch = kontrolaTextu_(d, { jmeno: 60, prijmeni: 60, ulice: 100, obec: 60, prislusnost: 40, zzJmeno: 120, prestupZ: 100 });
  if (ch) return { chyba: ch };
  if (!d.jmeno || !d.prijmeni) return { chyba: 'Vyplňte jméno a příjmení.' };
  const rc = prhRc_(d.rc);
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
function prhSbor_(klic) {
  const slug = t => String(t || '').replace(/^SDH\s+/i, '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const k = slug(klic), sk = String(klic || '').toLowerCase().split('@')[0];
  const r = radkyRychle_('Sbory').find(x => String(x['Aktivní']).trim().toUpperCase() !== 'NE' && (slug(x['Sbor']) === k || (x['Skupina'] && String(x['Skupina']).toLowerCase().split('@')[0] === sk)));
  return r ? { sbor: String(r['Sbor']), skupina: String(r['Skupina'] || '').toLowerCase().split('@')[0], ucet: String(r['Číslo účtu'] || '').trim(), nastaveni: prhNastaveniSboru_(r) } : null;
}
/** Nastavení přihlášek sboru (list Sbory): příspěvky (prázdné = výchozí z Nastavení) a výchozí „sportovec“ u mladých hasičů. */
function prhNastaveniSboru_(r) {
  const kc = (v, vychozi) => v === '' || v == null ? Number(nastaveniWeb_(vychozi) || 0) : Number(v) || 0;
  return { prispevekDospely: kc(r['Příspěvek dospělý'], 'PRISPEVEK_DOSPELY'), prispevekMH: kc(r['Příspěvek MH'], 'PRISPEVEK_MH'), mhSportovec: ano_(r['MH jako sportovec']),
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
    'Variabilní symbol', 'Zaplaceno', 'Evidenční číslo', 'Stav', 'Stav od', 'Poznámka', 'Zdroj', 'Vytvořeno', 'Odvod', 'Odvod přijat', 'Odvod zaplacen'].forEach(k => { o[k] = iso(r[k]); });
  o.maSken = !!r['Sken – ID']; o.maPdf = !!r['PDF – ID'] && !r['Údaje smazány']; o.maFotku = !!r['Fotka – ID'] && !r['Údaje smazány'];
  return o;
}

/* ---------- založení (veřejný formulář i sbor) ---------- */

function prhZalozit_(vstup, s, kdo, zdroj) {
  if (!s.nastaveni || !s.nastaveni.regCislo) return { ok: false, chyba: 'Sbor zatím nemá v evidenci okresu registrační číslo, bez něj přihláška nejde vyplnit. Ozvěte se prosím kanceláři OSH.' };
  const k = prhKontrola_(vstup);
  if (k.chyba) return { ok: false, chyba: k.chyba };
  let pdf;
  try { pdf = Utilities.base64Decode(String(vstup.pdf || '')); } catch (e) { return { ok: false, chyba: 'PDF přihlášky se nepodařilo přečíst.' }; }
  if (pdf.length > PRH_PDF_MAX) return { ok: false, chyba: 'PDF přihlášky je příliš velké.' };
  const chS = overitSoubor_('prihlaska.pdf', 'application/pdf', pdf.length, null, pdf);
  if (chS) return { ok: false, chyba: chS };
  const d = k.d, ted = new Date();
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = dataSs_().getSheetByName(LIST_PRIHLASKY), h = hlavicka_(sh), col = x => h.indexOf(x);
    const ids = sh.getLastRow() > 1 ? sh.getRange(2, col('ID') + 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
    let vs; do { vs = Utilities.formatDate(ted, 'Europe/Prague', 'yyMMdd') + String(Math.floor(Math.random() * 10000)).padStart(4, '0'); } while (ids.indexOf('P' + vs) >= 0);
    const id = 'P' + vs;
    const slozka = prhSlozka_(s.sbor, id);
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
    prhPosta_(s.skupina, 'Nová přihláška člena: ' + d.jmeno + ' ' + d.prijmeni,
      'V portálu sboru je nová přihláška (' + k.rc.kategorie + '): ' + d.jmeno + ' ' + d.prijmeni + ', SDH ' + s.sbor.replace(/^SDH\s+/i, '') + '. ' +
      'Až člen zaplatí příspěvek, označte Zaplaceno, nechte přihlášku podepsat a nahrajte sken – tím ji předáte okresu.', 'sbor/' + s.skupina + '/clenove');
    return { ok: true, id: id, vs: vs, kategorie: k.rc.kategorie, data: prhJson_(h.reduce((o, x, j) => (o[x] = r[j], o), {})) };
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
  const html = sablona_(predmet, text, [], ['Otevřít v aplikaci', url], 'Automatická zpráva aplikace OSH Praha-západ.');
  komu.filter(Boolean).forEach(e => { try { posta_(e, predmet, text + '\n\n' + url, html); } catch (x) { console.error('E-mail k přihlášce: ' + x.message); } });
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
    return req.akce === 'prihlaskaPdf' ? prhPdf_(o, x) : req.akce === 'prihlaskaFotka' ? prhFotkaCist_(x) : prhSkenNahled_(x, req.original === true);
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
  if (req.akce === 'prihlaskaFotkaNahrat') return prhFotka_(o, x, req);
  if (req.akce === 'prihlaskaPredat') return prhPredat_(o, x);
  if (req.akce === 'prihlaskaZaplaceno') return prhZaplaceno_(o, x, req);
  if (req.akce === 'prihlaskaStahnout') return prhKonec_(o, x, 'staženo', PRH_STAVY_STAHNOUT, '');
  return { ok: false, chyba: 'Neznámá akce' };
}

/** Sbor si sám nastaví výši příspěvků a výchozí „sportovec“ u MH (vnitřní nastavení sboru – okres to neschvaluje). Prázdná částka = výchozí z Nastavení. */
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
    const pred = [v[i][col('Příspěvek dospělý')], v[i][col('Příspěvek MH')], v[i][col('MH jako sportovec')]].join(' / ');
    sh.getRange(i + 2, col('Příspěvek dospělý') + 1).setValue(dosp);
    sh.getRange(i + 2, col('Příspěvek MH') + 1).setValue(mh);
    sh.getRange(i + 2, col('MH jako sportovec') + 1).setValue(req.mhSportovec === true ? 'ANO' : 'NE');
    vycistitMezipamet_('Sbory'); CacheService.getScriptCache().removeAll(['v_sbory', 'v_web']);
    zaznamZmeny_(o.email, 'Sbory', sk, 'upraveno', pred, 'nastavení přihlášek: ' + [dosp, mh, req.mhSportovec === true ? 'ANO' : 'NE'].join(' / '));
    return { ok: true, nastaveni: prhNastaveniSboru_({ 'Příspěvek dospělý': dosp, 'Příspěvek MH': mh, 'MH jako sportovec': req.mhSportovec === true ? 'ANO' : 'NE', 'Registrační číslo': v[i][col('Registrační číslo')] }) };
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
  if (zap && ['odesláno', 'vráceno'].indexOf(x.r['Stav']) < 0) return { ok: false, chyba: 'Platbu potvrdíte u přihlášky, která ještě není u okresu.' };
  if (!zap && ['odesláno', 'vráceno'].indexOf(x.r['Stav']) < 0) return { ok: false, chyba: 'Přihláška už je u okresu – platbu zrušit nejde.' };
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
  else if (roz === 'zamítnout') v = prhKonec_(o, x, 'zamítnuto', ['odesláno', 'sken u okresu', 'vráceno', 'schváleno'], duvod);
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

function prhEvidence_(o, x, req) {
  const cislo = String(req.cislo || '').trim();
  if (!/^[\w\/-]{1,20}$/.test(cislo)) return { ok: false, chyba: 'Vyplňte evidenční číslo z evidencesdh.cz (písmena, číslice, - a /).' };
  return prhStav_(o, x, 'zapsáno', ['schváleno', 'zapsáno'], null, { 'Evidenční číslo': bezVzorce_(cislo) });
}

/** Detail pro okres: údaje z tabulky + z udaje.json jen maskované rodné číslo, adresa, zákonný zástupce. */
function prhDetail_(x) { // jen pro roli Přihlášky (apiPrihlasky_)
  const u = prhUdaje_(x.r) || {};
  return { ok: true, data: prhJson_(x.r), detail: { rc: prhMaska_(u.rc), ulice: u.ulice || '', obec: u.obec || '', psc: u.psc || '', prislusnost: u.prislusnost || '',
    zzNarozeni: u.zzNarozeni || '', zzTelefon: u.zzTelefon || '', smazano: !!x.r['Údaje smazány'] } };
}

function prhPdf_(o, x) {
  if (x.r['Údaje smazány'] || !x.r['PDF – ID']) return { ok: false, chyba: 'Vyplněné PDF už bylo po lhůtě smazáno.' };
  try {
    const f = DriveApp.getFileById(x.r['PDF – ID']);
    zaznamZmeny_(o.email, LIST_PRIHLASKY, x.r['ID'], 'čteno', '', 'stažení PDF');
    return { ok: true, nazev: 'Prihlaska ' + x.r['ID'] + '.pdf', data: Utilities.base64Encode(f.getBlob().getBytes()) };
  } catch (e) { return { ok: false, chyba: 'PDF se nepodařilo otevřít.' }; }
}

/** Náhled skenu (Disk ho zmenší na 1600 px, i z PDF), nebo původní soubor ke stažení. */
function prhSkenNahled_(x, original) {
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

/** udaje.json, vyplněné PDF a fotku smaže: zapsáno po PRIHLASKY_VYMAZ_ZAPSANO_DNY (90), zamítnuto / staženo po PRIHLASKY_VYMAZ_OSTATNI_DNY (30). Sken zůstává. */
function prhVymazat_() {
  const sh = dataSs_().getSheetByName(LIST_PRIHLASKY); if (!sh || sh.getLastRow() < 2) return 0;
  const h = hlavicka_(sh), col = k => h.indexOf(k), rng = sh.getRange(2, 1, sh.getLastRow() - 1, h.length), v = rng.getValues();
  const dZap = Number(nastaveniWeb_('PRIHLASKY_VYMAZ_ZAPSANO_DNY') || 90), dOst = Number(nastaveniWeb_('PRIHLASKY_VYMAZ_OSTATNI_DNY') || 30), ted = Date.now();
  let n = 0;
  v.forEach(r => {
    const stav = r[col('Stav')], od = r[col('Stav od')];
    if (r[col('Údaje smazány')] || !(od instanceof Date)) return;
    const lhuta = stav === 'zapsáno' ? dZap : (stav === 'zamítnuto' || stav === 'staženo') ? dOst : null;
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
    const a = prhZalozit_(Object.assign({}, zaklad, { jmeno: 'TEST Odvod', prijmeni: 'Dospělý', rc: RC.d, email: 'test-odvod-d@example.cz' }), sbor, o.email, 'test');
    const b = prhZalozit_(Object.assign({}, zaklad, { jmeno: 'TEST Odvod', prijmeni: 'Mladý', rc: RC.mh, email: 'test-odvod-mh@example.cz', zzJmeno: 'TEST Rodič', zzNarozeni: '1985-03-12', zzTelefon: '+420 777 000 002' }), sbor, o.email, 'test');
    if (a.ok) nove.push(a.id); if (b.ok) nove.push(b.id);
    ok('založení dvou přihlášek', a.ok && b.ok, (a.chyba || '') + (b.chyba || ''));
    ok('kategorie podle rodného čísla', a.kategorie === 'dospělý' && b.kategorie === 'mladý hasič', a.kategorie + ' / ' + b.kategorie);
    const R = id => prhRadek_(id), skenData = { nazev: 'sken.pdf', mime: 'application/pdf', data: pdf };
    // fotka: nejmenší platný PNG (1 × 1 px)
    const fotka = { mime: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' };
    ok('sken bez platby se odmítne', !prhSken_(o, R(a.id), skenData).ok);
    ok('Zaplaceno u odeslané', prhZaplaceno_(o, R(a.id), { zaplaceno: true }).ok && !!R(a.id).r['Zaplaceno']);
    prhZaplaceno_(o, R(b.id), { zaplaceno: true });
    ok('sken po zaplacení – přihláška zůstává u sboru', prhSken_(o, R(a.id), skenData).ok && R(a.id).r['Stav'] === 'odesláno' && !!R(a.id).r['Sken – ID']);
    ok('předání bez fotky se odmítne', !prhPredat_(o, R(a.id)).ok && R(a.id).r['Stav'] === 'odesláno');
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
  v.forEach(r => { if (/^TEST/.test(String(r[col('Jméno')])) && ['zapsáno', 'zamítnuto', 'staženo'].indexOf(r[col('Stav')]) >= 0) r[col('Stav od')] = new Date(Date.now() - 365 * 864e5); });
  rng.setValues(v);
  console.log('Smazáno údajů u přihlášek: ' + prhVymazat_());
}
