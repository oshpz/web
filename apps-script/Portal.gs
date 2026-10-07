/**
 * OSH data – viditelnost „Pro koho“ a portál sboru.
 * Nový soubor „Portal“ ve stejném projektu.
 *
 * Pro koho (Akce, Termíny, Dokumenty): veřejnost (i prázdné), všechny sbory, sbory s MH, sbory s JSDH, sbory se sportem,
 *   okrsek (+ sloupec Okrsek), jen okres. Jediné místo s pravidly je smiVidet_() – používají ho všechny výpisy.
 * Dokument, který není veřejný, se nesdílí odkazem, ale se skupinou (sbory@, sbory-mh@, …, okrsek-NN@). Sdílí se přes
 *   službu Drive API (Služby → Drive API, identifikátor Drive) bez oznamovacího e-mailu – jinak by každé zveřejnění
 *   poslalo všem sborům „… s vámi sdílí soubor“.
 */

const PRO_VEREJNOST = ['', 'veřejnost'];

/**
 * Smí uživatel vidět řádek? uzivatel = null (veřejnost) nebo { role: {…}, sbory: [{ mh, jsdh, sport, okrsek }] }
 * (výstup opravneni_ nebo pohledSboru_). Okres (jakákoli role) vidí vše.
 */
function smiVidet_(uzivatel, radek) {
  const pro = String(radek['Pro koho'] == null ? '' : radek['Pro koho']).trim();
  if (PRO_VEREJNOST.indexOf(pro) >= 0) return true;
  if (!uzivatel) return false;
  if (Object.keys(uzivatel.role || {}).length) return true;
  const sbory = uzivatel.sbory || [];
  if (!sbory.length || pro === 'jen okres') return false;
  if (pro === 'všechny sbory') return true;
  if (pro === 'sbory s MH') return sbory.some(s => s.mh);
  if (pro === 'sbory s JSDH') return sbory.some(s => s.jsdh);
  if (pro === 'sbory se sportem') return sbory.some(s => s.sport);
  if (pro === 'okrsek') return radek['Okrsek'] !== '' && radek['Okrsek'] != null && sbory.some(s => Number(s.okrsek) === Number(radek['Okrsek']));
  return false; // neznámá hodnota → raději nic
}

/** Pohled jednoho sboru (portál): bez okresních rolí, jen vybraný sbor. Vrací null, když uživatel do sboru nepatří. */
function pohledSboru_(o, skupina) {
  const s = (o.sbory || []).find(x => !skupina || x.skupina === skupina);
  return s ? { email: o.email, role: {}, sbory: [s], sbor: s } : null;
}

/** Krátký štítek pro aplikaci: „Pro sbory“, „MH“, „Okrsek 5“… (veřejné = ''). */
function stitekProKoho_(r) {
  const pro = String(r['Pro koho'] || '').trim();
  return ({ 'všechny sbory': 'Pro sbory', 'sbory s MH': 'MH', 'sbory s JSDH': 'JSDH', 'sbory se sportem': 'Sport', 'jen okres': 'Jen okres' })[pro] ||
    (pro === 'okrsek' ? 'Okrsek ' + (r['Okrsek'] || '?') : '');
}

/* ---------- portál sboru ---------- */

