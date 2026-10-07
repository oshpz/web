/**
 * OSH data – serverová část, díl 1: základ API (B2.1).
 * Přidejte jako nový soubor „API“ do stejného Apps Script projektu jako OSH-data-struktura.
 * Veřejně čte jen ZVEŘEJNĚNÉ akce, termíny a dokumenty. Zápis a citlivé listy přijdou v dílu 2 (přihlášení).
 */

const VEREJNE = {
  akce:      { list: 'Akce',      pole: ['ID', 'Název', 'Typ', 'Pořadatel', 'Od', 'Do', 'Místo', 'Pro koho', 'Okrsek', 'Popis', 'Odkaz'] },
  terminy:   { list: 'Termíny',   pole: ['ID', 'Název', 'Datum', 'Typ', 'Pro koho', 'Okrsek', 'Popis'] },
  dokumenty: { list: 'Dokumenty', pole: ['ID', 'Orgán', 'Datum', 'Rok', 'Název', 'Veřejný odkaz'] }
};

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    const co = p.co || 'ping';
    // turnstile = veřejný klíč (site key) pro ověření proti robotům; tajný klíč je jen ve vlastnostech skriptu
    if (co === 'ping') return json_({ ok: true, rezim: nastaveniWeb_('REZIM'), cas: new Date().toISOString(), verze: 'F3', turnstile: nastaveniWeb_('TURNSTILE_SITEKEY') }, p.callback);
    if (VEREJNE[co]) return json_({ ok: true, data: cistVerejne_(co, p) }, p.callback);
    return json_({ ok: false, chyba: 'Neznámý požadavek: ' + co }, p.callback);
  } catch (err) {
    console.error(err);
    return json_({ ok: false, chyba: 'Chyba serveru' }, p.callback);
  }
}

// doPost je v souboru Prihlaseni (díl 2). Web volá POST s Content-Type text/plain (kvůli CORS).

function cistVerejne_(co, p) {
  const def = VEREJNE[co];
  const cache = CacheService.getScriptCache(), klic = 'v_' + co;
  let rows = JSON.parse(cache.get(klic) || 'null');
  if (!rows) {
    rows = radky_(def.list)
      .filter(r => r['Stav'] === 'zveřejněno' && (r['Pro koho'] || 'veřejnost') !== 'jen okres')
      .map(r => def.pole.reduce((o, k) => (o[k] = r[k] instanceof Date ? r[k].toISOString() : r[k], o), {}));
    cache.put(klic, JSON.stringify(rows), 300); // 5 minut – web je rychlý, tabulka se nezatěžuje
  }
  if (p.organ) rows = rows.filter(r => r['Orgán'] === p.organ);
  if (p.rok) rows = rows.filter(r => String(r['Rok'] || String(r['Datum'] || r['Od'] || '').slice(0, 4)) === String(p.rok));
  return rows;
}

function radky_(nazevListu) {
  const sh = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('TABULKA_ID')).getSheetByName(nazevListu);
  if (!sh || sh.getLastRow() < 2) return [];
  const v = sh.getDataRange().getValues(), h = v.shift().map(String);
  return v.filter(r => r.some(x => x !== '')).map(r => h.reduce((o, k, i) => (k && (o[k] = r[i]), o), {}));
}

function json_(obj, callback) {
  const t = JSON.stringify(obj);
  if (callback && /^[\w.]+$/.test(callback)) return ContentService.createTextOutput(callback + '(' + t + ')').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(t).setMimeType(ContentService.MimeType.JSON);
}

// nastaveni_ při volání z webu (bez otevřené tabulky) – čte přímo podle ID uloženého ve vlastnostech skriptu.
function nastaveniWeb_(klic) {
  const id = PropertiesService.getScriptProperties().getProperty('TABULKA_ID');
  const sh = SpreadsheetApp.openById(id).getSheetByName('Nastavení');
  const r = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 2).getValues().find(x => x[0] === klic);
  return r ? String(r[1]) : '';
}

/** Spusťte jednou ručně před nasazením: uloží ID tabulky, aby ji web našel. */
function pripravitApi() {
  const id = SpreadsheetApp.getActive().getId();
  PropertiesService.getScriptProperties().setProperty('TABULKA_ID', id);
  console.log('Uloženo TABULKA_ID = ' + id);
}

/** Vloží 1 akci, 1 termín a 1 dokument se stavem „zveřejněno“ (pro test). Spustit jen jednou. */
function vlozitUkazkovaData() {
  const ss = SpreadsheetApp.getActive(), ted = new Date(), ja = Session.getActiveUser().getEmail();
  const pridat = (list, hodnoty) => {
    const sh = ss.getSheetByName(list), h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    sh.appendRow(h.map(k => k in hodnoty ? hodnoty[k] : ''));
  };
  const audit = { 'Vytvořeno': ted, 'Vytvořil': ja };
  pridat('Akce', Object.assign({ ID: 'TEST-A1', 'Název': 'Testovací akce okresu', Typ: 'akce okresu', 'Pořadatel': 'OSH Praha-západ',
    Od: new Date(ted.getFullYear(), ted.getMonth(), ted.getDate() + 14, 9), Do: new Date(ted.getFullYear(), ted.getMonth(), ted.getDate() + 14, 15),
    'Místo': 'Jíloviště', 'Pro koho': 'všechny sbory', Stav: 'zveřejněno' }, audit));
  pridat('Termíny', Object.assign({ ID: 'TEST-T1', 'Název': 'Testovací uzávěrka', Datum: new Date(ted.getFullYear(), ted.getMonth(), ted.getDate() + 7),
    Typ: 'uzávěrka', 'Pro koho': 'všechny sbory', Stav: 'zveřejněno' }, audit));
  pridat('Dokumenty', Object.assign({ ID: 'TEST-D1', 'Orgán': 'VV', Datum: ted, Rok: ted.getFullYear(), 'Název': 'Testovací zápis', Stav: 'zveřejněno' }, audit));
  CacheService.getScriptCache().removeAll(Object.keys(VEREJNE).map(k => 'v_' + k));
  ss.toast('Vloženy 3 testovací řádky (TEST-A1, TEST-T1, TEST-D1).', 'OSH data', 6);
}
