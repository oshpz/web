/**
 * OSH data TEST – založení struktury tabulky (B1).
 * Vložte do tabulky „OSH data TEST“ (Rozšíření → Apps Script) a spusťte funkci zalozitStrukturu.
 * Je bezpečné spouštět opakovaně: chybějící listy a sloupce doplní, existující data nemaže ani nepřepisuje.
 */

const ANO_NE = ['ANO', 'NE'];
const PRO_KOHO = ['všechny sbory', 'sbory s MH', 'sbory s JSDH', 'sbory se sportem', 'okrsek', 'veřejnost', 'jen okres'];
const AUDIT = [['Vytvořeno', 'datetime'], ['Vytvořil', 'email'], ['Upraveno', 'datetime'], ['Upravil', 'email']];

const LISTY = [
  { nazev: 'Nastavení', audit: false, barva: '#201e1d', sloupce: [
    ['Klíč', 'text', 'Název nastavení. Neměnit, čte ho skript.'], ['Hodnota', 'text'], ['Popis', 'text']] },

  { nazev: 'Uživatelé', barva: '#ec3013', sloupce: [
    ['E-mail', 'email', 'Přihlašovací e-mail (oshpz.cz i osobní).'], ['Jméno', 'text'], ['Aktivní', ANO_NE],
    ['Dokumenty', ANO_NE, 'Schvaluje zveřejnění dokumentů z Disku.'], ['Termíny', ANO_NE, 'Přidává termíny a akce okresu.'],
    ['Akce', ANO_NE, 'Schvaluje žádosti sborů o pořádání.'], ['Soutěže', ['', 'všechny', 'MH', 'dospělí'], 'Propozice, přihlášky, výsledky.'],
    ['Majetek', ANO_NE, 'Potvrzuje výpůjčky a vrácení.'], ['Přihlášky', ANO_NE, 'Kontroluje členské přihlášky a skeny.'],
    ['Příspěvky', ['', 'zveřejnit', 'navrhnout'], 'zveřejnit = publikuje rovnou, navrhnout = posílá ke schválení.'],
    ['Sbory', ANO_NE, 'Upravuje údaje a vlastnosti sborů.'], ['Správce', ANO_NE, 'Smí vše včetně listu Uživatelé.'], ['Poznámka', 'text']] },

  { nazev: 'Sbory', barva: '#3b5bdb', sloupce: [
    ['Sbor', 'text'], ['Skupina', 'text', 'Adresa skupiny bez domény, např. sdh-cisovice.'], ['Okrsek', 'int'],
    ['MH', ANO_NE], ['JSDH', ANO_NE], ['Sport', ANO_NE], ['Aktivní', ANO_NE],
    ['IČO', 'text'], ['Číslo účtu', 'text', 'Pro QR platbu členských příspěvků.'], ['Web', 'text'],
    ['Kontakty', 'text', 'Osobní e-maily do sborové skupiny, oddělené čárkou.'], ['Poznámka', 'text']] },

  { nazev: 'Akce', barva: '#201e1d', sloupce: [
    ['ID', 'text'], ['Název', 'text'], ['Typ', ['akce okresu', 'akce sboru', 'soutěž', 'školení', 'jednání']], ['Pořadatel', 'text'],
    ['Od', 'datetime'], ['Do', 'datetime'], ['Místo', 'text'], ['Pro koho', PRO_KOHO], ['Okrsek', 'int'],
    ['Popis', 'text'], ['Odkaz', 'text'], ['Stav', ['koncept', 'ke schválení', 'zveřejněno', 'zrušeno']],
    ['Kalendář – událost', 'text', 'ID události v Google Kalendáři. Vyplňuje skript.'],
    ['Připomenout (dny předem)', 'text', 'Např. 14,3. Prázdné = výchozí z Nastavení.'],
    ['Oznámeno', 'text', 'Kdy šlo oznámení sborům. Smažte, má-li se poslat znovu.'], ['Připomenuto', 'text', 'Které připomínky už odešly. Vyplňuje skript.']] },

  { nazev: 'Termíny', barva: '#201e1d', sloupce: [
    ['ID', 'text'], ['Název', 'text'], ['Datum', 'date'], ['Typ', ['uzávěrka', 'termín', 'jednání', 'jiné']],
    ['Pořadatel', 'text', 'Kdo termín vyhlašuje (zkratka orgánu, např. VV).'], ['Pro koho', PRO_KOHO], ['Okrsek', 'int'], ['Popis', 'text'], ['Připomenout (dny předem)', 'text', 'Např. 14,3'],
    ['Stav', ['koncept', 'zveřejněno', 'zrušeno']], ['Kalendář – událost', 'text'],
    ['Oznámeno', 'text', 'Kdy šlo oznámení sborům. Smažte, má-li se poslat znovu.'], ['Připomenuto', 'text', 'Které připomínky už odešly. Vyplňuje skript.']] },

  { nazev: 'Dokumenty', barva: '#201e1d', sloupce: [
    ['ID', 'text'], ['Soubor – ID', 'text', 'ID souboru na Disku. Vyplňuje skript.'], ['Název souboru', 'text'],
    ['Orgán', ['VV', 'OKRR', 'OORM', 'OORS', 'OORB', 'OORV', 'OSP']], ['Datum', 'date'], ['Rok', 'int'], ['Název', 'text'],
    ['Stav', ['ke schválení', 'zveřejněno', 'zamítnuto', 'staženo']], ['Upozornění', 'text', 'Co skript nerozpoznal (název, datum…).'],
    ['Schválil', 'email'], ['Schváleno', 'datetime'], ['Veřejný odkaz', 'text', 'Odkaz na soubor. U neveřejných dokumentů funguje jen pro skupinu podle Pro koho.'],
    ['Pro koho', PRO_KOHO, 'Kdo dokument uvidí. Prázdné = veřejnost. Změna u zveřejněného dokumentu hned upraví sdílení.'], ['Okrsek', 'int', 'Jen u Pro koho = okrsek.']] },

  { nazev: 'Žádosti', barva: '#201e1d', sloupce: [
    ['ID', 'text'], ['Sbor', 'text'], ['Typ', ['pořádání soutěže', 'pořádání akce', 'jiné']], ['Název', 'text'],
    ['Datum', 'date'], ['Místo', 'text'], ['Vybavení', 'text', 'ID majetku oddělená čárkou.'], ['Přílohy – složka', 'text'],
    ['Stav', ['podáno', 'schváleno', 'zamítnuto', 'staženo']], ['Vyřídil', 'email'], ['Vyřízeno', 'datetime'], ['Poznámka', 'text']] },

  { nazev: 'Přihlášky družstev', barva: '#201e1d', sloupce: [
    ['ID', 'text'], ['Akce – ID', 'text'], ['Sbor', 'text'], ['Kategorie', 'text'], ['Družstvo', 'text'],
    ['Členové', 'text', 'Jména oddělená čárkou.'], ['Kontakt', 'email'], ['Stav', ['přihlášeno', 'potvrzeno', 'odhlášeno']]] },

  { nazev: 'Výsledky', barva: '#201e1d', sloupce: [
    ['ID', 'text'], ['Akce – ID', 'text'], ['Kategorie', 'text'], ['Disciplína', 'text'], ['Sbor', 'text'], ['Družstvo', 'text'],
    ['Čas (s)', 'number'], ['Trestné body', 'number'], ['Výsledek', 'number', 'Čas nebo body po započtení trestných.'],
    ['Pořadí', 'int'], ['Rozhodčí', 'text'], ['Stav', ['zapsáno', 'ověřeno', 'zveřejněno']]] },

  { nazev: 'Majetek', barva: '#201e1d', sloupce: [
    ['ID', 'text'], ['Název', 'text'], ['Kategorie', 'text'], ['Počet', 'int'], ['Umístění', 'text'],
    ['Stav', ['k dispozici', 'vypůjčeno', 'v opravě', 'vyřazeno']], ['Kauce (Kč)', 'number'], ['Foto – ID', 'text'], ['Poznámka', 'text']] },

  { nazev: 'Rezervace', barva: '#201e1d', sloupce: [
    ['ID', 'text'], ['Majetek – ID', 'text'], ['Sbor', 'text'], ['Od', 'date'], ['Do', 'date'], ['Účel', 'text'],
    ['Stav', ['žádost', 'potvrzeno', 'vydáno', 'vráceno', 'zamítnuto']], ['Potvrdil', 'email'], ['Stav po vrácení', 'text'], ['Poznámka', 'text']] },

  { nazev: 'Členské přihlášky', barva: '#ec3013', sloupce: [
    ['ID', 'text'], ['Sbor', 'text'], ['Jméno', 'text'], ['Příjmení', 'text'], ['Datum narození', 'date'],
    ['Kategorie', ['dospělý', 'mladý hasič']], ['E-mail', 'email'], ['Telefon', 'text'], ['Zákonný zástupce', 'text'],
    ['PDF – ID', 'text', 'Vyplněná přihláška. Rodné číslo je v samostatné tabulce OSH citlivé (podle ID).'], ['Sken – ID', 'text'],
    ['Variabilní symbol', 'text'], ['Zaplaceno', 'date'],
    ['Stav', ['odesláno', 'podepsáno', 'schváleno sborem', 'zaplaceno', 'sken u okresu', 'zapsáno', 'zamítnuto']], ['Poznámka', 'text']] },

  { nazev: 'Příspěvky', barva: '#201e1d', sloupce: [
    ['ID', 'text'], ['Titulek', 'text'], ['Perex', 'text'], ['Text', 'text'], ['Fotky – složka', 'text'], ['Přílohy', 'text'],
    ['Autor', 'email'], ['Zdroj', ['aplikace', 'e-mail']], ['Stav', ['koncept', 'ke schválení', 'zveřejněno', 'staženo']],
    ['Zveřejněno', 'datetime'], ['Odkaz', 'text']] },

  { nazev: 'Záznam změn', audit: false, barva: '#868e96', sloupce: [
    ['Čas', 'datetime'], ['Uživatel', 'email'], ['List', 'text'], ['ID', 'text'], ['Akce', ['vytvořeno', 'upraveno', 'smazáno', 'schváleno', 'zamítnuto', 'přihlášení']],
    ['Před', 'text'], ['Po', 'text']] }
];