function apiPortal_(req) {
  const o = prihlaseny_(req.token);
  if (!o) return { ok: false, chyba: 'Nepřihlášen', odhlasen: true };
  const u = pohledSboru_(o, req.sbor);
  if (!u) return { ok: false, chyba: 'K tomuto sboru nemáte přístup.' };
  const iso = v => v instanceof Date ? v.toISOString() : v;
  const od = new Date(Date.now() - 60 * 864e5);
  const vyber = (list, pole) => radky_(list).filter(r => r['Stav'] === 'zveřejněno' && smiVidet_(u, r))
    .map(r => pole.reduce((x, k) => (x[k] = iso(r[k]), x), { stitek: stitekProKoho_(r) }));
  const akce = vyber('Akce', ['ID', 'Název', 'Typ', 'Pořadatel', 'Od', 'Do', 'Místo', 'Pro koho', 'Okrsek', 'Popis', 'Odkaz'])
    .filter(r => new Date(r['Do'] || r['Od']) >= od);
  const terminy = vyber('Termíny', ['ID', 'Název', 'Datum', 'Typ', 'Pořadatel', 'Pro koho', 'Okrsek', 'Popis'])
    .filter(r => new Date(r['Datum']) >= od);
  const dokumenty = vyber('Dokumenty', ['ID', 'Orgán', 'Datum', 'Rok', 'Název', 'Veřejný odkaz', 'Schváleno', 'Pro koho', 'Okrsek']);
  const r = radky_('Sbory').find(x => String(x['Skupina'] || '').split('@')[0].toLowerCase() === u.sbor.skupina) || {};
  const sbor = { skupina: u.sbor.skupina, sbor: r['Sbor'] || u.sbor.sbor, okrsek: r['Okrsek'] || u.sbor.okrsek, mh: ano_(r['MH']), jsdh: ano_(r['JSDH']), sport: ano_(r['Sport']),
    ico: String(r['IČO'] || ''), web: String(r['Web'] || ''), ucet: String(r['Číslo účtu'] || ''), email: u.sbor.skupina + '@' + (nastaveniWeb_('DOMENA') || 'oshpz.cz') };
  const clenove = clenstvi_().filter(c => c.g === u.sbor.skupina).map(c => c.e).sort();
  return { ok: true, sbor: sbor, akce: akce, terminy: terminy, dokumenty: dokumenty, clenove: clenove };
}

/** „Nahlásit změnu“ údajů sboru: e-mail na spravci@ a zápis do Záznamu změn. Údaje se zatím mění jen v tabulce. */
function apiNahlasitZmenu_(req) {
  const o = prihlaseny_(req.token);
  if (!o) return { ok: false, chyba: 'Nepřihlášen', odhlasen: true };
  const u = pohledSboru_(o, req.sbor);
  if (!u) return { ok: false, chyba: 'K tomuto sboru nemáte přístup.' };
  const text = String(req.text || '').trim();
  if (!text) return { ok: false, chyba: 'Napište, co se má změnit.' };
  const chyba = kontrolaTextu_({ 'Změna': text }, { 'Změna': 2000 });
  if (chyba) return { ok: false, chyba: chyba };
  if (limit_('zmena-sboru', o.email, 10, 3600)) return { ok: false, chyba: 'Příliš mnoho hlášení za hodinu. Zkuste to později.' };
  const nazev = u.sbor.sbor || u.sbor.skupina;
  posta_('spravci@' + (nastaveniWeb_('DOMENA') || 'oshpz.cz'), 'Změna údajů sboru: ' + nazev,
    'Dobrý den,\n\n' + o.email + ' nahlásil(a) změnu údajů sboru ' + nazev + ' (skupina ' + u.sbor.skupina + '):\n\n' + text +
    '\n\nÚdaje upravte v tabulce OSH data, list Sbory.\n\nOSH Praha-západ');
  zaznamZmeny_(o.email, 'Sbory', nazev, 'upraveno', '', 'nahlášena změna: ' + text.slice(0, 400));
  return { ok: true };
}

/* ---------- sdílení dokumentů podle Pro koho ---------- */

function skupinySdileni_() {
  const dom = '@' + (nastaveniWeb_('DOMENA') || 'oshpz.cz'), okrsky = [];
  for (let i = 1; i <= 14; i++) okrsky.push('okrsek-' + ('0' + i).slice(-2));
  return ['sbory', 'sbory-mh', 'sbory-jsdh', 'sbory-sport', 'spravci'].concat(okrsky).map(x => x + dom);
}

