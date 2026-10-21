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
    ['Kontakty', 'text', 'Osobní e-maily do sborové skupiny, oddělené čárkou.'], ['Poznámka', 'text'],
    ['Příspěvek dospělý', 'int', 'Roční členský příspěvek dospělého (Kč) – QR platba u přihlášek. Nastavuje sbor v portálu (Přihlášky členů → Nastavení). Prázdné = PRISPEVEK_DOSPELY z Nastavení.'],
    ['Příspěvek MH', 'int', 'Roční příspěvek mladého hasiče (Kč). Prázdné = PRISPEVEK_MH z Nastavení.'],
    ['MH jako sportovec', ANO_NE, 'Výchozí volba „evidovat jako sportovce“ u mladých hasičů – předvyplní se sboru při přijetí žádosti.'], ['Dospělý jako sportovec', ANO_NE, 'Totéž u dospělých.'],
    ['Registrační číslo', 'text', 'Pevné registrační číslo sboru v SH ČMS – vyplní okres. Tiskne se do přihlášky člena (políčko Evidenční číslo vedle názvu sboru); bez něj přihlášky sboru nejdou odeslat.']] },

  { nazev: 'Kontakty sborů', barva: '#3b5bdb', sloupce: [
    ['Sbor', 'text'], ['Skupina', 'text', 'Adresa skupiny bez domény, např. sdh-cisovice.'], ['Jméno', 'text'], ['Funkce', 'text', 'Starosta, Velitel sboru, Jednatel, Pokladník, Velitel jednotky (JSDH), Vedoucí mladých hasičů…'],
    ['E-mail', 'email'], ['Aktivní', ANO_NE, 'NE = už ve sboru nepůsobí (odebrán ze skupiny).'], ['Zdroj', ['formulář', 'aplikace', 'ručně']], ['Poznámka', 'text']] },

  { nazev: 'Změny sborů', barva: '#3b5bdb', sloupce: [
    ['ID', 'text'], ['Sbor', 'text'], ['Skupina', 'text'], ['Změny', 'text', 'Seznam změn (JSON). Vyplňuje aplikace – neupravovat.'], ['Popis', 'text', 'Změny čitelně.'],
    ['Stav', ['podáno', 'schváleno', 'zamítnuto', 'staženo']], ['Poznámka sboru', 'text'], ['Poznámka', 'text', 'Poznámka okresu pro sbor (u zamítnutí povinná).'],
    ['Výsledek', 'text', 'Co se po schválení provedlo. Vyplňuje skript.'], ['Vyřídil', 'email'], ['Vyřízeno', 'datetime']] },

  { nazev: 'Členové orgánů', barva: '#ec3013', sloupce: [
    ['Orgán', ['VV', 'OKRR', 'OORM', 'OORS', 'OORB', 'OORV', 'OSP'], 'Zkratka orgánu.'], ['Pořadí', 'int', 'Pořadí na webu v rámci orgánu (menší = výš).'],
    ['Funkce', 'text', 'Vyplněno = vedení (např. Předseda OKRR, Vedoucí rady). Prázdné = člen.'], ['Jméno', 'text'],
    ['Sbor', 'text', 'Jak se má zobrazit, např. SDH Čisovice (7. okrsek).'], ['Telefon', 'text'], ['E-mail', 'email'],
    ['Poznámka', 'text', 'Další řádek pod kontaktem, např. Úřední hodiny.'],
    ['Kontakt na web', ANO_NE, 'ANO = telefon a e-mail se zobrazí na webu. Jen se souhlasem dotyčného (GDPR).'],
    ['Aktivní', ANO_NE, 'NE = na webu se nezobrazí (např. ukončené členství).']] },

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
    ['Datum', 'date', 'Začátek (od).'], ['Místo', 'text'], ['Vybavení', 'text', 'Jiné vybavení nebo poznámka (volný text). Věci z evidence majetku jsou v listu Rezervace.'], ['Přílohy – složka', 'text', 'Složka Žádosti/<ID> na sdíleném disku. Vyplňuje skript.'],
    ['Stav', ['podáno', 'vráceno k doplnění', 'schváleno', 'zamítnuto', 'staženo']], ['Vyřídil', 'email'], ['Vyřízeno', 'datetime'], ['Poznámka', 'text', 'Poznámka okresu pro sbor (u vrácení a zamítnutí povinná).'],
    ['Do', 'date', 'Konec (u vícedenní akce).'], ['Pro koho', PRO_KOHO], ['Kontakt', 'email', 'E-mail pořadatele pro odpověď okresu.'], ['Popis', 'text'],
    ['Akce – ID', 'text', 'Akce vytvořená schválením žádosti. Vyplňuje skript.'],
    ['Čas od', 'text', 'Začátek, např. 09:00. Prázdné = celodenní akce.'], ['Čas do', 'text', 'Konec, např. 17:00 (nepovinné).']] },

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

  { nazev: 'Nabídka majetku', barva: '#201e1d', sloupce: [
    ['Majetek – ID', 'text', 'ID z Evidence majetku (M…). Nastavuje role Majetek v aplikaci (detail majetku → Nabídka sborům).'], ['Název', 'text', 'Jen pro orientaci, podle evidence.'],
    ['Nabízet sborům', ANO_NE, 'ANO = sbory si věc mohou vybrat v žádosti o pořádání akce.'], ['Poznámka pro sbory', 'text', 'Např. vyzvednutí v kanceláři OSH, jen s obsluhou.']] },

  { nazev: 'Rezervace', barva: '#201e1d', sloupce: [
    ['ID', 'text'], ['Majetek – ID', 'text'], ['Sbor', 'text'], ['Od', 'date'], ['Do', 'date'], ['Účel', 'text', 'Název akce ze žádosti.'],
    ['Stav', ['žádost', 'potvrzeno', 'vydáno', 'vráceno', 'zamítnuto', 'zrušeno'], 'žádost → potvrzeno (schválená žádost) → vydáno (výpůjčka) → vráceno. Vyplňuje aplikace.'],
    ['Potvrdil', 'email'], ['Stav po vrácení', 'text'], ['Poznámka', 'text'],
    ['Žádost – ID', 'text', 'Žádost sboru, ze které rezervace vznikla.'], ['Výpůjčka – ID', 'text', 'Výpůjčka v Evidenci majetku po vydání.']] },

  { nazev: 'Členské přihlášky', barva: '#ec3013', sloupce: [ // B7 – rodné číslo a adresa NIKDY do tabulky (jen PDF a udaje.json ve složce, Prihlasky.gs)
    ['ID', 'text'], ['Sbor', 'text'], ['Skupina', 'text', 'Skupina sboru sdh-… (podle ní server ověřuje sbor).'], ['Jméno', 'text'], ['Příjmení', 'text'], ['Datum narození', 'date'],
    ['Kategorie', ['dospělý', 'mladý hasič']], ['Sportovec', ['ANO', 'NE']], ['Přestup z', 'text'], ['E-mail', 'email'], ['Telefon', 'text'],
    ['Zákonný zástupce', 'text', 'Jen jméno; datum narození a telefon zástupce jsou v udaje.json.'],
    ['Variabilní symbol', 'text'], ['Zaplaceno', 'date', 'Člen zaplatil příspěvek sboru – označí sbor před předáním okresu.'], ['Evidenční číslo', 'text', 'Z evidencesdh.cz – vyplní okres, stav pak zapsáno.'], ['Členem od', 'date', 'Den zápisu do Centrální evidence = den vzniku členství (stanovy čl. 19 odst. 4); člen o něm dostane e-mail.'],
    ['Stav', ['žádost', 'doplnit', 'nepřijato', 'přijato', 'sken u okresu', 'vráceno', 'schváleno', 'zapsáno', 'zamítnuto', 'staženo']], ['Stav od', 'datetime', 'Od kdy platí stav (lhůty výmazu).'],
    ['Poznámka', 'text', 'Důvod vrácení nebo zamítnutí – vidí sbor.'], ['Zdroj', ['web', 'sbor', 'test']],
    ['Složka – ID', 'text', 'Složka Přihlášky/<sbor>/<ID> na Můj disk účtu aplikace (PDF, udaje.json, sken). Bez sdílení.'], ['PDF – ID', 'text', 'Vyplněná přihláška (s rodným číslem).'], ['Sken – ID', 'text', 'Podepsaný sken – zůstává i po výmazu údajů.'], ['Fotka – ID', 'text', 'Digitální fotka člena (povinná před předáním okresu), smaže se s údaji po lhůtě.'],
    ['Údaje smazány', 'datetime', 'Kdy noční údržba smazala udaje.json, PDF a fotku.'],
    ['Odvod', 'int', 'Kč, které sbor odvádí okresu za nového člena (Nastavení ODVOD_DOSPELY / ODVOD_MH) – vznikne předáním okresu nebo platbou sboru; nezaplacený zruší zamítnutí nebo zrušení přihlášky.'],
    ['Odvod přijat', 'date', 'Kdy okres odvod od sboru přijal (Přihlášky členů → Odvody).'], ['Odvod zaplacen', 'date', 'Kdy sbor označil odvod jako zaplacený (okres pak potvrdí Odvod přijat).'],
    ['Motivační dopis', 'text', 'Proč se uchazeč chce stát členem (žádost z webu). Vidí sbor a okres.'], ['Schváleno výborem', 'date', 'Datum schválení přijetí výborem SDH – vyplní sbor při přijetí, tiskne se do přihlášky.'],
    ['Sken uchazeče – ID', 'text', 'Podepsaná přihláška, kterou nahrál uchazeč přes svůj odkaz (bez razítka sboru).'], ['Odkaz – otisk', 'text', 'Otisk osobního odkazu uchazeče (samotný odkaz je jen v jeho e-mailu). Neměnit.']] },

  { nazev: 'Příspěvky', barva: '#201e1d', sloupce: [
    ['ID', 'text'], ['Titulek', 'text'], ['Perex', 'text', 'Krátké shrnutí do seznamu. Prázdné = začátek textu.'],
    ['Text', 'text', 'Omezený Markdown: prázdný řádek = odstavec, **tučně**, [odkaz](https://…), řádek s „- “ = odrážka.'],
    ['Fotky – složka', 'text', 'Složka Příspěvky/<ID> na sdíleném disku. Vyplňuje skript.'], ['Přílohy', 'text', 'Seznam fotek, příloh a odkazů na dokumenty (JSON). Vyplňuje aplikace – neupravovat.'],
    ['Autor', 'email'], ['Zdroj', ['aplikace', 'e-mail']], ['Stav', ['koncept', 'ke schválení', 'vráceno k úpravě', 'zveřejněno', 'staženo']],
    ['Zveřejněno', 'datetime'], ['Odkaz', 'text', 'Odkaz na zveřejněný příspěvek. Vyplňuje skript.'],
    ['Pro koho', ['veřejnost', 'všechny sbory'], 'veřejnost = web i portál sborů; všechny sbory = jen portál sborů po přihlášení.'],
    ['Hlavní fotka – ID', 'text', 'ID souboru hlavní fotky (z Příloh). Vyplňuje aplikace.'], ['Připnout', ANO_NE, 'ANO = nahoře na úvodní stránce webu.'],
    ['Štítky', 'text', 'Oddělené čárkou, např. soutěže, MH, okres, sbory.'], ['Adresa', 'text', 'Část odkazu ?clanek=… (z titulku). Vyplňuje skript při zveřejnění, pak neměnit.'],
    ['Poznámka', 'text', 'Poznámka pro autora při vrácení k úpravě.']] },

  { nazev: 'Záznam změn', audit: false, barva: '#868e96', sloupce: [
    ['Čas', 'datetime'], ['Uživatel', 'email'], ['List', 'text'], ['ID', 'text'], ['Akce', ['vytvořeno', 'upraveno', 'smazáno', 'schváleno', 'zamítnuto', 'přihlášení', 'čteno', 'export']],
    ['Před', 'text'], ['Po', 'text']] }
];

