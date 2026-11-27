/**
 * OSH data – hlášení chyb z webu a ze Spojky (akce chybaNahlasit).
 *
 * Kdokoli (web: bez přihlášení s ověřením proti robotům; Spojka: přihlášený) pošle krátký popis, nepovinně snímek obrazovky a prohlížeč
 * k tomu sám přidá technické údaje (adresa, obrazovka, prohlížeč, velikost okna, poslední chyby a volání serveru).
 * Hlášení se zapíše do listu Hlášení chyb a přijde e-mailem správcům (spravci@). Snímek se ukládá do složky
 * „Hlášení chyb (důvěrné)“ na Můj disk účtu skriptu bez sdílení (na snímku může být cokoli z obrazovky) a noční údržba ho po
 * CHYBY_VYMAZ_DNY smaže. Předpona funkcí: ch…
 */

const LIST_CHYBY = 'Hlášení chyb';
const CH_SLOUPCE = ['ID', 'Čas', 'Kdo', 'Kontakt', 'Kde', 'Obrazovka', 'Adresa', 'Popis', 'Technické údaje', 'Snímek – ID', 'Stav', 'Poznámka'];
const CH_OBRAZKY = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const CH_LIMIT_WEB = 30, CH_LIMIT_KDO = 6; // hlášení z webu celkem za 10 min; na jednoho odesílatele za hodinu