/**
 * Nastaví sdílení souboru podle Pro koho. proKoho = null → soubor jen pro OSH (stažení, zamítnutí).
 * veřejnost → kdokoli s odkazem; jen okres → jen členové sdíleného disku; jinak skupina (bez oznamovacího e-mailu).
 * Vrací popis pro záznam změn.
 */
function nastavitSdileni_(soubor, proKoho, okrsek) {
  if (typeof Drive === 'undefined') throw new Error('Zapněte v Apps Script službu Drive API (Služby → + → Drive API, verze v3, identifikátor Drive).');
  const id = soubor.getId(), nase = skupinySdileni_();
  // dřívější sdílení se skupinami pryč
  const p = Drive.Permissions.list(id, { supportsAllDrives: true, fields: 'permissions(id,emailAddress,type)' });
  (p.permissions || []).filter(x => x.type === 'group' && nase.indexOf(String(x.emailAddress || '').toLowerCase()) >= 0)
    .forEach(x => Drive.Permissions.remove(id, x.id, { supportsAllDrives: true }));
  const pro = proKoho == null ? null : String(proKoho).trim();
  if (pro !== null && PRO_VEREJNOST.indexOf(pro) >= 0) { soubor.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); return 'kdokoli s odkazem'; }
  try { soubor.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); } catch (e) {}
  if (pro === null || pro === 'jen okres') return 'jen OSH';
  if (pro === 'okrsek' && !(Number(okrsek) >= 1 && Number(okrsek) <= 14)) throw new Error('U „okrsek“ vyplňte číslo okrsku 1–14.');
  const skupina = adresat_(pro, okrsek);
  if (!skupina) throw new Error('Neznámá hodnota Pro koho: ' + pro);
  Drive.Permissions.create({ type: 'group', role: 'reader', emailAddress: skupina }, id, { supportsAllDrives: true, sendNotificationEmail: false });
  return skupina;
}

/* ---------- test viditelnosti (režim TEST) ---------- */

/** Vloží 4 testovací akce (všechny sbory, sbory s MH, okrsek 12, jen okres). Spustit jednou ručně; podruhé nic nepřidá. */
function vlozitTestyViditelnosti() {
  const ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName('Akce'), h = hlavicka_(sh), ted = new Date(), ja = Session.getActiveUser().getEmail();
  const ids = sh.getLastRow() > 1 ? sh.getRange(2, h.indexOf('ID') + 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
  const den = (n, hod) => new Date(ted.getFullYear(), ted.getMonth(), ted.getDate() + n, hod);
  const testy = [
    ['TEST-V1', 'TEST viditelnost: všechny sbory', 'všechny sbory', '', 5],
    ['TEST-V2', 'TEST viditelnost: sbory s MH', 'sbory s MH', '', 8],
    ['TEST-V3', 'TEST viditelnost: okrsek 12', 'okrsek', 12, 12],
    ['TEST-V4', 'TEST viditelnost: jen okres', 'jen okres', '', 15]
  ].filter(t => ids.indexOf(t[0]) < 0);
  testy.forEach(([id, nazev, pro, okr, za]) => {
    const v = { 'ID': id, 'Název': nazev, 'Typ': 'akce okresu', 'Pořadatel': 'VV', 'Od': den(za, 17), 'Do': den(za, 19), 'Místo': 'Jíloviště',
      'Pro koho': pro, 'Okrsek': okr, 'Popis': 'Testovací záznam pro ověření viditelnosti. Po testu smažte.', 'Stav': 'zveřejněno',
      'Oznámeno': 'neposíláno (test)', 'Vytvořeno': ted, 'Vytvořil': ja };
    sh.appendRow(h.map(k => k in v ? v[k] : ''));
  });
  vycistitCache_();
  try { synchronizovatKalendar(); } catch (e) { console.error(e); }
  ss.toast(testy.length ? 'Přidáno ' + testy.length + ' testovacích akcí (TEST-V1 až V4).' : 'Testovací akce už v tabulce jsou.', 'Viditelnost', 8);
}