// [klíč, výchozí v TESTu, popis, výchozí v OSTRÉM provozu (chybí = stejné jako v TESTu)]. Výchozí hodnota se zapíše jen při založení klíče,
// existující řádky se nikdy nepřepisují. ID disků, kalendářů a tabulek tu nejsou – doplní se ručně a chybějící ohlásí kontrolaProstredi.
const NASTAVENI = [
  ['REZIM', 'TEST', 'TEST = všechny e-maily jdou jen na TEST_EMAIL. OSTRY = skutečným adresátům.', 'OSTRY'],
  ['TEST_EMAIL', 'spravci@oshpz.cz', 'Kam chodí všechny e-maily v testovacím režimu.'],
  ['TEST_KODY_PRIMO', 'ANO', 'ANO = v režimu TEST chodí přihlašovací kód (a upozornění na přihlášení) rovnou uživateli, ostatní pošta jen na TEST_EMAIL. NE = i kódy na TEST_EMAIL.'],
  ['DOMENA', 'oshpz.cz', ''],
  ['ODESILATEL', 'aplikace@oshpz.cz', 'Adresa, ze které odchází pošta.'],
  ['DISK_ID', '', 'Sdílený disk (orgány, žádosti, zálohy). ID testovacího prostředí jsou v docs/nastaveni-test.md.'],
  ['SLOZKA_ORGANY', 'Orgány OSH PZ', 'Složka s podsložkami orgánů.'],
  ['KALENDAR_ID', '', 'Google Kalendář okresu (ID kalendáře z jeho nastavení).'],
  ['WEB_URL', 'https://test.oshpz.cz', 'Adresa webu bez lomítka na konci (odkazy v e-mailech, kontrola config.js). Při souběhu se starým webem třeba https://novy.oshpz.cz.', 'https://oshpz.cz'],
  ['PRIPOMINKY_DNY', '14,3', 'Výchozí připomínky termínů.'],
  ['TABULKA_ID', '', 'Tato tabulka – doplní Založit / doplnit strukturu sama.'],
  ['CITLIVE_ID', '', 'Nepoužívá se – od B7 jsou rodná čísla jen ve vyplněném PDF a udaje.json ve složce přihlášek (Prihlasky.gs).'],
  ['RC_SMAZAT_PO_DNECH', '30', 'Nepoužívá se – lhůty výmazu přihlášek jsou PRIHLASKY_VYMAZ_*.'],
  ['POJMENOVANI', 'ZKRATKA RRRRMMDD Název | ZKRATKA RRRR Název', 'Pravidlo názvů dokumentů.'],
  ['SLOZKA_ZALOHY', 'Zálohy', 'Složka na sdíleném disku (DISK_ID) pro týdenní zálohy a archiv záznamu změn. Skript ji založí.'],
  ['ZALOHY_TYDNY', '12', 'Kolik týdnů se drží týdenní zálohy. První záloha každého měsíce zůstává 12 měsíců.'],
  ['TURNSTILE_SITEKEY', '', 'Veřejný klíč Cloudflare Turnstile (site key). Tajný klíč patří jen do Vlastností skriptu jako TURNSTILE_SECRET.'],
  ['TURNSTILE_DOMENY', 'test.oshpz.cz', 'Domény, ze kterých smí přijít ověření (čárkou). Prázdné = doména z WEB_URL.', 'oshpz.cz,www.oshpz.cz,novy.oshpz.cz'],
  ['TURNSTILE_PRISNE', 'ANO', 'ANO = ověření proti robotům se vynucuje i v režimu TEST (chybný nebo chybějící token = kód se nepošle). NE = v TESTu jen varování.'],
  ['MAJETEK_CISELNIKY_ID', '', 'Evidence majetku – tabulka OSHPZ_Evidence_Číselníky (Kategorie, stavy, Osoby).'],
  ['MAJETEK_TABULKA_ID', '', 'Evidence majetku – tabulka OSHPZ_Evidence_Majetek (list Majetek).'],
  ['MAJETEK_VYPUJCKY_ID', '', 'Evidence majetku – tabulka OSHPZ_Evidence_Výpůjčky (list Výpůjčky).'],
  ['MAJETEK_FOTO_DISK', '', 'Sdílený disk evidence majetku; fotky jdou do jeho složky „Foto majetku“.'],
  ['SKUPINY_TABULKA_ID', '', 'Tabulka Skupiny OSH (list Sbory pro skript skupin). Změny sborů schválené v aplikaci se zapíší i sem.'],
  ['PRIHLASKY_ZAPNUTO', 'ANO', 'ANO = veřejný formulář přihlášky člena na webu je zapnutý (?stranka=prihlaska&sbor=…). NE = jen sbor v portálu.'],
  ['PRISPEVEK_DOSPELY', '', 'Výchozí roční příspěvek dospělého (Kč) pro sbory, které si v portálu nenastavily vlastní (list Sbory, Příspěvek dospělý).'],
  ['PRISPEVEK_MH', '', 'Výchozí roční příspěvek mladého hasiče (Kč) – totéž (list Sbory, Příspěvek MH).'],
  ['ODVOD_DOSPELY', '200', 'Kolik Kč odvádí sbor okresu za nového dospělého člena (vznikne předáním přihlášky okresu).'],
  ['ODVOD_MH', '200', 'Kolik Kč odvádí sbor okresu za nového mladého hasiče.'],
  ['OKRES_UCET', '29331110/2010', 'Účet okresu pro odvody sborů (QR platba v portálu sboru, VS = registrační číslo sboru).'],
  ['PRIHLASKY_VYMAZ_ZAPSANO_DNY', '90', 'Za kolik dní po zápisu do evidence se smaže udaje.json a vyplněné PDF (sken zůstává).'],
  ['PRIHLASKY_VYMAZ_OSTATNI_DNY', '30', 'Totéž u zamítnutých a stažených přihlášek.'],
  ['PRIHLASKY_SLOZKA_ID', '', 'Složka přihlášek (Můj disk účtu aplikace). Prázdné = skript ji založí sám a ID si pamatuje ve Vlastnostech skriptu.'],
  ['PRISPEVKY_EMAIL', 'prispevky@oshpz.cz', 'Adresa pro příspěvky e-mailem. Musí to být alias účtu, pod kterým skript běží (test admin@, ostrý aplikace@). Prázdné = vypnuto.'],
  ['GITHUB_REPO', 'oshpz/web', 'Kam skript zapisuje data/web.json (token GITHUB_TOKEN ve Vlastnostech skriptu). Prázdné = vypnuto.', 'oshpz/web-ostry'],
  ['GITHUB_VETEV', 'main', 'Větev repozitáře GITHUB_REPO.']
];

