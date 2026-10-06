// Soutěže OSH Praha-západ — ročník 2025 (archiv). Stejný formát jako data/souteze-2026.js.
window.OSH_SOUTEZE_ARCHIV = (window.OSH_SOUTEZE_ARCHIV || []).filter(y => y.rocnik !== 2025);
window.OSH_SOUTEZE_ARCHIV.push({
  rocnik: 2025,
  sboryMH: ['Čisovice', 'Horoměřice', 'Jílové u Prahy', 'Jíloviště', 'Jinočany', 'Kamenný Újezdec', 'Libeň', 'Masečín', 'Mokropsy', 'Psáry', 'Roztoky', 'Rudná', 'Řevnice', 'Slapy', 'Sloup', 'Solopisky', 'Středokluky', 'Štěchovice', 'Úholičky', 'Zahořany'],
  alias: { 'Roztoky u Prahy': 'Roztoky', 'Slapy nad Vltavou': 'Slapy' },
  souteze: [
    {
      id: 'uzlovka', nazev: 'Uzlová štafeta', podtitul: 'dvě kola – jaro přípravka a mladší, podzim starší a dorost',
      terminy: [{ d: '2025-03-08', misto: 'Jinočany, sokolovna', pozn: 'přípravka a mladší' }, { d: '2025-11-08', misto: 'Středokluky, sokolovna', pozn: 'starší a dorost' }],
      poradatel: 'Okresní odborná rada mládeže', kategorie: ['přípravka', 'mladší', 'starší', 'dorost'],
      info: [['Disciplíny', 'jednotlivci a družstva, 2 pokusy'], ['Náčelník štábu', 'Michal Zrno']],
      dokumenty: [
        ['OZ – přípravka a mladší', 'souteze/2025/uzlovka/OZ-ml.pdf'], ['OZ – starší a dorost', 'souteze/2025/uzlovka/OZ-st.pdf'],
        ['Přihláška starší a dorost (xlsx)', 'souteze/2025/uzlovka/prihlaska-st.xlsx'],
        ['Výsledky – přípravka družstva', 'souteze/2025/uzlovka/vys-pripravka_druzstva.pdf'], ['Výsledky – mladší družstva', 'souteze/2025/uzlovka/vys-mladsi_druzstva.pdf'],
        ['Výsledky – starší družstva', 'souteze/2025/uzlovka/vys-starsi_druzstva.pdf'], ['Výsledky – dorost družstva', 'souteze/2025/uzlovka/vys-dorost_druzstva.pdf'],
        ['Výsledky – mladší jednotlivci', 'souteze/2025/uzlovka/vys-mladsi_jednotlivci.pdf'], ['Výsledky – starší jednotlivci', 'souteze/2025/uzlovka/vys-starsi_jednotlivci.pdf']
      ],
      vysledky: [
        { kat: 'Přípravka – družstva', typ: 'druzstva', rows: [[1, 'Psáry', '27,93 s'], [2, 'Zahořany', '32,15 s'], [3, 'Sloup', '42,05 s'], [4, 'Kamenný Újezdec', '49,08 s'], [5, 'Masečín A', '65,12 s'], [6, 'Horoměřice', '74,12 s'], [7, 'Jinočany', '82,00 s'], [8, 'Masečín B', '98,30 s'], [9, 'Jíloviště', '99,35 s']] },
        { kat: 'Mladší – družstva', typ: 'druzstva', rows: [[1, 'Zahořany', '29,85 s'], [2, 'Sloup', '30,21 s'], [3, 'Štěchovice', '35,50 s'], [4, 'Psáry', '37,33 s'], [5, 'Jílové u Prahy', '37,74 s'], [6, 'Jíloviště', '38,65 s'], [7, 'OSH PZ (smíšené)', '40,97 s'], [8, 'Kamenný Újezdec', '42,10 s'], [9, 'Libeň', '46,17 s'], [10, 'Čisovice', '51,54 s'], [11, 'Horoměřice', '53,26 s'], [12, 'Jinočany', '53,97 s'], [13, 'Masečín', '60,00 s'], [14, 'Roztoky u Prahy', '129,30 s'], [15, 'Řevnice', 'neplatný'], [15, 'Úholičky', 'neplatný']] },
        { kat: 'Starší – družstva', typ: 'druzstva', rows: [[1, 'Zahořany', '23,08 s'], [2, 'Jíloviště', '25,95 s'], [3, 'Sloup', '27,26 s'], [4, 'Psáry', '28,85 s'], [5, 'Masečín', '30,74 s'], [6, 'Jinočany', '32,71 s'], [7, 'Libeň', '33,98 s'], [8, 'Úholičky', '39,92 s'], [9, 'Čisovice', '58,17 s']] },
        { kat: 'Dorost – družstva', typ: 'druzstva', rows: [[1, 'Zahořany', '22,79 s'], [2, 'Sloup', '26,00 s'], [3, 'Úholičky', '39,39 s'], [4, 'Jíloviště', '53,82 s'], [5, 'Psáry', '58,39 s'], [6, 'Horoměřice', '70,29 s']] }
      ]
    },
    {
      id: 'plamen', nazev: 'Hra Plamen – okresní kolo', podtitul: 'ročník 2024/2025, dvě kola',
      terminy: [{ d: '2025-04-26', misto: 'Bojanovice, fotbalové hřiště', pozn: '1. kolo' }, { d: '2025-05-17', misto: 'Masečín, fotbalové hřiště', pozn: '2. kolo' }],
      poradatel: 'Okresní odborná rada mládeže', kategorie: ['přípravka', 'mladší', 'starší'],
      info: [['Družstvo', '7–10 členů, nejméně 4 z jednoho SDH'], ['Náčelník štábu', 'Michal Zrno']],
      dokumenty: [['OZ 1. kolo', 'souteze/2025/plamen/OZ1.pdf'], ['OZ 2. kolo', 'souteze/2025/plamen/OZ2.pdf'], ['Přihláška (xlsx)', 'souteze/2025/plamen/prihlasky.xlsx'],
        ['Celkové výsledky – přípravka', 'souteze/2025/plamen/vys-pripravka.pdf'], ['Celkové výsledky – mladší', 'souteze/2025/plamen/vys-mladsi.pdf'], ['Celkové výsledky – starší', 'souteze/2025/plamen/vys-starsi.pdf']],
      vysledky: [
        { kat: 'Přípravka', typ: 'druzstva', rows: [[1, 'Sloup', '6 b.'], [2, 'Masečín', '6 b.'], [3, 'Zahořany', '7 b.'], [4, 'Jíloviště', '11 b.']] },
        { kat: 'Mladší', typ: 'druzstva', rows: [[1, 'Zahořany A', '7 b.'], [2, 'Sloup A', '10 b.'], [3, 'Štěchovice A', '21 b.'], [4, 'Sloup B', '26 b.'], [5, 'Psáry', '33 b.'], [6, 'Zahořany B', '35 b.'], [7, 'Kamenný Újezdec', '40 b.'], [8, 'Jílové u Prahy A', '42 b.'], [9, 'Jílové u Prahy B', '44 b.'], [10, 'Masečín', '51 b.'], [11, 'Jíloviště', '52 b.'], [12, 'Úholičky', '52 b.'], [13, 'Štěchovice B', '55 b.'], [14, 'Zahořany C', '66 b.'], [15, 'Libeň', '69 b.'], [16, 'Jinočany', '77 b.'], [17, 'Čisovice', '85 b.']] },
        { kat: 'Starší', typ: 'druzstva', rows: [[1, 'Zahořany A', '7 b.'], [2, 'Sloup', '11 b.'], [3, 'Čisovice', '16 b.'], [4, 'Psáry', '21 b.'], [5, 'Zahořany B', '23 b.'], [6, 'Jílové u Prahy', '32 b.'], [7, 'Úholičky', '32 b.'], [8, 'Libeň', '39 b.'], [9, 'Masečín', '45 b.'], [10, 'Středokluky', '52 b.'], [11, 'Mokropsy', '55 b.'], [12, 'Solopisky', '56 b.'], [13, 'Jinočany', '57 b.'], [14, 'Kamenný Újezdec', '61 b.']] }
      ]
    },
    {
      id: 'dorost', nazev: 'Okresní soutěž dorostu', podtitul: 'jednotlivci a družstva',
      terminy: [{ d: '2025-05-31', misto: 'Zahořany, hasičské cvičiště' }],
      poradatel: 'Okresní odborná rada mládeže', kategorie: ['dorostenci', 'dorostenky'],
      info: [['Disciplíny', 'běh na 100 m s překážkami, běh s PHP, požární útok']],
      dokumenty: [['Organizační zabezpečení', 'souteze/2025/dorost/OZ.pdf'], ['Přihláška (xlsx)', 'souteze/2025/dorost/prihlasky.xlsx'], ['Výsledky – družstva dorostenek', 'souteze/2025/dorost/vys-dorky_druzstva.pdf']],
      vysledky: [
        { kat: 'Družstva dorostenek', typ: 'druzstva', rows: [[1, 'Zahořany', '3 b.']] },
        { kat: 'Dorostenci mladší', typ: 'jednotlivci', pocet: 2, rows: [[1, 'Zahořany', '2 b.'], [2, 'Jinočany', '4 b.']] },
        { kat: 'Dorostenci střední', typ: 'jednotlivci', pocet: 8, rows: [[1, 'Jíloviště', '2 b.'], [2, 'Zahořany', '4 b.'], [3, 'Středokluky', '6 b.']] },
        { kat: 'Dorostenci starší', typ: 'jednotlivci', pocet: 5, rows: [[1, 'Psáry', '2 b.'], [2, 'Psáry', '6 b.'], [3, 'Solopisky', '7 b.']] },
        { kat: 'Dorostenky mladší', typ: 'jednotlivci', pocet: 2, rows: [[1, 'Zahořany', '2 b.'], [2, 'Solopisky', '4 b.']] },
        { kat: 'Dorostenky střední', typ: 'jednotlivci', pocet: 4, rows: [[1, 'Psáry', '3 b.'], [2, 'Psáry', '5 b.'], [3, 'Psáry', '5 b.']] },
        { kat: 'Dorostenky starší', typ: 'jednotlivci', pocet: 6, rows: [[1, 'Jílové u Prahy', '2 b.'], [2, 'Jíloviště', '5 b.'], [3, 'Jíloviště', '8 b.']] }
      ]
    },
    {
      id: 'ps', nazev: 'Okresní soutěž v požárním sportu', podtitul: 'družstva mužů a žen', dospeli: true,
      terminy: [{ d: '2025-05-31', misto: 'Zahořany, hasičská louka u rybníka' }],
      poradatel: 'OSH Praha-západ, odborná rada sportu', kategorie: ['muži', 'ženy'],
      info: [['Disciplíny', 'běh na 100 m s překážkami, štafeta 4 × 100 m, požární útok'], ['Velitel soutěže', 'Petr Kučera'], ['Hlavní rozhodčí', 'Filip Jankovec']],
      dokumenty: [['Propozice', 'souteze/2025/ps/propozice.pdf'], ['Výsledky – muži', 'souteze/2025/ps/vys-muzi.pdf'], ['Výsledky – ženy', 'souteze/2025/ps/vys-zeny.pdf']],
      vysledky: [
        { kat: 'Muži', typ: 'druzstva', rows: [[1, 'Zahořany', '4 b.'], [2, 'Sloup', '6 b.']] },
        { kat: 'Ženy', typ: 'druzstva', rows: [[1, 'Zahořany', '4 b.'], [2, 'Čisovice', '6 b.']] }
      ]
    },
    {
      id: '60m', nazev: 'Běh na 60 m s překážkami', podtitul: 'okresní kolo jednotlivců',
      terminy: [{ d: '2025-06-01', misto: 'Zahořany, hasičské cvičiště' }],
      poradatel: 'Okresní odborná rada mládeže', kategorie: ['mladší', 'starší'],
      info: [['Pokusy', '2, počítá se lepší']],
      dokumenty: [['Organizační zabezpečení', 'souteze/2025/60m/OZ.pdf'], ['Přihláška (xlsx)', 'souteze/2025/60m/prihlasky.xlsx'],
        ['Výsledky – mladší chlapci', 'souteze/2025/60m/vys-mladsi_chlapci.pdf'], ['Výsledky – mladší dívky', 'souteze/2025/60m/vys-mladsi_divky.pdf'],
        ['Výsledky – starší chlapci', 'souteze/2025/60m/vys-starsi_chlapci.pdf'], ['Výsledky – starší dívky', 'souteze/2025/60m/vys-starsi_divky.pdf']],
      vysledky: [
        { kat: 'Mladší chlapci', typ: 'jednotlivci', pocet: 33, rows: [[1, 'Zahořany', '15,58 s'], [2, 'Sloup', '18,74 s'], [3, 'Středokluky', '19,92 s']] },
        { kat: 'Mladší dívky', typ: 'jednotlivci', pocet: 36, rows: [[1, 'Jílové u Prahy', '18,11 s'], [2, 'Jílové u Prahy', '18,89 s'], [3, 'Štěchovice', '19,14 s']] },
        { kat: 'Starší chlapci', typ: 'jednotlivci', pocet: 18, rows: [[1, 'Středokluky', '14,05 s'], [2, 'Zahořany', '14,23 s'], [3, 'Zahořany', '14,58 s']] },
        { kat: 'Starší dívky', typ: 'jednotlivci', pocet: 23, rows: [[1, 'Zahořany', '13,79 s'], [2, 'Zahořany', '14,05 s'], [3, 'Psáry', '14,19 s']] }
      ]
    },
    {
      id: 'pohar', nazev: 'Dětská hasičská liga v požárním útoku', podtitul: '1. ročník (od 2026 Pohár rady mládeže), 4 kola',
      terminy: [
        { d: '2025-04-27', misto: 'Bojanovice, fotbalové hřiště', pozn: '1. kolo – SDH Sloup a Bojanovice' },
        { d: '2025-06-14', misto: 'Horoměřice, hasičské hřiště', pozn: '2. kolo – SDH Horoměřice' },
        { d: '2025-06-15', misto: 'Horoměřice, hasičské hřiště', pozn: '3. kolo – SDH Horoměřice' },
        { d: '2025-09-13', misto: 'Psáry, hasičské hřiště', pozn: '4. kolo – Psárská proudnice' }
      ],
      poradatel: 'Rada mládeže OSH a pořádající SDH', kategorie: ['přípravka', 'mladší', 'starší', 'smíšený dorost'],
      info: [['Startovné', '200 Kč za družstvo na každém kole'], ['Hodnocení', 'družstvo musí absolvovat alespoň polovinu kol']],
      dokumenty: [['Pravidla 2025', 'souteze/2025/liga/pravidla.pdf'], ['Přehled přihlášených družstev', 'souteze/2025/liga/prehled.pdf'], ['Celkové bodování (xlsx)', 'souteze/2025/liga/celkove.xlsx'],
        ['Pozvánka 1. kolo', 'souteze/2025/liga/k1-pozvanka.pdf'], ['Pozvánka 2. kolo', 'souteze/2025/liga/k2-pozvanka.pdf'], ['Pozvánka 3. kolo', 'souteze/2025/liga/k3-pozvanka.pdf'],
        ['Výsledky 2. kolo', 'souteze/2025/liga/vys-2k.pdf'], ['Výsledky 3. kolo', 'souteze/2025/liga/vys-3k.pdf']],
      kola: ['Bojanovice 27. 4.', 'Horoměřice 14. 6.', 'Horoměřice 15. 6.', 'Psáry 13. 9.'],
      vysledky: [
        { kat: 'Přípravka', typ: 'druzstva', rows: [[1, 'Sloup', '14 b.', [4, 4, 4, 2]], [2, 'Psáry', '10 b.', [3, 3, 0, 4]], [3, 'Horoměřice', '10 b.', [2, 2, 3, 3]]] },
        { kat: 'Mladší', typ: 'druzstva', proudar: 'LP Sloup A – 16,71 s', rows: [
          [1, 'Sloup A', '39 b.', [11, 11, 11, 6]], [2, 'Štěchovice A', '37 b.', [8, 9, 10, 10]], [3, 'Horoměřice A', '37 b.', [10, 10, 9, 8]], [4, 'Sloup C', '27 b.', [6, 8, 8, 5]],
          [5, 'Štěchovice B', '25 b.', [3, 7, 6, 9]], [6, 'Psáry', '22 b.', [2, 6, 7, 7]], [7, 'Sloup B', '21 b.', [7, 3, 0, 11]], [8, 'Úholičky', '17 b.', [4, 4, 5, 4]], [9, 'Horoměřice B', '13 b.', [1, 5, 4, 3]]] },
        { kat: 'Starší', typ: 'druzstva', proudar: 'PP Horoměřice A – 14,68 s', rows: [
          [1, 'Sloup', '20 b.', [6, 6, 5, 3]], [2, 'Horoměřice A', '20 b.', [4, 4, 6, 6]], [3, 'Psáry', '13 b.', [2, 5, 2, 4]], [4, 'Zahořany', '10 b.', [5, 0, 0, 5]], [5, 'Horoměřice B', '10 b.', [3, 2, 4, 1]], [6, 'Úholičky', '9 b.', [1, 3, 3, 2]]] },
        { kat: 'Smíšený dorost', typ: 'druzstva', proudar: 'PP Sloup A – 19,22 s', rows: [
          [1, 'Sloup A', '22 b.', [5, 6, 6, 5]], [2, 'Horoměřice', '17 b.', [4, 5, 5, 3]], [3, 'Psáry', '13 b.', [3, 4, 4, 2]], [4, 'Sloup B', '12 b.', [1, 3, 2, 6]], [5, 'Úholičky', '11 b.', [2, 2, 3, 4]]] }
      ]
    },
    {
      id: 'zhvb', nazev: 'Závod hasičské všestrannosti a brannosti', podtitul: 'okresní kolo ZHVB',
      terminy: [{ d: '2025-10-05', misto: 'Úholičky' }],
      poradatel: 'Rada mládeže OSH', kategorie: ['přípravka', 'mladší', 'starší', 'dorost'],
      info: [['Stanoviště', 'střelba / hod na cíl, orientace, uzlování, brannost, PO, první pomoc, ochrana obyvatelstva'], ['Hodnocení', 'výsledný čas = čas na trati + trestné minuty']],
      dokumenty: [['Organizační zabezpečení', 'souteze/2025/zhvb/OZ.pdf'], ['Prováděcí směrnice ZHVB OSH PZ', 'souteze/2025/zhvb/smernice.docx'],
        ['Výsledky – přípravka', 'souteze/2025/zhvb/vys-pripravka.pdf'], ['Výsledky – mladší', 'souteze/2025/zhvb/vys-mladsi.pdf'], ['Výsledky – starší', 'souteze/2025/zhvb/vys-starsi.pdf'], ['Výsledky – dorost', 'souteze/2025/zhvb/vys-dorost.pdf']],
      vysledky: [
        { kat: 'Přípravka', typ: 'druzstva', rows: [[1, 'Zahořany', '0:40:32'], [2, 'Sloup', '0:42:07'], [3, 'Psáry', '0:44:08'], [4, 'Štěchovice', '0:47:01'], [5, 'Libeň', '0:48:59'], [6, 'Masečín A', '0:53:59'], [7, 'Horoměřice', '0:59:51'], [8, 'Masečín B', '1:11:07'], [9, 'Jíloviště', '1:26:48']] },
        { kat: 'Mladší', typ: 'druzstva', rows: [[1, 'Sloup A', '0:27:06'], [2, 'Zahořany A', '0:37:42'], [3, 'Psáry', '0:37:56'], [4, 'Sloup B', '0:39:58'], [5, 'Zahořany B', '0:41:04'], [6, 'Štěchovice B', '0:43:58'], [7, 'Jílové u Prahy A', '0:45:03'], [8, 'Úholičky', '0:47:01'], [9, 'Jílové u Prahy B', '0:48:37'], [10, 'Štěchovice A', '0:50:44'], [11, 'Jíloviště', '0:59:18'], [12, 'Středokluky', '1:01:56'], [13, 'Kamenný Újezdec A', '1:03:10'], [14, 'Čisovice', '1:07:11'], [15, 'Masečín', '1:07:20'], [16, 'Horoměřice', '1:10:08'], [17, 'Libeň', '1:13:03'], [18, 'Kamenný Újezdec B', '1:17:07']] },
        { kat: 'Starší', typ: 'druzstva', rows: [[1, 'Úholičky', '0:28:59'], [2, 'Sloup', '0:36:48'], [3, 'Zahořany A', '0:36:50'], [4, 'Psáry', '0:39:11'], [5, 'Horoměřice B', '0:40:33'], [6, 'Jílové u Prahy', '0:42:03'], [7, 'Libeň A', '0:50:14'], [8, 'Rudná', '0:50:32'], [9, 'Masečín', '0:52:27'], [10, 'Štěchovice', '0:52:32'], [11, 'Kamenný Újezdec', '0:53:50'], [12, 'Zahořany B', '0:54:32'], [13, 'Horoměřice A', '0:59:14'], [14, 'Mokropsy', '1:19:19'], [15, 'Libeň B', '1:30:37']] },
        { kat: 'Smíšený dorost', typ: 'druzstva', rows: [[1, 'Psáry', '0:38:35'], [2, 'Úholičky', '0:45:40'], [3, 'Čisovice', '1:06:49']] },
        { kat: 'Dorostenci', typ: 'druzstva', rows: [[1, 'Sloup', '0:37:44'], [2, 'Horoměřice', '0:51:37']] },
        { kat: 'Dorostenky', typ: 'druzstva', rows: [[1, 'Zahořany', '0:41:00']] }
      ]
    }
  ]
});
window.dispatchEvent && window.dispatchEvent(new Event('osh-data'));
