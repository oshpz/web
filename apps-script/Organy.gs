/**
 * OSH data – členové orgánů pro web (list „Členové orgánů“).
 * Nový soubor „Organy“ ve stejném projektu.
 *
 * Jeden řádek = jeden člověk v jednom orgánu. Funkce vyplněná = vedení (např. „Předseda OKRR“), prázdná = člen.
 * Telefon a e-mail jdou na web jen při „Kontakt na web“ = ANO (souhlas se zveřejněním). Aktivní = NE → na webu není.
 * Web čte ?co=organy (5 min v mezipaměti, ruční úprava listu ji hned smaže).
 */

const LIST_ORGANY = 'Členové orgánů';
const ORGANY_PORADI = ['VV', 'OKRR', 'OORM', 'OORS', 'OORB', 'OORV', 'OSP'];

function organyVerejne_() {
  const c = CacheService.getScriptCache(), z = c.get('v_organy');
  if (z) return JSON.parse(z);
  const data = radky_(LIST_ORGANY).filter(r => r['Orgán'] && r['Jméno'] && String(r['Aktivní']).trim().toUpperCase() !== 'NE')
    .map(r => {
      const kontakt = ano_(r['Kontakt na web']);
      return { organ: String(r['Orgán']).trim(), poradi: Number(r['Pořadí']) || 999, funkce: String(r['Funkce'] || '').trim(), jmeno: String(r['Jméno']).trim(),
        sbor: String(r['Sbor'] || '').trim(), tel: kontakt ? String(r['Telefon'] || '').trim() : '', email: kontakt ? String(r['E-mail'] || '').trim() : '', pozn: String(r['Poznámka'] || '').trim() };
    })
    .sort((a, b) => (ORGANY_PORADI.indexOf(a.organ) - ORGANY_PORADI.indexOf(b.organ)) || (a.poradi - b.poradi));
  try { c.put('v_organy', JSON.stringify(data), 300); } catch (e) {}
  return data;
}

/**
 * Jednorázově: přenese členy orgánů z dosavadního webu do listu „Členové orgánů“ (stav k 8. 10. 2026).
 * Spusťte po zalozitStrukturu. Když už list data má, nic nepřidá. Po převodu se funkce z kódu odstraní.
 * Kontakt na web = ANO u těch, jejichž telefon/e-mail už na webu byl – ověřte u nich souhlas.
 */