const NASTAVENI = [
  ['REZIM', 'TEST', 'TEST = všechny e-maily jdou jen na TEST_EMAIL. OSTRY = skutečným adresátům.'],
  ['TEST_EMAIL', 'spravci@oshpz.cz', 'Kam chodí všechny e-maily v testovacím režimu.'],
  ['DOMENA', 'oshpz.cz', ''],
  ['ODESILATEL', 'aplikace@oshpz.cz', 'Adresa, ze které odchází pošta.'],
  ['DISK_ID', '0ANaj4Bv5hwLBUk9PVA', 'Sdílený disk OSHPZ – TEST.'],
  ['SLOZKA_ORGANY', 'Orgány OSH PZ', 'Složka s podsložkami orgánů.'],
  ['KALENDAR_ID', 'c_fc2074828901426d752a8489df57f1a88ce228719f9d4db3cc78a4c79ef65cee@group.calendar.google.com', 'Kalendář OSHPZ – TEST.'],
  ['WEB_URL', 'https://test.oshpz.cz', ''],
  ['PRIPOMINKY_DNY', '14,3', 'Výchozí připomínky termínů.'],
  ['TABULKA_ID', '1efB7L11PVpybZi_j-YILtJ_U3sCP58ESg3eKqKJP0Tg', 'Tato tabulka (OSH data TEST).'],
  ['CITLIVE_ID', '', 'Tabulka OSH citlivé. Vyplní funkce zalozitCitlivou.'],
  ['RC_SMAZAT_PO_DNECH', '30', 'Kolik dní po zápisu do evidence SH ČMS se rodné číslo smaže.'],
  ['POJMENOVANI', 'ZKRATKA RRRRMMDD Název | ZKRATKA RRRR Název', 'Pravidlo názvů dokumentů.'],
  ['SLOZKA_ZALOHY', 'Zálohy', 'Složka na sdíleném disku (DISK_ID) pro týdenní zálohy a archiv záznamu změn. Skript ji založí.'],
  ['ZALOHY_TYDNY', '12', 'Kolik týdnů se drží týdenní zálohy. První záloha každého měsíce zůstává 12 měsíců.'],
  ['TURNSTILE_SITEKEY', '', 'Veřejný klíč Cloudflare Turnstile (site key). Tajný klíč patří jen do Vlastností skriptu jako TURNSTILE_SECRET.'],
  ['TURNSTILE_DOMENY', '', 'Domény, ze kterých smí přijít ověření (čárkou). Prázdné = doména z WEB_URL.']
];