/** Prostředí tabulky: Vlastnost skriptu PROSTREDI, jinak REZIM v Nastavení, jinak „TEST“ v názvu tabulky. Na prázdné ostré tabulce nastavte PROSTREDI = OSTRY. */
function prostrediTabulky_(ss) {
  const p = String(PropertiesService.getScriptProperties().getProperty('PROSTREDI') || '').trim().toUpperCase();
  if (p === 'TEST' || p === 'OSTRY') return p;
  const nast = ss.getSheetByName('Nastavení');
  if (nast && nast.getLastRow() > 1) {
    const r = nast.getRange(2, 1, nast.getLastRow() - 1, 2).getValues().find(x => x[0] === 'REZIM');
    if (r && (r[1] === 'TEST' || r[1] === 'OSTRY')) return r[1];
  }
  if (/TEST/i.test(ss.getName())) return 'TEST';
  throw new Error('Nevím, jestli jde o testovací, nebo ostrou tabulku. Nastavte v Apps Script → Nastavení projektu → Vlastnosti skriptu PROSTREDI = OSTRY (nebo TEST) a spusťte znovu.');
}

function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('OSH data').addItem('Založit / doplnit strukturu', 'zalozitStrukturu')
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
      .addItem('Záznam změn: archivovat starší než 24 měsíců', 'archivovatZaznamTed')
      .addSeparator()
      .addItem('Přihlášky: doplnit registrační čísla sborů', 'doplnitRegistracniCisla')
      .addItem('Přihlášky: automatický test postupu a odvodů', 'testPrihlaskyOdvod')
      .addSeparator()
      .addItem('Úklid testů: náhled (nic nemaže)', 'uklidTestuNahled')
      .addItem('Úklid testů: smazat zaškrtnuté', 'uklidTestuProvest')
      .addSeparator()
      .addItem('Kontrola prostředí (co chybí ke spuštění)', 'kontrolaProstredi').addToUi();
  } catch (e) {}
}

