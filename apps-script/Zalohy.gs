/**
 * OSH data – G2 zálohy a G5 archiv záznamu změn.
 * Nový soubor „Zalohy“ ve stejném projektu.
 *
 * Záloha: každou neděli ve 3:00 kopie celé tabulky + XLSX do složky Nastavení → SLOZKA_ZALOHY na sdíleném disku (DISK_ID).
 *   Název „OSH data RRRRMMDD“. Drží se ZALOHY_TYDNY týdnů (výchozí 12), první záloha každého měsíce 12 měsíců.
 *   Tabulka OSH citlivé (rodná čísla) se nezálohuje – je záměrně jen na jednom místě.
 * Archiv: 1. den v měsíci se záznamy starší než 24 měsíců přesunou z listu „Záznam změn“
 *   do tabulky „OSH záznam změn archiv“ ve stejné složce.
 * Když něco selže, přijde e-mail na spravci@.
 */

const ZALOHA_VZOR = /^OSH data (\d{8})(?:\.xlsx)?$/;
const ARCHIV_NAZEV = 'OSH záznam změn archiv';
const ARCHIV_MESICU = 24, MESICNI_ZALOHY_MESICU = 12;

function slozkaZaloh_() {
  const disk = DriveApp.getFolderById(nastaveniWeb_('DISK_ID'));
  const nazev = nastaveniWeb_('SLOZKA_ZALOHY') || 'Zálohy';
  const it = disk.getFoldersByName(nazev);
  return it.hasNext() ? it.next() : disk.createFolder(nazev);
}

/** Týdenní spouštění (neděle 3:00). Při chybě pošle e-mail a chybu nechá v protokolu provádění. */
function zalohovat() {
  try { return zalohovat_(); }
  catch (err) { hlasitChybu_('Záloha tabulky OSH data selhala', err); throw err; }
}