function naplnitClenyOrganu() {
  const ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(LIST_ORGANY);
  if (!sh) throw new Error('Chybí list „' + LIST_ORGANY + '“ – nejdřív spusťte zalozitStrukturu.');
  if (sh.getLastRow() > 1) { ss.toast('List už obsahuje data, nic jsem nepřidal.', 'Orgány', 8); return; }
  const h = hlavicka_(sh), ted = new Date(), ja = Session.getActiveUser().getEmail();
  // [Orgán, Pořadí, Funkce, Jméno, Sbor, Telefon, E-mail, Poznámka]
  const DATA = [
    ["VV", 1, "Starosta", "Josef Myslín", "SDH Čisovice (7. okrsek)", "732 361 803", "", ""],
    ["VV", 2, "1. náměstkyně", "Jana Mertová", "SDH Horoměřice (1. okrsek)", "603 752 719", "", ""],
    ["VV", 3, "Náměstek", "Petr Kšána", "SDH Zahořany (8. okrsek)", "733 249 998", "", ""],
    ["VV", 4, "Náměstek", "Rudolf Trnka", "SDH Průhonice (14. okrsek)", "603 535 490", "", ""],
    ["VV", 5, "", "Jiří Fürst", "SDH Hostivice (4. okrsek)", "608 273 948", "", ""],
    ["VV", 6, "", "Pavel Topol", "SDH Lety (6. okrsek)", "739 040 791", "", ""],
    ["VV", 7, "", "Jiří Kobr", "SDH Pikovice (10. okrsek)", "731 383 144", "", ""],
    ["VV", 8, "", "Petra Myslínová Cejpková", "SDH Čisovice (7. okrsek)", "606 445 432", "", ""],
    ["VV", 9, "", "Simona Barsová", "SDH Mníšek pod Brdy (8. okrsek)", "722 065 058", "", ""],
    ["VV", 10, "", "Michal Zrno", "SDH Sloup (9. okrsek)", "604 173 028", "", ""],
    ["VV", 11, "", "Filip Jankovec", "SDH Bratřínov (9. okrsek)", "604 892 010", "", ""],
    ["OKRR", 1, "Předseda OKRR", "Jiří Čejka", "SDH Libeň (12. okrsek)", "724 165 644", "", ""],
    ["OKRR", 2, "", "Ondřej Semecký", "SDH Stříbrná Lhota (8. okrsek)", "773 644 336", "", ""],
    ["OKRR", 3, "", "Iveta Dvořáková", "SDH Čisovice (7. okrsek)", "730 858 527", "", ""],
    ["OKRR", 4, "", "Jan Bláha", "SDH Ořech (4. okrsek)", "724 959 933", "", ""],
    ["OKRR", 5, "", "Jan Prskavec", "SDH Mokropsy (6. okrsek)", "602 309 041", "", ""],
    ["OORM", 1, "Vedoucí rady", "Michal Zrno", "SDH Sloup", "604 173 028", "michal.zrno@seznam.cz", ""],
    ["OORM", 2, "", "Vojtěch Vilím", "SDH Středokluky", "", "", ""],
    ["OORM", 3, "", "Jan Honek", "SDH Psáry", "", "", ""],
    ["OORM", 4, "", "Kristýna Kuchařová", "SDH Horoměřice", "", "", ""],
    ["OORM", 5, "", "Jan Merta", "SDH Horoměřice", "", "", ""],
    ["OORM", 6, "", "Barbora Barsová", "SDH Solopisky", "", "", ""],
    ["OORM", 7, "", "Pavel Topol", "SDH Lety", "", "", ""],
    ["OORM", 8, "", "Jiří Kobr", "SDH Pikovice", "", "", ""],
    ["OORM", 9, "", "Matej Dudek", "SDH Masečín", "", "", ""],
    ["OORM", 10, "", "Marie Burrow", "SDH Štěchovice", "", "", ""],
    ["OORS", 1, "Vedoucí rady", "Petr Kšána", "SDH Zahořany", "733 249 998", "petr.ksana@sdhku.cz", ""],
    ["OORS", 2, "", "Pavel Topol", "SDH Lety", "", "", ""],
    ["OORS", 3, "", "Jiří Fous", "SDH Zahořany", "", "", ""],
    ["OORS", 4, "", "Michal Zrno", "SDH Sloup", "", "", ""],
    ["OORS", 5, "", "Jan Merta", "SDH Horoměřice", "", "", ""],
    ["OORS", 6, "", "Kristýna Kuchařová", "SDH Horoměřice", "", "", ""],
    ["OORS", 7, "", "Kryštof Robin Kursa", "SDH Horoměřice", "", "", ""],
    ["OORB", 1, "Vedoucí rady", "Filip Jankovec", "SDH Bratřínov", "604 892 010", "jankovecf@gmail.com", "Linka ochrany obyvatelstva (24 hod.): 792 458 148"],
    ["OORB", 2, "", "Denisa Neuberová", "SDH Čisovice", "", "", ""],
    ["OORB", 3, "", "Julia Bónová", "SDH Bojov", "", "", ""],
    ["OORB", 4, "", "Matěj Ripič", "SDH Průhonice", "", "", ""],
    ["OORB", 5, "", "Anežka Čečáková", "SDH Vestec", "", "", ""],
    ["OORB", 6, "", "Filip Hrášek", "SDH Vestec", "", "", ""],
    ["OORB", 7, "", "Alexander Sedláček", "SDH Sloup", "", "", ""],
    ["OORB", 8, "", "Eliška Kudělková", "SDH Jílové u Prahy", "", "", ""],
    ["OORB", 9, "", "Radka Hříbková", "SDH Jílové u Prahy", "", "", ""],
    ["OORB", 10, "", "Jiří Hartman", "SDH Kamenný Újezdec", "", "", ""],
    ["OORB", 11, "", "Pavel Topol", "SDH Lety", "", "", ""],
    ["OORB", 12, "", "Pavel Mach", "SDH Libčice nad Vltavou", "", "", ""],
    ["OORB", 13, "", "Lenka Pilná", "SDH Libeň", "", "", ""],
    ["OORB", 14, "", "Dominik Kaše", "SDH Jílové u Prahy", "", "", ""],
    ["OORB", 15, "", "Jiří Fürst", "SDH Hostivice", "", "", ""],
    ["OORV", 1, "Vedoucí rady", "Bc. Petra Myslínová Cejpková, MPA", "SDH Čisovice", "606 445 432", "petra.cejpkova@seznam.cz", "Úřední hodiny: 272 041 424"],
    ["OORV", 2, "", "Vendula Barátová", "SDH Bojov", "", "", ""],
    ["OORV", 3, "", "Eva Štichová", "SDH Zahořany", "", "", ""],
    ["OORV", 4, "", "Simona Barsová", "SDH Mníšek pod Brdy", "", "", ""],
    ["OORV", 5, "", "Simona Mádlová", "SDH Roztoky", "", "", ""],
    ["OORV", 6, "", "Jakub Řehák", "SDH Kamenný Újezdec", "", "", ""],
    ["OORV", 7, "", "Božena Dvořáková", "SDH Klínec", "", "", ""],
    ["OORV", 8, "", "Jan Sládek", "SDH Solopisky", "", "", ""],
    ["OORV", 9, "", "Barbora Barsová", "SDH Solopisky", "", "", ""],
    ["OORV", 10, "", "Anna Harvánková", "SDH Zahořany", "", "", ""],
    ["OORV", 11, "", "Peter Popálený", "SDH Slapy nad Vltavou", "", "", ""],
    ["OORV", 12, "", "Iveta Dvořáková", "SDH Čisovice", "", "", ""],
    ["OORV", 13, "", "Lukáš Burian", "SDH Stříbrná Lhota", "", "", ""],
    ["OORV", 14, "", "Petra Uhlářová", "SDH Stříbrná Lhota", "", "", ""],
    ["OORV", 15, "", "Jaroslav Novák", "SDH Líšnice", "", "", ""],
    ["OORV", 16, "", "Michal Kalián", "SDH Kamenný Újezdec", "", "", ""],
    ["OORV", 17, "", "Martin Kašpárek", "SDH Jíloviště", "", "", ""],
    ["OORV", 18, "", "Jana Mertová", "SDH Horoměřice", "", "", ""],
    ["OSP", 1, "Svolává", "Josef Myslín", "starosta OSH", "732 361 803", "", ""]
  ];
  const v = DATA.map(([org, por, fun, jm, sb, tel, em, poz]) => {
    const o = { 'Orgán': org, 'Pořadí': por, 'Funkce': fun, 'Jméno': jm, 'Sbor': sb, 'Telefon': tel, 'E-mail': em, 'Poznámka': poz,
      'Kontakt na web': tel || em ? 'ANO' : 'NE', 'Aktivní': 'ANO', 'Vytvořeno': ted, 'Vytvořil': ja };
    return h.map(k => k in o ? bezVzorce_(o[k]) : '');
  });
  sh.getRange(2, 1, v.length, h.length).setValues(v);
  vycistitCache_();
  zaznamZmeny_(ja, LIST_ORGANY, '', 'vytvořeno', '', 'převedeno z webu: ' + v.length + ' lidí');
  ss.toast('Převedeno ' + v.length + ' členů orgánů. Zkontrolujte sloupec „Kontakt na web“.', 'Orgány', 10);
}