function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('OSH data').addItem('Založit / doplnit strukturu', 'zalozitStrukturu')
      .addItem('Založit tabulku OSH citlivé', 'zalozitCitlivou')
      .addSeparator()
      .addItem('Dokumenty: zkontrolovat Disk teď', 'kontrolaDokumentuTed')
      .addItem('Dokumenty: zveřejnit označené', 'zverejnitVybrane')
      .addItem('Dokumenty: zamítnout označené', 'zamitnoutVybrane')
      .addItem('Dokumenty: stáhnout z webu označené', 'stahnoutVybrane')
      .addSeparator()
      .addItem('Kalendář: synchronizovat teď', 'synchronizovatKalendarTed')
      .addItem('Skupiny: načíst členství sborů teď', 'obnovitClenstviTed')
      .addSeparator()
      .addItem('E-maily: náhled pro označený řádek', 'nahledEmailu')
      .addItem('E-maily: poslat oznámení teď', 'poslatOznameniTed')
      .addItem('E-maily: poslat připomínky teď', 'poslatPripominkyTed')
      .addSeparator()
      .addItem('Zálohovat teď', 'zalohovatTed')
      .addItem('Záznam změn: archivovat starší než 24 měsíců', 'archivovatZaznamTed').addToUi();
  } catch (e) {}
}