function zalohovat_() {
  const lock = LockService.getScriptLock(); lock.waitLock(60000);
  try {
    const id = PropertiesService.getScriptProperties().getProperty('TABULKA_ID');
    const slozka = slozkaZaloh_(), den = Utilities.formatDate(new Date(), 'Europe/Prague', 'yyyyMMdd'), nazev = 'OSH data ' + den;
    // dnešní záloha už existuje (např. ruční „Zálohovat teď“) → nahradí se
    [nazev, nazev + '.xlsx'].forEach(n => { const f = slozka.getFilesByName(n); while (f.hasNext()) f.next().setTrashed(true); });
    SpreadsheetApp.flush();
    const kopie = DriveApp.getFileById(id).makeCopy(nazev, slozka);
    const res = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + id + '/export?format=xlsx',
      { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error('Export XLSX vrátil kód ' + res.getResponseCode() + '.');
    slozka.createFile(res.getBlob().setName(nazev + '.xlsx'));
    const smazano = protriditZalohy_(slozka);
    zaznamZmeny_('záloha', 'Zálohy', kopie.getId(), 'vytvořeno', '', nazev + ' (+ XLSX), smazáno starých souborů: ' + smazano);
    console.log('Záloha ' + nazev + ' hotová, smazáno starých souborů: ' + smazano);
    return { nazev: nazev, smazano: smazano };
  } finally { lock.releaseLock(); }
}

/** Smaže zálohy starší než ZALOHY_TYDNY týdnů; první záloha každého měsíce zůstává 12 měsíců. Vrací počet smazaných souborů. */
function protriditZalohy_(slozka) {
  const tydny = Number(nastaveniWeb_('ZALOHY_TYDNY')) || 12, ted = Date.now();
  const soubory = [], prvniVMesici = {};
  const it = slozka.getFiles();
  while (it.hasNext()) {
    const f = it.next(), m = f.getName().match(ZALOHA_VZOR);
    if (!m) continue;
    const den = m[1], ms = den.slice(0, 6);
    soubory.push({ f: f, den: den });
    if (!prvniVMesici[ms] || den < prvniVMesici[ms]) prvniVMesici[ms] = den;
  }
  let n = 0;
  soubory.forEach(({ f, den }) => {
    const stari = (ted - new Date(+den.slice(0, 4), +den.slice(4, 6) - 1, +den.slice(6, 8)).getTime()) / 864e5;
    if (stari <= tydny * 7) return;
    if (prvniVMesici[den.slice(0, 6)] === den && stari <= MESICNI_ZALOHY_MESICU * 31) return;
    f.setTrashed(true); n++;
  });
  return n;
}

function zalohovatTed() {
  try { const r = zalohovat_(); SpreadsheetApp.getActive().toast('Záloha „' + r.nazev + '“ je ve složce Zálohy (i jako XLSX).', 'Zálohy', 8); }
  catch (err) { hlasitChybu_('Ruční záloha tabulky OSH data selhala', err); throw err; }
}

/* ---------- G5: archiv záznamu změn ---------- */

/** 1. den v měsíci: záznamy starší než 24 měsíců → tabulka „OSH záznam změn archiv“. Vrací počet přesunutých řádků. */
function archivovatZaznam() {
  try { return archivovatZaznam_(); }
  catch (err) { hlasitChybu_('Archivace záznamu změn selhala', err); throw err; }
}

function archivovatZaznam_() {
  const lock = LockService.getScriptLock(); lock.waitLock(60000);
  try {
    const sh = dataSs_().getSheetByName('Záznam změn');
    if (sh.getLastRow() < 2) return 0;
    const sloupcu = sh.getLastColumn(), hranice = new Date(); hranice.setMonth(hranice.getMonth() - ARCHIV_MESICU);
    const rng = sh.getRange(2, 1, sh.getLastRow() - 1, sloupcu), v = rng.getValues();
    const stare = v.filter(r => r[0] instanceof Date && r[0] < hranice), zustat = v.filter(r => !(r[0] instanceof Date && r[0] < hranice));
    if (!stare.length) return 0;
    const arch = archivZaznamu_(sh.getRange(1, 1, 1, sloupcu).getValues()[0]).getSheets()[0];
    arch.getRange(arch.getLastRow() + 1, 1, stare.length, sloupcu).setValues(stare);
    SpreadsheetApp.flush();
    // až po úspěšném zápisu do archivu se řádky odeberou ze zdroje
    rng.clearContent();
    if (zustat.length) sh.getRange(2, 1, zustat.length, sloupcu).setValues(zustat);
    zaznamZmeny_('archivace', 'Záznam změn', '', 'smazáno', '', 'přesunuto do archivu: ' + stare.length + ' záznamů starších než ' + ARCHIV_MESICU + ' měsíců');
    console.log('Archivováno ' + stare.length + ' záznamů.');
    return stare.length;
  } finally { lock.releaseLock(); }
}

/** Archivní tabulka ve složce Zálohy; když chybí, založí ji se stejnou hlavičkou. */
function archivZaznamu_(hlavicka) {
  const slozka = slozkaZaloh_(), it = slozka.getFilesByName(ARCHIV_NAZEV);
  if (it.hasNext()) return SpreadsheetApp.openById(it.next().getId());
  const ss = SpreadsheetApp.create(ARCHIV_NAZEV);
  DriveApp.getFileById(ss.getId()).moveTo(slozka);
  ss.getSheets()[0].setName('Záznam změn').getRange(1, 1, 1, hlavicka.length).setValues([hlavicka]).setFontWeight('bold').setBackground('#f3f2f2');
  ss.getSheets()[0].setFrozenRows(1);
  return ss;
}

function archivovatZaznamTed() {
  const n = archivovatZaznam_();
  SpreadsheetApp.getActive().toast(n ? 'Do archivu přesunuto ' + n + ' záznamů.' : 'Nic k archivaci – žádný záznam není starší než ' + ARCHIV_MESICU + ' měsíců.', 'Záznam změn', 8);
}

/* ---------- G5: záznam změn pro aplikaci (jen Správce, jen čtení) ---------- */

function apiZaznam_(req) {
  const o = prihlaseny_(req.token);
  if (!o) return { ok: false, chyba: 'Nepřihlášen', odhlasen: true };
  if (!o.role['Správce']) return { ok: false, chyba: 'Záznam změn vidí jen správce.' };
  const vse = radky_('Záznam změn'), uniq = k => Array.from(new Set(vse.map(r => String(r[k] || '')).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'cs'));
  const data = vse.filter(r => (!req.list || String(r['List'] || '') === req.list) && (!req.uzivatel || String(r['Uživatel'] || '') === req.uzivatel))
    .slice(-200).reverse()
    .map(r => ({ cas: r['Čas'] instanceof Date ? r['Čas'].toISOString() : String(r['Čas'] || ''), uzivatel: String(r['Uživatel'] || ''), list: String(r['List'] || ''),
      id: String(r['ID'] || ''), akce: String(r['Akce'] || ''), pred: String(r['Před'] || ''), po: String(r['Po'] || '') }));
  return { ok: true, data: data, listy: uniq('List'), uzivatele: uniq('Uživatel'), celkem: vse.length };
}

/* ---------- pomocné ---------- */

function hlasitChybu_(predmet, err) {
  console.error(err);
  try {
    posta_('spravci@' + (nastaveniWeb_('DOMENA') || 'oshpz.cz'), predmet,
      'Dobrý den,\n\n' + predmet.toLowerCase() + ' (' + Utilities.formatDate(new Date(), 'Europe/Prague', 'd. M. yyyy H:mm') + ').\n\nChyba: ' +
      (err && err.message ? err.message : err) + '\n\nPodrobnosti jsou v Apps Script → Spuštění. Zálohu lze zopakovat z menu OSH data → Zálohovat teď.\n\nOSH Praha-západ');
  } catch (e) { console.error('Nepodařilo se poslat e-mail o chybě: ' + e); }
}
