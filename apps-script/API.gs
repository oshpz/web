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
    if (co === 'sbory') return json_({ ok: true, data: sboryVerejne_() }, p.callback);
    if (co === 'organy') return json_({ ok: true, data: organyVerejne_() }, p.callback);
    if (co === 'clanek') { const cl = prClanekVerejny_(p.a); return json_(cl ? { ok: true, data: cl } : { ok: false, chyba: 'Příspěvek nenalezen.' }, p.callback); }
    // vše pro veřejný web jedním dotazem (jedno spuštění místo pěti – méně čekání a méně výpadků Googlu)
    if (co === 'web') {
      const z = CacheService.getScriptCache().get('v_web');
      return z ? ContentService.createTextOutput(p.callback && /^[\w.]+$/.test(p.callback) ? p.callback + '({"ok":true,"data":' + z + '})' : '{"ok":true,"data":' + z + '}')
          .setMimeType(p.callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON)
        : json_({ ok: true, data: obnovitWebData() }, p.callback);
    }
    return json_({ ok: false, chyba: 'Neznámý požadavek: ' + co }, p.callback);
  } catch (err) {
    console.error(err);
    return json_({ ok: false, chyba: 'Chyba serveru' }, p.callback);
  }
}

/**
 * Data pro veřejný web předem do mezipaměti (časovač každých 5 minut, nastavitSpousteni).
 * Dotaz webu ?co=web je pak jen čtení z mezipaměti (1–2 s) a server se mezi návštěvami „neuspí“.
 * Po změně v tabulce se mezipaměť smaže (vycistitCache_) a nejbližší dotaz nebo časovač ji sestaví znovu.
 */
function obnovitWebData(e) {
  CacheService.getScriptCache().removeAll(['v_akce', 'v_terminy', 'v_dokumenty', 'v_sbory', 'v_organy', 'v_prispevky']);
  let prispevky = [];
  try { prispevky = prispevkyVerejne_(); } catch (e) { console.error('Příspěvky pro web: ' + e.message); }
  let prihlasky = false; try { prihlasky = prihlaskyZapnute_(); } catch (e) {}
  const data = { akce: cistVerejne_('akce', {}), terminy: cistVerejne_('terminy', {}), dokumenty: cistVerejne_('dokumenty', {}), sbory: sboryVerejne_(), organy: organyVerejne_(), prispevky: prispevky, prihlasky: prihlasky };
  try { CacheService.getScriptCache().put('v_web', JSON.stringify(data), 900); } catch (e) { console.error(e); }
  // jen z časovače (ne z dotazu webu – ten nesmí čekat na GitHub): statická kopie data/web.json do repozitáře
  if (e && e.triggerUid) { try { const r = publikovatStatickaData_(data); if (r !== 'beze změny') console.log('Statická data webu: ' + r); } catch (x) { console.error('Statická data webu: ' + x.message); } }
  return data;
}

/* ---------- statická data pro web (data/web.json v repozitáři) ----------
 * Web si je načte ze své domény hned (bez čekání na Apps Script), potom vždy načte živá data (?co=web).
 * Repozitář je veřejný a git si pamatuje každou verzi – proto BEZ osobních údajů: orgány jen jména (bez telefonu a e-mailu),
 * sbory bez vedoucích MH. Ty doplní až živá data. Zápis jen při změně obsahu (otisk ve Vlastnostech skriptu).
 * Potřebuje Vlastnost skriptu GITHUB_TOKEN (fine-grained token jen pro repozitář, oprávnění Contents: Read and write). */
const GH_SOUBOR = 'data/web.json'; // repozitář a větev z Nastavení: GITHUB_REPO (test oshpz/web, ostrý oshpz/web-ostry), GITHUB_VETEV

function statickaDataWebu_(d) {
  return { akce: d.akce || [], terminy: d.terminy || [], dokumenty: d.dokumenty || [], prispevky: d.prispevky || [], prihlasky: !!d.prihlasky,
    sbory: (d.sbory || []).map(x => ({ sbor: x.sbor, okrsek: x.okrsek, mh: x.mh, jsdh: x.jsdh, sport: x.sport, web: x.web, prihlaska: x.prihlaska || null })),
    organy: (d.organy || []).map(x => ({ organ: x.organ, poradi: x.poradi, funkce: x.funkce, jmeno: x.jmeno, sbor: x.sbor, tel: '', email: '', pozn: x.pozn })) };
}

