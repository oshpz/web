// Hlasování VV (B19) pro zkušební server návodů: skutečný kód apps-script/VV.gs nad tabulkou v paměti (napodobené služby Apps Script).
// Smyšlení členové VV (example.com). Použití: const vv = require('./vv-mock.cjs'); vv.api(uzivatel, dotaz) → odpověď jako /exec.
const fs = require('fs'), vm = require('vm'), path = require('path'), R = path.join(__dirname, '../../apps-script/');
const listy = {}, soubory = {};
const sheet = (nazev, hlavicka) => {
  const data = [hlavicka.slice()];
  listy[nazev] = { data, getLastRow: () => data.length, getLastColumn: () => data[0].length,
    getRange: (r, c, nr, nc) => ({ getValues: () => data.slice(r - 1, r - 1 + (nr || 1)).map(row => { const x = row.slice(c - 1, c - 1 + (nc || 1)); while (x.length < (nc || 1)) x.push(''); return x; }),
      setValues: v => v.forEach((row, i) => { const t = data[r - 1 + i] || (data[r - 1 + i] = []); row.forEach((x, j) => { t[c - 1 + j] = x; }); }),
      setValue: x => { (data[r - 1] || (data[r - 1] = []))[c - 1] = x; } }),
    getDataRange: () => ({ getValues: () => data.map(r => { const x = r.slice(); while (x.length < data[0].length) x.push(''); return x; }) }),
    appendRow: r => data.push(r.slice()), deleteRow: i => data.splice(i - 1, 1) };
};
const S = { console }; vm.createContext(S); vm.runInContext(fs.readFileSync(R + 'OSH-data-struktura.gs', 'utf8').replace(/^const /gm, 'var '), S);
['Uživatelé', 'VV – Jednání', 'VV – Body', 'VV – Hlasy', 'VV – Podklady', 'VV – Připomínky'].forEach(n => { const L = S.LISTY.find(x => x.nazev === n); sheet(n, L.sloupce.map(s => s[0]).concat(L.audit === false ? [] : S.AUDIT.map(a => a[0]))); });
const U = listy['Uživatelé'], uh = U.data[0];
[['okres@example.com', 'Petra Vzorová', 'zapisovatel'], ['vv@example.com', 'Karel Výborný', 'ANO'], ['jana@example.com', 'Jana Členová', 'ANO'], ['tomas@example.com', 'Tomáš Radní', 'ANO']]
  .forEach(([e, j, v]) => U.data.push(uh.map(k => ({ 'E-mail': e, 'Jméno': j, 'Aktivní': 'ANO', 'VV': v })[k] || '')));
let fid = 0;
const folder = () => ({ getId: () => 'F' + (++fid), getFoldersByName: () => ({ hasNext: () => true, next: () => folder() }), createFolder: () => folder(),
  createFile: b => { const id = 'S' + Object.keys(soubory).length; soubory[id] = b; return { getId: () => id, getName: () => b.name, makeCopy: () => {} }; } });
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
const ctx = { console, Date, Math, JSON, Object, Array, String, Number, RegExp, isNaN, encodeURIComponent,
  SpreadsheetApp: { openById: () => ({ getSheetByName: n => listy[n] || null }), getActive: () => ({ toast() {} }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'X' }) }, CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {}, removeAll() {} }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Utilities: { formatDate: d => new Date(d).toISOString().slice(0, 16), base64Decode: s => Buffer.from(s, 'base64'), base64Encode: b => Buffer.from(b).toString('base64'),
    newBlob: (b, m, n) => ({ name: n, mime: m, getAs: () => ({ name: n, setName(x) { this.name = x; return this; } }), setName(x) { this.name = x; return this; } }) },
  DriveApp: { getFolderById: () => folder(), getFileById: id => ({ getName: () => (soubory[id] || {}).name || 'podklad.pdf', getMimeType: () => 'application/pdf', getBlob: () => ({ getBytes: () => PDF }) }) },
  MailApp: { sendEmail() {} }, ScriptApp: {} };
vm.createContext(ctx);
vm.runInContext(['API.gs', 'Ochrana.gs', 'Posta.gs', 'Dokumenty.gs', 'VV.gs'].map(f => fs.readFileSync(R + f, 'utf8')).join('\n').replace(/^const /gm, 'var '), ctx);
vm.runInContext(`nastaveniWeb_ = k => ({ REZIM: 'TEST', TEST_EMAIL: 'spravci@example.com', WEB_URL: 'http://localhost:18806', DISK_ID: 'D', SLOZKA_ORGANY: 'Orgány OSH PZ', DOMENA: 'example.com' })[k] || '';
  zaznamZmeny_ = () => {}; mer_ = () => {}; normEmail_ = e => String(e || '').trim().toLowerCase(); ano_ = v => v === true || /^(ano|true|1)$/i.test(String(v || '').trim());
  hlavicka_ = sh => sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String); var __o = null; prihlaseny_ = () => __o;`, ctx);
vm.runInContext('vlozitTestyVV()', ctx);
// pár hlasů v otevřeném hlasování, ať jsou vidět počty
[['jana@example.com', 'pro', 'pro'], ['tomas@example.com', 'pro', 'proti']].forEach(([e, a, b]) => { ctx.__o = { email: e, role: { VV: true }, sbory: [] }; vm.runInContext(`apiVV_({ akce: 'vvHlasovat', id: 'VVJTEST-2', hlasy: { 'VVBTEST-2a': '${a}', 'VVBTEST-2b': '${b}' } })`, ctx); });
ctx.__o = { email: 'jana@example.com', role: { VV: true }, sbory: [] }; vm.runInContext(`apiVV_({ akce: 'vvPripominka', id: 'VVJTEST-2', bod: 'VVBTEST-2b', text: 'Prosím o druhou nabídku, ať je s čím srovnat.' })`, ctx);

module.exports = {
  api: (u, q) => { ctx.__o = { email: u.email, jmeno: u.jmeno, role: u.role || {}, sbory: u.sbory || [] }; ctx.__q = q; return vm.runInContext('apiVV_(__q)', ctx); },
  ceka: u => { ctx.__o = { email: u.email, role: u.role || {}, sbory: [] }; return vm.runInContext('vvCekaNaMe_(__o)', ctx); } };