function zalozitStrukturu() {
  const ss = SpreadsheetApp.getActive();
  if (!ss) throw new Error('Skript musí být vložený v tabulce (Rozšíření → Apps Script).');
  const hlaseni = [], prostredi = prostrediTabulky_(ss);
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
  NASTAVENI.forEach(r => {
    if (klice.indexOf(r[0]) >= 0) return;
    const hodnota = r[0] === 'TABULKA_ID' ? ss.getId() : prostredi === 'OSTRY' && r.length > 3 ? r[3] : r[1];
    nast.appendRow([r[0], hodnota, r[2] || '']); hlaseni.push('+ nastavení ' + r[0] + (prostredi === 'OSTRY' && hodnota === '' ? ' (doplnit)' : ''));
  });
  // prázdné TABULKA_ID (nové klíče) = tato tabulka; Vlastnost skriptu TABULKA_ID čte web (dataSs_)
  const iTab = nast.getRange(2, 1, Math.max(nast.getLastRow() - 1, 1), 2).getValues().findIndex(r => r[0] === 'TABULKA_ID' && !r[1]);
  if (iTab >= 0) nast.getRange(iTab + 2, 2).setValue(ss.getId());
  const pp = PropertiesService.getScriptProperties();
  if (pp.getProperty('TABULKA_ID') !== ss.getId()) { pp.setProperty('TABULKA_ID', ss.getId()); hlaseni.push('Vlastnost skriptu TABULKA_ID = tato tabulka'); }
  if (!pp.getProperty('PROSTREDI')) pp.setProperty('PROSTREDI', prostredi);
  nast.setColumnWidth(2, 420); nast.setColumnWidth(3, 420);

  const prazdny = ss.getSheetByName('List 1') || ss.getSheetByName('List1') || ss.getSheetByName('Sheet1');
  if (prazdny && prazdny.getLastRow() === 0 && ss.getSheets().length > 1) { ss.deleteSheet(prazdny); hlaseni.push('− prázdný List 1'); }

  try { const n = prhMigrace_(); if (n) hlaseni.push('Členské přihlášky: stav odesláno → přijato (' + n + ')'); } catch (e) { hlaseni.push('Migrace přihlášek: ' + e.message); }
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