function publikovatStatickaData_(data) {
  const p = PropertiesService.getScriptProperties(), token = p.getProperty('GITHUB_TOKEN');
  if (!token) return 'vypnuto (chybí GITHUB_TOKEN)';
  const obsah = statickaDataWebu_(data), text = JSON.stringify(obsah), otisk = otisk_(text);
  if (p.getProperty('GH_WEB_OTISK') === otisk) return 'beze změny';
  // do doplnění klíče (Založit / doplnit strukturu) test zapisuje dál do oshpz/web jako dřív
  const repo = nastaveniWeb_('GITHUB_REPO') || (nastaveniWeb_('REZIM') === 'TEST' ? 'oshpz/web' : ''), vetev = nastaveniWeb_('GITHUB_VETEV') || 'main';
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return 'vypnuto (chybí GITHUB_REPO v Nastavení)';
  const url = 'https://api.github.com/repos/' + repo + '/contents/' + GH_SOUBOR;
  const hl = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const ex = UrlFetchApp.fetch(url + '?ref=' + vetev, { headers: hl, muteHttpExceptions: true });
  const sha = ex.getResponseCode() === 200 ? JSON.parse(ex.getContentText()).sha : undefined;
  const res = UrlFetchApp.fetch(url, { method: 'put', headers: hl, contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ message: 'Data webu (automaticky z OSH data)', branch: vetev, sha: sha,
      content: Utilities.base64Encode(Utilities.newBlob(JSON.stringify(Object.assign({ vytvoreno: new Date().toISOString() }, obsah))).getBytes()),
      committer: { name: 'OSH data', email: 'spravci@' + (nastaveniWeb_('DOMENA') || 'oshpz.cz') } }) });
  if (res.getResponseCode() >= 300) throw new Error('GitHub ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
  p.setProperty('GH_WEB_OTISK', otisk);
  return 'zapsáno';
}

/** Ruční spuštění (Apps Script → vybrat funkci → Spustit): zapíše statická data hned, i bez změny. */
function publikovatStatickaDataTed() {
  PropertiesService.getScriptProperties().deleteProperty('GH_WEB_OTISK');
  console.log('Statická data webu: ' + publikovatStatickaData_(obnovitWebData()));
}

/** Veřejné vlastnosti sborů pro web (zdroj pravdy = list Sbory). Bez kontaktů a čísel účtů; web sboru jen http(s). 5 min v mezipaměti.
 *  vedouciMH = jen jména (bez kontaktu) z listu Kontakty sborů – schválené údaje (formulář B11 po kontrole, změny B16 po schválení okresem).
 *  Vedoucí MH je podle stanov členem výboru; vyplněním formuláře sbor souhlasí s uvedením výboru na webu. */
