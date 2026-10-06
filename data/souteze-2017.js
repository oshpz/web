// Soutěže OSH Praha-západ — ročník 2017 (archiv; sezóna 2016/2017).
window.OSH_SOUTEZE_ARCHIV = (window.OSH_SOUTEZE_ARCHIV || []).filter(y => y.rocnik !== 2017);
window.OSH_SOUTEZE_ARCHIV.push({
  rocnik: 2017,
  sboryMH: ['Sloup', 'Solopisky', 'Středokluky', 'Zahořany'],
  alias: {},
  souteze: [
    {
      id: 'uzlovka', nazev: 'Uzlová štafeta', podtitul: '7. ročník',
      terminy: [{ d: '2017-03-18', misto: 'Středokluky, sokolovna' }],
      poradatel: 'Okresní odborná rada mládeže', kategorie: ['mladší', 'starší'],
      info: [['Výsledky', 'na disku jsou jen OZ a přihláška']],
      dokumenty: [['Organizační zabezpečení', 'souteze/2017/uzlovka/OZ.pdf'], ['Přihláška (xlsx)', 'souteze/2017/uzlovka/prihlaska.xlsx']],
      vysledky: []
    },
    {
      id: 'plamen', nazev: 'Hra Plamen – okresní kolo', podtitul: 'ročník 2016/2017',
      terminy: [{ d: '2017-05-20', misto: 'Psáry, fotbalové hřiště' }],
      poradatel: 'Okresní odborná rada mládeže', kategorie: ['mladší', 'starší'],
      info: [['Výsledky', 'PDF s výsledky je sken bez textu – do statistik zatím nepřevedeno']],
      dokumenty: [['Organizační zabezpečení', 'souteze/2017/plamen/OZ.pdf'], ['Přihláška (xlsx)', 'souteze/2017/plamen/prihlasky.xlsx'], ['Výsledky (sken)', 'souteze/2017/plamen/vysledky.pdf']],
      vysledky: []
    },
    {
      id: 'dorost', nazev: 'Okresní soutěž dorostu', podtitul: 'jednotlivci',
      terminy: [{ d: '2017-05-21', misto: 'Praha-Třebonice, hasičské cvičiště (ul. Pod Náplavkou)' }],
      poradatel: 'Okresní odborná rada mládeže', kategorie: ['dorostenci', 'dorostenky'],
      info: [['Kategorie', 'rozdělení do věkových kategorií odvozeno z roku narození v tabulce'], ['Družstva', 'výsledky družstev jsou ve starém formátu .xls – nepodařilo se je nahrát']],
      dokumenty: [['Organizační zabezpečení', 'souteze/2017/dorost/OZ.pdf'], ['Přihláška (xlsx)', 'souteze/2017/dorost/prihlasky.xlsx'], ['Výsledky jednotlivců (xlsx)', 'souteze/2017/dorost/jednotlivci.xlsx']],
      vysledky: [
        { kat: 'Dorostenky mladší', typ: 'jednotlivci', pocet: 3, rows: [[1, 'Zahořany', '3 b.'], [2, 'Středokluky', '5 b.']] },
        { kat: 'Dorostenky střední', typ: 'jednotlivci', pocet: 3, rows: [[1, 'Středokluky', '3 b.'], [2, 'Solopisky', '5 b.'], [3, 'Solopisky', '7 b.']] },
        { kat: 'Dorostenky starší', typ: 'jednotlivci', pocet: 2, rows: [[1, 'Solopisky', '3 b.'], [2, 'Středokluky', '5 b.']] },
        { kat: 'Dorostenci mladší', typ: 'jednotlivci', pocet: 3, rows: [[1, 'Středokluky', '4 b.'], [2, 'Zahořany', '5 b.'], [3, 'Sloup', '6 b.']] },
        { kat: 'Dorostenci starší', typ: 'jednotlivci', pocet: 3, rows: [[1, 'Sloup', '4 b.'], [2, 'Zahořany', '5 b.']] }
      ]
    }
  ]
});
window.dispatchEvent && window.dispatchEvent(new Event('osh-data'));