function zalozitStrukturu() {
  const ss = SpreadsheetApp.getActive();
  if (!ss) throw new Error('Skript musí být vložený v tabulce (Rozšíření → Apps Script).');
  const hlaseni = [];
  LISTY.forEach((L, i) => {
    let sh = ss.getSheetByName(L.nazev);
    if (!sh) { sh = ss.insertSheet(L.nazev, i); hlaseni.push('+ list ' + L.nazev); }
    const cols = L.sloupce.concat(L.audit === false ? [] : AUDIT);
    const maxCol = Math.max(sh.getLastColumn(), 1);
    const hlavicka = sh.getRange(1, 1, 1, maxCol).getValues()[0].map(String);
    cols.forEach(([nazev, typ, pozn]) => {
      let c = hlavicka.indexOf(nazev) + 1;
      if (!c) {
        c = hlavicka.filter(x => x).length + 1;
        if (c > sh.getMaxColumns()) sh.insertColumnAfter(sh.getMaxColumns());
        sh.getRange(1, c).setValue(nazev);
        hlavicka[c - 1] = nazev;
        hlaseni.push('+ ' + L.nazev + ' › ' + nazev);
      }
      const hdr = sh.getRange(1, c);
      if (pozn) hdr.setNote(pozn);
      const telo = sh.getRange(2, c, sh.getMaxRows() - 1, 1);
      if (Array.isArray(typ)) {
        telo.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(typ.filter(x => x), true).setAllowInvalid(false).build());
      } else if (typ === 'date') {
        telo.setNumberFormat('d. m. yyyy');
      } else if (typ === 'datetime') {
        telo.setNumberFormat('d. m. yyyy H:mm');
      } else if (typ === 'int') {
        telo.setNumberFormat('0');
      } else if (typ === 'number') {
        telo.setNumberFormat('0.00');
      } else {
        telo.setNumberFormat('@'); // text: zachová úvodní nuly (IČO, čísla účtů, VS)
      }
    });
    const n = hlavicka.filter(x => x).length;
    sh.getRange(1, 1, 1, n).setFontWeight('bold').setBackground('#f3f2f2').setBorder(false, false, true, false, false, false, '#201e1d', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    sh.setFrozenRows(1);
    if (sh.getRange(1, 1).getValue() === 'ID' || L.nazev === 'Sbory' || L.nazev === 'Uživatelé') sh.setFrozenColumns(Math.min(2, n));
    sh.setTabColor(L.barva);
    for (let c = 1; c <= n; c++) if (sh.getColumnWidth(c) < 120) sh.setColumnWidth(c, 140);
    if (!sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).some(p => p.getDescription() === 'Hlavička')) {
      sh.getRange(1, 1, 1, n).protect().setDescription('Hlavička').setWarningOnly(true);
    }
  });

  const nast = ss.getSheetByName('Nastavení');
  const klice = nast.getLastRow() > 1 ? nast.getRange(2, 1, nast.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
  NASTAVENI.forEach(r => { if (klice.indexOf(r[0]) < 0) { nast.appendRow(r); hlaseni.push('+ nastavení ' + r[0]); } });
  nast.setColumnWidth(2, 420); nast.setColumnWidth(3, 420);

  const prazdny = ss.getSheetByName('List 1') || ss.getSheetByName('List1') || ss.getSheetByName('Sheet1');
  if (prazdny && prazdny.getLastRow() === 0 && ss.getSheets().length > 1) { ss.deleteSheet(prazdny); hlaseni.push('− prázdný List 1'); }

  ['Nastavení', 'Uživatelé', 'Sbory'].forEach(vycistitMezipamet_); // nové klíče a sloupce platí hned i pro web
  const text = hlaseni.length ? hlaseni.length + ' změn' : 'Struktura už je úplná, nic se neměnilo.';
  console.log(hlaseni.join('\n') || text);
  try { ss.toast(text, 'OSH data', 8); } catch (e) {}
}