function sboryVerejne_() {
  const c = CacheService.getScriptCache(), z = c.get('v_sbory');
  if (z) return JSON.parse(z);
  const ved = {};
  try {
    radky_('Kontakty sborů').filter(r => String(r['Aktivní']).trim().toUpperCase() !== 'NE' && /vedoucí mladých hasičů/i.test(String(r['Funkce'] || '')) && String(r['Jméno'] || '').trim())
      .forEach(r => { const k = String(r['Skupina'] || '').split('@')[0].toLowerCase(), j = String(r['Jméno']).trim(); if (k && (ved[k] = ved[k] || []).indexOf(j) < 0) ved[k].push(j); });
  } catch (e) { console.error('Vedoucí MH pro web: ' + e.message); }
  const data = radky_('Sbory').filter(r => r['Sbor'] && String(r['Aktivní']).trim().toUpperCase() !== 'NE')
    .map(r => { const web = String(r['Web'] || '').trim();
      return { sbor: String(r['Sbor']).trim(), okrsek: r['Okrsek'] === '' ? '' : Number(r['Okrsek']), mh: ano_(r['MH']), jsdh: ano_(r['JSDH']), sport: ano_(r['Sport']),
        web: /^https?:\/\/[^\s<>"']{3,300}$/i.test(web) ? web : '', vedouciMH: ved[String(r['Skupina'] || '').split('@')[0].toLowerCase()] || [],
        prihlaska: (() => { try { const n = prhNastaveniSboru_(r); return { prispevekDospely: n.prispevekDospely, prispevekMH: n.prispevekMH, mhSportovec: n.mhSportovec, regCislo: n.regCislo }; } catch (e) { return null; } })() }; });
  try { c.put('v_sbory', JSON.stringify(data), 300); } catch (e) {}
  return data;
}

// doPost je v souboru Prihlaseni (díl 2). Web volá POST s Content-Type text/plain (kvůli CORS).

function cistVerejne_(co, p) {
  const def = VEREJNE[co];
  const cache = CacheService.getScriptCache(), klic = 'v_' + co;
  let rows = JSON.parse(cache.get(klic) || 'null');
  if (!rows) {
    rows = radky_(def.list)
      .filter(r => r['Stav'] === 'zveřejněno' && smiVidet_(null, r)) // veřejnost: jen „veřejnost“ a prázdné (Portal.gs)
      .map(r => def.pole.reduce((o, k) => (o[k] = r[k] instanceof Date ? r[k].toISOString() : r[k], o), {}));
    cache.put(klic, JSON.stringify(rows), 300); // 5 minut – web je rychlý, tabulka se nezatěžuje
  }
  if (p.organ) rows = rows.filter(r => r['Orgán'] === p.organ);
  if (p.rok) rows = rows.filter(r => String(r['Rok'] || String(r['Datum'] || r['Od'] || '').slice(0, 4)) === String(p.rok));
  return rows;
}

/* ---------- rychlost: tabulka se otevře jednou za požadavek, nastavení a malé listy se drží v mezipaměti ---------- */
// Proměnné žijí jen po dobu jednoho spuštění (jednoho požadavku z webu), mezi požadavky je drží CacheService.
let _ss = null, _nast = null;
const CACHE_NAST_S = 300, CACHE_LISTY_S = 120, LISTY_V_MEZIPAMETI = ['Uživatelé', 'Sbory'];

function dataSs_() { return _ss || (_ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('TABULKA_ID'))); }

/** Uživatelé a Sbory (oprávnění při každém požadavku): 2 minuty v mezipaměti, ruční úprava listu ji hned smaže (priUprave). */
function radkyRychle_(nazevListu) {
  if (LISTY_V_MEZIPAMETI.indexOf(nazevListu) < 0) return radky_(nazevListu);
  const c = CacheService.getScriptCache(), klic = 'tab_' + nazevListu, z = c.get(klic);
  if (z) return JSON.parse(z);
  const rows = radky_(nazevListu);
  try { c.put(klic, JSON.stringify(rows), CACHE_LISTY_S); } catch (e) {} // nad 100 kB se neuloží, jen se příště přečte znovu
  return rows;
}

/** Smaže mezipaměť po změně v tabulce (volá priUprave a zápisy z aplikace). */
function vycistitMezipamet_(list) {
  const c = CacheService.getScriptCache();
  if (list === 'Nastavení') { c.remove('nastaveni'); _nast = null; }
  if (LISTY_V_MEZIPAMETI.indexOf(list) >= 0) c.remove('tab_' + list);
}

function radky_(nazevListu) {
  const sh = dataSs_().getSheetByName(nazevListu);
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
// Celý list Nastavení se načte jednou (5 min v mezipaměti, úprava listu ji smaže) – dřív se tabulka otevírala u každého klíče.
function nastaveniWeb_(klic) {
  if (!_nast) {
    const c = CacheService.getScriptCache(), z = c.get('nastaveni');
    if (z) _nast = JSON.parse(z);
    else {
      const sh = dataSs_().getSheetByName('Nastavení');
      _nast = {};
      sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 2).getValues().forEach(x => { if (x[0]) _nast[String(x[0])] = String(x[1]); });
      try { c.put('nastaveni', JSON.stringify(_nast), CACHE_NAST_S); } catch (e) {}
    }
  }
  return _nast[klic] || '';
}

/** Uloží ID tabulky, aby ji web našel (zalozitStrukturu to dělá samo; ruční spuštění jen pro jistotu). */
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