function apiChyba_(req) {
  const d = req.data || {}, o = req.token ? prihlaseny_(req.token) : null;
  if (req.token && !o) return { ok: false, chyba: 'Nepřihlášen', odhlasen: true };
  if (!o) { // z webu bez přihlášení: ověření proti robotům a limit na celý web
    const ts = overitTurnstile_(req.turnstile, 'chyba');
    if (ts) return { ok: false, chyba: ts };
    if (limit_('chyba-web', 'web', CH_LIMIT_WEB, 600)) return { ok: false, chyba: 'Služba je teď přetížená. Zkuste to za 10 minut, nebo napište na spravci@' + (nastaveniWeb_('DOMENA') || 'oshpz.cz') + '.' };
  }
  const popis = String(d.popis || '').trim(), kontakt = o ? o.email : normEmail_(d.kontakt);
  if (popis.length < 5) return { ok: false, chyba: 'Napište prosím aspoň pár slov, co se stalo.' };
  const ch = kontrolaTextu_({ 'Popis': popis, 'Obrazovka': d.obrazovka, 'Adresa': d.adresa }, { 'Popis': 3000, 'Obrazovka': 200, 'Adresa': 500 });
  if (ch) return { ok: false, chyba: ch };
  if (!o && d.kontakt && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(kontakt)) return { ok: false, chyba: 'E-mail pro odpověď nemá správný tvar.' };
  if (limit_('chyba-kdo', kontakt || 'bez kontaktu', o ? 20 : CH_LIMIT_KDO, 3600)) return { ok: false, chyba: 'Poslali jste už několik hlášení. Další zkuste za hodinu.' };
  const kde = d.kde === 'aplikace' ? 'Spojka' : 'web';
  const tech = chTechnicke_(d.technicke);

  // snímek obrazovky (nepovinný): jen obrázek, ověřený i podle obsahu
  let snimek = null;
  if (d.snimek && d.snimek.base64) {
    const mime = String(d.snimek.mime || '');
    let bajty; try { bajty = Utilities.base64Decode(String(d.snimek.base64)); } catch (e) { return { ok: false, chyba: 'Snímek se nepodařilo přečíst. Zkuste ho přiložit znovu.' }; }
    const vada = overitSoubor_('snimek.' + (CH_OBRAZKY[mime] || 'jpg'), mime, bajty.length, CH_OBRAZKY, bajty);
    if (vada) return { ok: false, chyba: vada };
    snimek = Utilities.newBlob(bajty, mime, 'snimek.' + CH_OBRAZKY[mime]);
  }

  const ted = new Date(), zamek = LockService.getScriptLock();
  let id = '', souborId = '';
  try {
    zamek.waitLock(20000);
    const sh = chList_(), h = hlavicka_(sh), col = x => h.indexOf(x);
    const ids = sh.getLastRow() > 1 ? sh.getRange(2, col('ID') + 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
    do { id = 'H' + Utilities.formatDate(ted, 'Europe/Prague', 'yyMMdd') + String(Math.floor(Math.random() * 10000)).padStart(4, '0'); } while (ids.indexOf(id) >= 0);
    if (snimek) { try { const f = chSlozka_().createFile(snimek.setName(id + ' snimek.' + CH_OBRAZKY[snimek.getContentType()])); souborId = f.getId(); } catch (e) { console.error('Snímek k hlášení ' + id + ': ' + e.message); } }
    const r = h.map(() => ''), set = (x, val) => { if (col(x) >= 0) r[col(x)] = val; };
    set('ID', id); set('Čas', ted); set('Kdo', o ? o.email : 'web'); set('Kontakt', kontakt); set('Kde', kde);
    set('Obrazovka', bezVzorce_(String(d.obrazovka || ''))); set('Adresa', bezVzorce_(String(d.adresa || ''))); set('Popis', bezVzorce_(popis));
    set('Technické údaje', bezVzorce_(tech)); set('Snímek – ID', souborId); set('Stav', 'nové');
    sh.appendRow(r);
  } catch (e) { console.error('Hlášení chyby: ' + e.message + '\n' + e.stack); return { ok: false, chyba: 'Hlášení se nepodařilo uložit. Zkuste to prosím znovu.' }; }
  finally { try { zamek.releaseLock(); } catch (e) {} }

  try { zaznamZmeny_(o ? o.email : 'web', LIST_CHYBY, id, 'vytvořeno', '', kde + ': ' + popis.slice(0, 120)); } catch (e) { console.error(e); }
  try { // e-mail správcům: popis, kde to bylo, technické údaje a snímek v příloze
    const komu = 'spravci@' + (nastaveniWeb_('DOMENA') || 'oshpz.cz'), predmet = 'Hlášení chyby ' + id + ' – ' + kde + (d.obrazovka ? ' · ' + String(d.obrazovka).slice(0, 60) : '');
    const pol = [['Popis', popis], ['Kdo', o ? (o.jmeno ? o.jmeno + ' · ' : '') + o.email : (kontakt || 'neuvedeno (web)')], ['Kde', kde + (d.obrazovka ? ' – ' + d.obrazovka : '')], ['Adresa', String(d.adresa || '')],
      ['Snímek', snimek ? (souborId ? 'v příloze' : 'nepodařilo se uložit, je jen v příloze') : 'bez snímku'], ['Technické údaje', tech]];
    const text = pol.map(p => p[0] + ': ' + p[1]).join('\n\n');
    posta_(komu, predmet, text, sablona_(predmet, 'Nové hlášení chyby z ' + (kde === 'web' ? 'webu' : 'aplikace Spojka') + '. Stav si veďte v listu Hlášení chyb.', pol, null, 'Automatická zpráva.'),
      false, Object.assign(snimek ? { attachments: [snimek] } : {}, kontakt ? { replyTo: kontakt } : {}));
  } catch (e) { console.error('E-mail k hlášení ' + id + ': ' + e.message); }
  return { ok: true, id: id };
}

/** Technické údaje z prohlížeče → čitelný text „klíč: hodnota“ po řádcích. Jen známé klíče, omezená délka, žádné HTML. */
function chTechnicke_(t) {
  if (!t || typeof t !== 'object') return '';
  const KLICE = ['prostredi', 'cas', 'prohlizec', 'okno', 'obrazovka', 'jazyk', 'online', 'role', 'sbor', 'rezim', 'odkud', 'chyby', 'volani', 'hlaska'];
  const cisty = v => String(Array.isArray(v) ? v.join(' | ') : v == null ? '' : v).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  return KLICE.filter(k => t[k] != null && t[k] !== '').map(k => k + ': ' + cisty(t[k]).slice(0, k === 'chyby' || k === 'volani' ? 1200 : 300)).join('\n').slice(0, 4000);
}

/** List Hlášení chyb – když ještě není (před „Založit / doplnit strukturu“), založí se sám s hlavičkou. */
function chList_() {
  const ss = dataSs_();
  let sh = ss.getSheetByName(LIST_CHYBY);
  if (!sh) { sh = ss.insertSheet(LIST_CHYBY); sh.getRange(1, 1, 1, CH_SLOUPCE.length).setValues([CH_SLOUPCE]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}

/** Složka snímků na Můj disk účtu skriptu, bez sdílení (ID ve Vlastnosti skriptu CHYBY_SLOZKA_ID). */
function chSlozka_() {
  const p = PropertiesService.getScriptProperties(), id = p.getProperty('CHYBY_SLOZKA_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { console.warn('Složka hlášení chyb nejde otevřít: ' + e.message); } }
  const f = DriveApp.getRootFolder().createFolder('Hlášení chyb (důvěrné)');
  f.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  p.setProperty('CHYBY_SLOZKA_ID', f.getId());
  return f;
}

/** Noční údržba: snímky starší než CHYBY_VYMAZ_DNY do koše (řádek hlášení zůstává, sloupec Snímek – ID se vyprázdní). */
function chUdrzba_() {
  const dny = Number(nastaveniWeb_('CHYBY_VYMAZ_DNY')) || 180, sh = dataSs_().getSheetByName(LIST_CHYBY);
  if (!sh || sh.getLastRow() < 2) return 0;
  const h = hlavicka_(sh), cCas = h.indexOf('Čas'), cSn = h.indexOf('Snímek – ID'), v = sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues(), hranice = Date.now() - dny * 864e5;
  let n = 0;
  v.forEach((r, i) => { if (!r[cSn] || !(r[cCas] instanceof Date) || r[cCas].getTime() > hranice) return;
    try { DriveApp.getFileById(String(r[cSn])).setTrashed(true); } catch (e) {}
    sh.getRange(i + 2, cSn + 1).setValue(''); n++; });
  return n;
}