/* ---------- OSH citlivé: rodná čísla mimo hlavní tabulku ---------- */

const CITLIVE_SLOUPCE = [
  ['ID přihlášky', 'text', 'Stejné ID jako v listu Členské přihlášky.'], ['Sbor', 'text'], ['Jméno', 'text'], ['Příjmení', 'text'],
  ['Rodné číslo', 'text', 'Bez lomítka nebo s lomítkem, jako text.'], ['Zapsáno do evidence', 'date', 'Den zápisu do evidence SH ČMS.'],
  ['Zapsal', 'email'], ['Smazáno', 'datetime', 'Kdy skript rodné číslo vymazal.']
];

function nastaveni_(klic, hodnota) {
  const sh = SpreadsheetApp.getActive().getSheetByName('Nastavení');
  const data = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 2).getValues();
  const i = data.findIndex(r => r[0] === klic);
  if (hodnota === undefined) return i < 0 ? '' : String(data[i][1]);
  if (i < 0) sh.appendRow([klic, hodnota]); else sh.getRange(i + 2, 2).setValue(hodnota);
  vycistitMezipamet_('Nastavení');
}

function zalozitCitlivou() {
  let id = nastaveni_('CITLIVE_ID');
  let ss;
  if (id) { ss = SpreadsheetApp.openById(id); }
  else {
    // Vznikne na „Můj disk“ toho, kdo skript spouští – NE na sdíleném disku, kam vidí všichni jeho členové.
    ss = SpreadsheetApp.create('OSH citlivé TEST');
    id = ss.getId();
    nastaveni_('CITLIVE_ID', id);
    const odesilatel = nastaveni_('ODESILATEL');
    if (odesilatel) DriveApp.getFileById(id).addEditor(odesilatel);
  }
  const sh = ss.getSheets()[0].setName('Rodná čísla');
  sh.getRange(1, 1, 1, CITLIVE_SLOUPCE.length).setValues([CITLIVE_SLOUPCE.map(c => c[0])])
    .setFontWeight('bold').setBackground('#f3f2f2');
  CITLIVE_SLOUPCE.forEach(([n, typ, pozn], i) => {
    const c = i + 1, telo = sh.getRange(2, c, sh.getMaxRows() - 1, 1);
    if (pozn) sh.getRange(1, c).setNote(pozn);
    telo.setNumberFormat(typ === 'date' ? 'd. m. yyyy' : typ === 'datetime' ? 'd. m. yyyy H:mm' : '@');
    sh.setColumnWidth(c, 150);
  });
  sh.setFrozenRows(1); sh.setTabColor('#ec3013');
  const f = DriveApp.getFileById(id);
  f.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
  try { f.setShareableByEditors(false); } catch (e) {}
  const text = 'OSH citlivé: ' + ss.getUrl();
  console.log(text);
  try { SpreadsheetApp.getActive().toast('Tabulka OSH citlivé je připravená. ID je v listu Nastavení.', 'OSH data', 8); } catch (e) {}
}

/** Smaže rodná čísla N dní po zápisu do evidence. B2 ho nastaví ke spouštění každou noc. */
function smazatZapsanaRC() {
  const id = nastaveni_('CITLIVE_ID'); if (!id) return;
  const dny = Number(nastaveni_('RC_SMAZAT_PO_DNECH') || 30);
  const sh = SpreadsheetApp.openById(id).getSheetByName('Rodná čísla');
  if (sh.getLastRow() < 2) return;
  const r = sh.getRange(2, 1, sh.getLastRow() - 1, CITLIVE_SLOUPCE.length), v = r.getValues();
  const hranice = Date.now() - dny * 864e5;
  let n = 0;
  v.forEach(row => { if (row[4] && row[5] instanceof Date && row[5].getTime() < hranice) { row[4] = ''; row[7] = new Date(); n++; } });
  if (n) { r.setValues(v); zaznamZmeny_('noční údržba', 'OSH citlivé', '', 'smazáno', '', 'rodná čísla po zápisu do evidence: ' + n); }
  console.log('Smazáno rodných čísel: ' + n);
}
