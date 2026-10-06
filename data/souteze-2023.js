// Soutěže OSH Praha-západ — ročník 2023 (archiv).
window.OSH_SOUTEZE_ARCHIV = (window.OSH_SOUTEZE_ARCHIV || []).filter(y => y.rocnik !== 2023);
window.OSH_SOUTEZE_ARCHIV.push({
  rocnik: 2023,
  sboryMH: ['Čisovice', 'Horoměřice', 'Jílové u Prahy', 'Jíloviště', 'Jinočany', 'Kamenný Újezdec', 'Libeň', 'Masečín', 'Mníšek pod Brdy', 'Psáry', 'Rudná', 'Sloup', 'Solopisky', 'Středokluky', 'Štěchovice', 'Úholičky', 'Zahořany'],
  alias: {},
  souteze: [
    {
      id: '60m', nazev: 'Běh na 60 m s překážkami', podtitul: 'okresní kolo jednotlivců',
      terminy: [{ d: '2023-04-23', misto: 'Praha-Modřany, ZŠ Rakovského, atletický ovál' }],
      poradatel: 'Okresní odborná rada mládeže', kategorie: ['mladší', 'starší'],
      info: [['Výsledky', 'na disku je jen organizační zabezpečení – výsledky doplňte']],
      dokumenty: [['Organizační zabezpečení', 'souteze/2023/60m/OZ.pdf'], ['Organizační zabezpečení (2. verze)', 'souteze/2023/60m/OZ-2.pdf']],
      vysledky: []
    },
    {
      id: 'plamen', nazev: 'Hra Plamen – okresní kolo', podtitul: 'ročník 2022/2023, dvě kola',
      terminy: [{ d: '2023-05-14', misto: 'Masečín, fotbalové hřiště', pozn: '2. kolo – 1. kolo proběhlo v Praze-Modřanech (ZŠ Rakovského)' }],
      poradatel: 'Okresní odborná rada mládeže', kategorie: ['přípravka', 'mladší', 'starší'],
      info: [['1. kolo', 'Praha-Modřany, ZŠ Rakovského – datum doplňte'], ['2. kolo', 'Masečín, 14. 5. 2023']],
      dokumenty: [['OZ 1. kolo', 'souteze/2023/plamen/OZ1.pdf'], ['OZ 2. kolo', 'souteze/2023/plamen/OZ2.pdf'], ['Celkové výsledky', 'souteze/2023/plamen/vysledky.pdf']],
      vysledky: [
        { kat: 'Přípravka', typ: 'druzstva', rows: [[1, 'Zahořany A', '6 b.'], [2, 'Sloup', '9 b.'], [3, 'Jíloviště A', '16 b.'], [4, 'Zahořany B', '19 b.'], [5, 'Libeň', '26 b.'], [6, 'Jíloviště B', '29 b.']] },
        { kat: 'Mladší', typ: 'druzstva', rows: [[1, 'Zahořany A', '5 b.'], [2, 'Sloup A', '15 b.'], [3, 'Úholičky', '18 b.'], [4, 'Psáry', '26 b.'], [5, 'Jílové u Prahy', '29 b.'], [6, 'Sloup B', '31 b.'], [7, 'Zahořany B', '33 b.'], [8, 'Libeň', '37 b.'], [9, 'Masečín', '46 b.'], [10, 'Středokluky', '47 b.'], [11, 'Štěchovice A', '49 b.'], [12, 'Solopisky', '59 b.'], [13, 'Štěchovice B', '60 b.']] },
        { kat: 'Starší', typ: 'druzstva', rows: [[1, 'Sloup', '5 b.'], [2, 'Zahořany', '13 b.'], [3, 'Psáry', '15 b.'], [4, 'Úholičky', '21 b.'], [5, 'Jíloviště A', '28 b.'], [6, 'Jílové u Prahy', '29 b.'], [7, 'Solopisky', '42 b.'], [8, 'Čisovice', '44 b.'], [9, 'Středokluky', '45 b.'], [10, 'Libeň', '49 b.'], [11, 'Masečín', '50 b.'], [13, 'Jinočany', '57 b.']] }
      ]
    },
    {
      id: 'dorost', nazev: 'Okresní soutěž dorostu', podtitul: 'jednotlivci a družstva',
      terminy: [{ d: '2023-05-27', misto: 'Zahořany' }],
      poradatel: 'Okresní odborná rada mládeže', kategorie: ['dorostenci', 'dorostenky'],
      info: [['Disciplíny', 'běh na 100 m s překážkami, dvojboj, ZPV, test, štafeta 4 × 100 m, požární útok']],
      dokumenty: [['Výsledky', 'souteze/2023/dorost/vysledky.pdf']],
      vysledky: [
        { kat: 'Družstva dorostenek', typ: 'druzstva', rows: [[1, 'Zahořany', '3 b.']] },
        { kat: 'Dorostenky mladší', typ: 'jednotlivci', pocet: 2, rows: [[1, 'Zahořany', '3 b.'], [2, 'Psáry', '3 b.']] },
        { kat: 'Dorostenky střední', typ: 'jednotlivci', pocet: 1, rows: [[1, 'Psáry', '3 b.']] },
        { kat: 'Dorostenci mladší', typ: 'jednotlivci', pocet: 1, rows: [[1, 'Solopisky', '3 b.']] },
        { kat: 'Dorostenci střední', typ: 'jednotlivci', pocet: 3, rows: [[1, 'Zahořany', '2 b.'], [2, 'Solopisky', '5 b.'], [3, 'Psáry', '5 b.']] },
        { kat: 'Dorostenci starší', typ: 'jednotlivci', pocet: 2, rows: [[1, 'Zahořany', '2 b.'], [2, 'Solopisky', '4 b.']] }
      ]
    },
    {
      id: 'zhvb', nazev: 'Závod hasičské všestrannosti a brannosti', podtitul: 'okresní kolo ZHVB',
      terminy: [{ d: '2023-10-01', misto: 'místo doplňte' }], datumPriblizne: 'podzim 2023',
      poradatel: 'Rada mládeže OSH', kategorie: ['přípravka', 'mladší', 'starší', 'dorost'],
      info: [['Termín a místo', 've výsledkové listině nejsou uvedené – doplňte'], ['Dorost', 'pořadí dorostu se z listiny nepodařilo převést']],
      dokumenty: [['Výsledky', 'souteze/2023/zhvb/vysledky.pdf']],
      vysledky: [
        { kat: 'Přípravka', typ: 'druzstva', rows: [[1, 'Zahořany', '0:38:54'], [2, 'Psáry', '0:40:22'], [3, 'Sloup', '0:58:54']] },
        { kat: 'Mladší', typ: 'druzstva', rows: [[1, 'Zahořany A', '0:21:04'], [2, 'Psáry A', '0:27:41'], [3, 'Horoměřice A', '0:29:26'], [4, 'Sloup A', '0:29:43'], [5, 'Úholičky', '0:30:13'], [6, 'Zahořany B', '0:33:13'], [7, 'Jílové u Prahy A', '0:34:14'], [8, 'Sloup B', '0:34:18'], [9, 'Horoměřice B', '0:40:44'], [10, 'Rudná', '0:41:29'], [11, 'Jílové u Prahy B', '0:42:11'], [12, 'Středokluky', '0:42:40'], [13, 'Štěchovice A', '0:43:10'], [14, 'Štěchovice B', '0:50:58'], [15, 'Libeň A', '0:52:41'], [16, 'Kamenný Újezdec B', '0:57:03'], [17, 'Solopisky A', '0:59:41'], [18, 'Psáry B', '1:00:49'], [19, 'Libeň B', '1:05:39'], [20, 'Kamenný Újezdec A', '1:09:01'], [21, 'Mníšek pod Brdy', '1:36:21']] },
        { kat: 'Starší', typ: 'druzstva', rows: [[1, 'Sloup', '0:20:13'], [2, 'Zahořany B', '0:21:39'], [3, 'Kamenný Újezdec', '0:24:46'], [4, 'Libeň A', '0:26:22'], [5, 'Úholičky', '0:26:37'], [6, 'Jílové u Prahy A', '0:29:19'], [7, 'Psáry A', '0:33:31'], [8, 'Zahořany A', '0:38:07'], [9, 'Psáry B', '0:39:32'], [10, 'Horoměřice A', '0:40:57'], [11, 'Jílové u Prahy B', '0:42:27'], [12, 'Rudná', '0:43:57'], [13, 'Mníšek pod Brdy', '0:54:30'], [14, 'Solopisky', '0:58:15'], [15, 'Štěchovice', '1:04:32'], [16, 'Libeň B', '1:07:27']] }
      ]
    }
  ]
});
window.dispatchEvent && window.dispatchEvent(new Event('osh-data'));
