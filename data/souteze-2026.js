// Soutěže mládeže OSH Praha-západ — ročník 2026.
// Vytaženo z OZ, přihlášek a výsledkových listin na sdíleném disku (složka „Mládež“).
// Formát je připravený tak, aby šel později plnit z jedné Google tabulky (1 řádek = 1 umístění).
window.OSH_SOUTEZE = {
  rocnik: 2026,
  // Sbory, které se v roce 2026 zúčastnily alespoň jedné okresní soutěže mládeže (podle výsledkových listin).
  sboryMH: ['Čisovice', 'Horoměřice', 'Jílové u Prahy', 'Jíloviště', 'Jinočany', 'Kamenný Újezdec', 'Libeň', 'Masečín', 'Mokropsy', 'Psáry', 'Roztoky', 'Sloup', 'Středokluky', 'Štěchovice', 'Úholičky', 'Zahořany'],
  // Kontaktní osoby pro mládež podle pozvánek na kola Poháru rady mládeže.
  kontaktyMH: { 'Sloup': 'Michal Zrno', 'Štěchovice': 'Kateřina Rožníčková', 'Horoměřice': 'Jana Mertová', 'Psáry': 'Petra Honková, Jan Honek', 'Čisovice': 'Iveta Dvořáková', 'Kamenný Újezdec': 'Jiří Hartman' },
  alias: { 'Roztoky u Prahy': 'Roztoky' },
  souteze: [
    {
      id: 'uzlovka', nazev: 'Uzlová štafeta', podtitul: '14. ročník mladších, 2. ročník přípravky',
      terminy: [{ d: '2026-03-21', misto: 'Jinočany, sokolovna' }],
      poradatel: 'Okresní odborná rada mládeže', kategorie: ['přípravka', 'mladší'],
      info: [
        ['Disciplíny', 'jednotlivci a družstva, 2 pokusy, počítá se rychlejší'],
        ['Přihlášky', 'do 15. 3. 2026 e-mailem (tabulka Excel)'],
        ['Startovné', '300 Kč na SDH, na účet OSH 29331110/2010'],
        ['Náčelník štábu', 'Michal Zrno'], ['Hlavní rozhodčí', 'Vojtěch Vilím']
      ],
      dokumenty: [
        ['Organizační zabezpečení', 'souteze/2026/uzlovka/OZ.pdf'],
        ['Výsledky – přípravka družstva', 'souteze/2026/uzlovka/vys-pripravka_druzstva.pdf'],
        ['Výsledky – přípravka jednotlivci', 'souteze/2026/uzlovka/vys-pripravka_jednotlivci.pdf'],
        ['Výsledky – mladší družstva', 'souteze/2026/uzlovka/vys-mladsi_druzstva.pdf'],
        ['Výsledky – mladší jednotlivci', 'souteze/2026/uzlovka/vys-mladsi_jednotlivci.pdf']
      ],
      vysledky: [
        { kat: 'Přípravka – družstva', typ: 'druzstva', rows: [
          [1, 'Zahořany A', '18,41 s'], [2, 'Kamenný Újezdec', '22,29 s'], [3, 'Čisovice', '26,80 s'], [4, 'Libeň', '34,28 s'],
          [5, 'Jinočany', '35,77 s'], [6, 'Horoměřice A', '36,47 s'], [7, 'Masečín A', '38,30 s'], [8, 'Zahořany B', '39,62 s'],
          [9, 'Sloup', '40,40 s'], [10, 'Horoměřice B', '48,56 s'], [11, 'Masečín B', '61,48 s'], [12, 'Psáry', '61,66 s'], [13, 'Jíloviště', '71,88 s']] },
        { kat: 'Mladší – družstva', typ: 'druzstva', rows: [
          [1, 'Zahořany', '27,06 s'], [2, 'Psáry', '29,97 s'], [3, 'Sloup', '31,43 s'], [4, 'Úholičky', '34,78 s'],
          [5, 'Jílové u Prahy', '35,75 s'], [6, 'Libeň', '41,33 s'], [7, 'Štěchovice', '44,04 s'], [8, 'Jíloviště', '47,11 s'],
          [9, 'Masečín', '51,50 s'], [10, 'Kamenný Újezdec', '52,51 s'], [11, 'Jinočany', '56,39 s'], [12, 'Horoměřice', 'neplatný']] }
      ]
    },
    {
      id: 'plamen', nazev: 'Hra Plamen – okresní kolo', podtitul: 'ročník 2025/2026, dvě kola',
      terminy: [{ d: '2026-04-25', misto: 'Roztoky u Prahy, fotbalové hřiště', pozn: '1. kolo – štafeta CTIF, 4 × 60 m' },
                { d: '2026-05-16', misto: 'Masečín, fotbalové hřiště', pozn: '2. kolo – požární útok, útok CTIF, štafeta dvojic' }],
      poradatel: 'OORM, 1. okrsek a SDH Masečín', kategorie: ['přípravka', 'mladší', 'starší'],
      info: [
        ['Družstvo', '7–10 členů, nejméně 4 z jednoho SDH'],
        ['Nahlášení', 'počet účastníků do 12. 4. 2026 na oorm@oshpz.cz'],
        ['Rozhodčí', 'min. 3 pomocní rozhodčí z každého SDH'],
        ['Náčelník štábu', 'Michal Zrno'], ['Hlavní rozhodčí', 'Vojtěch Vilím']
      ],
      dokumenty: [
        ['OZ 1. kolo', 'souteze/2026/plamen/OZ1.pdf'], ['OZ 2. kolo', 'souteze/2026/plamen/OZ2.pdf'],
        ['Přihláška (xlsx)', 'souteze/2026/plamen/prihlasky.xlsx'],
        ['Celkové výsledky – přípravka', 'souteze/2026/plamen/vys-pripravka.pdf'],
        ['Celkové výsledky – mladší', 'souteze/2026/plamen/vys-mladsi.pdf'],
        ['Celkové výsledky – starší', 'souteze/2026/plamen/vys-starsi.pdf']
      ],
      vysledky: [
        { kat: 'Přípravka', typ: 'druzstva', rows: [[1, 'Zahořany', '4 b.'], [2, 'Sloup', '5 b.'], [3, 'Masečín', '9 b.']] },
        { kat: 'Mladší', typ: 'druzstva', rows: [
          [1, 'Zahořany A', '7 b.'], [2, 'Sloup A', '10 b.'], [3, 'Sloup B', '25 b.'], [4, 'Zahořany B', '27 b.'], [5, 'Jílové u Prahy', '30 b.'],
          [6, 'Štěchovice', '31 b.'], [7, 'Úholičky', '40 b.'], [8, 'Masečín', '44 b.'], [9, 'Sloup C', '44 b.'], [10, 'Psáry', '44 b.'],
          [11, 'Kamenný Újezdec A', '50 b.'], [12, 'Jíloviště', '52 b.'], [13, 'Jinočany', '65 b.'], [14, 'Libeň', '65 b.'],
          [15, 'Kamenný Újezdec B', '73 b.'], [16, 'Mokropsy', '74 b.'], [17, 'Čisovice', '75 b.']] },
        { kat: 'Starší', typ: 'druzstva', rows: [
          [1, 'Zahořany A', '5 b.'], [2, 'Zahořany B', '14 b.'], [3, 'Úholičky', '24 b.'], [4, 'Jílové u Prahy', '24 b.'], [5, 'Sloup', '25 b.'],
          [6, 'Psáry', '26 b.'], [7, 'Štěchovice', '34 b.'], [8, 'Kamenný Újezdec', '39 b.'], [9, 'Masečín', '40 b.'], [10, 'Libeň', '51 b.'],
          [11, 'Mokropsy', '52 b.'], [12, 'Středokluky', '53 b.']] }
      ]
    },
    {
      id: '60m', nazev: 'Běh na 60 m s překážkami', podtitul: 'okresní kolo jednotlivců',
      terminy: [{ d: '2026-04-26', misto: 'Roztoky u Prahy, fotbalové hřiště' }],
      poradatel: 'Okresní odborná rada mládeže', kategorie: ['nejmladší', 'mladší', 'starší', 'nejstarší'],
      info: [
        ['Účast', 'max. 5 závodníků v každé kategorii, tj. 20 na SDH'],
        ['Nahlášení', 'jména do 12. 4. 2026 na oorm@oshpz.cz'],
        ['Pokusy', '2, počítá se lepší'], ['Hlavní rozhodčí', 'Vojtěch Vilím']
      ],
      dokumenty: [
        ['Organizační zabezpečení', 'souteze/2026/60m/OZ.pdf'], ['Přihláška (xlsx)', 'souteze/2026/60m/prihlasky.xlsx'],
        ['Výsledky – mladší chlapci', 'souteze/2026/60m/vys-mladsi_chlapci.pdf'], ['Výsledky – mladší dívky', 'souteze/2026/60m/vys-mladsi_divky.pdf'],
        ['Výsledky – starší chlapci', 'souteze/2026/60m/vys-starsi_chlapci.pdf'], ['Výsledky – starší dívky', 'souteze/2026/60m/vys-starsi_divky.pdf']
      ],
      vysledky: [
        { kat: 'Nejmladší chlapci', typ: 'jednotlivci', pocet: 8, rows: [[1, 'Štěchovice', '23,45 s'], [2, 'Masečín', '27,16 s'], [3, 'Úholičky', '36,99 s']] },
        { kat: 'Nejmladší dívky', typ: 'jednotlivci', pocet: 4, rows: [[1, 'Jílové u Prahy', '20,87 s'], [2, 'Zahořany', '25,42 s'], [3, 'Jíloviště', '33,47 s']] },
        { kat: 'Mladší chlapci', typ: 'jednotlivci', pocet: 20, rows: [[1, 'Zahořany', '15,02 s'], [2, 'Sloup', '16,61 s'], [3, 'Zahořany', '17,00 s']] },
        { kat: 'Mladší dívky', typ: 'jednotlivci', pocet: 35, rows: [[1, 'Jílové u Prahy', '16,07 s'], [2, 'Jílové u Prahy', '16,17 s'], [3, 'Jílové u Prahy', '16,60 s']] },
        { kat: 'Starší chlapci', typ: 'jednotlivci', pocet: 9, rows: [[1, 'Libeň', '15,36 s'], [2, 'Čisovice', '16,42 s'], [3, 'Zahořany', '16,71 s']] },
        { kat: 'Starší dívky', typ: 'jednotlivci', pocet: 20, rows: [[1, 'Zahořany', '13,68 s'], [2, 'Jílové u Prahy', '14,77 s'], [3, 'Jílové u Prahy', '15,10 s']] },
        { kat: 'Nejstarší chlapci', typ: 'jednotlivci', pocet: 10, rows: [[1, 'Psáry', '14,42 s'], [2, 'Zahořany', '14,64 s'], [3, 'Jílové u Prahy', '15,29 s']] },
        { kat: 'Nejstarší dívky', typ: 'jednotlivci', pocet: 9, rows: [[1, 'Psáry', '14,02 s'], [2, 'Zahořany', '14,68 s'], [3, 'Psáry', '14,86 s']] }
      ]
    },
    {
      id: 'dorost', nazev: 'Okresní soutěž dorostu', podtitul: 'jednotlivci a družstva',
      terminy: [{ d: '2026-04-26', misto: 'Roztoky u Prahy, fotbalové hřiště' }],
      poradatel: 'OORM ve spolupráci s 1. okrskem', kategorie: ['dorostenci', 'dorostenky'],
      info: [
        ['Družstva', '5–8 členů, ročníky 2008–2013'],
        ['Jednotlivci', 'mladší (2012–13), střední (2010–11), starší (2008–09)'],
        ['Přihlášky', 'do 12. 4. 2026 na oorm@oshpz.cz'],
        ['Požární útok', 'v rámci 1. kola Poháru rady mládeže']
      ],
      dokumenty: [
        ['Organizační zabezpečení', 'souteze/2026/dorost/OZ.pdf'], ['Přihláška (xlsx)', 'souteze/2026/dorost/prihlasky.xlsx'],
        ['Pořadí družstev 100 m – dorostenky', 'souteze/2026/dorost/vys-druzstva-100m-dorky.pdf']
      ],
      vysledky: [
        { kat: 'Družstva dorostenek – 100 m př.', typ: 'druzstva', rows: [[1, 'Zahořany', '104,47 s'], [2, 'Čisovice', '122,94 s']] },
        { kat: 'Dorostenci mladší', typ: 'jednotlivci', pocet: 3, rows: [[1, 'Zahořany', '3 b.'], [2, 'Čisovice', '4 b.'], [3, 'Zahořany', '5 b.']] },
        { kat: 'Dorostenci střední', typ: 'jednotlivci', pocet: 6, rows: [[1, 'Zahořany', '2 b.'], [2, 'Zahořany', '5 b.'], [3, 'Čisovice', '5 b.']] },
        { kat: 'Dorostenci starší', typ: 'jednotlivci', pocet: 2, rows: [[1, 'Psáry', '3 b.'], [2, 'Jíloviště', '3 b.']] },
        { kat: 'Dorostenky střední', typ: 'jednotlivci', pocet: 1, rows: [[1, 'Jíloviště', '2 b.']] },
        { kat: 'Dorostenky starší', typ: 'jednotlivci', pocet: 5, rows: [[1, 'Psáry', '2 b.'], [2, 'Psáry', '4 b.'], [3, 'Jíloviště', '7 b.']] }
      ]
    },
    {
      id: 'pohar', nazev: 'Pohár rady mládeže v požárním útoku', podtitul: '2. ročník, 6 kol',
      terminy: [
        { d: '2026-05-23', misto: 'Davle, fotbalové hřiště', pozn: '1. kolo – pořádá SDH Sloup a 9. okrsek' },
        { d: '2026-05-24', misto: 'Davle, fotbalové hřiště', pozn: '2. kolo – pořádá SDH Štěchovice a 10. okrsek' },
        { d: '2026-06-13', misto: 'Horoměřice, hasičské hřiště', pozn: '3. kolo – pořádá SDH Horoměřice' },
        { d: '2026-06-14', misto: 'Horoměřice, hasičské hřiště', pozn: '4. kolo – pořádá SDH Horoměřice' },
        { d: '2026-09-06', misto: 'Psáry, hasičské hřiště', pozn: '5. kolo – pořádá SDH Psáry' },
        { d: '2026-09-13', misto: 'Čisovice, Hasičská louka', pozn: '6. kolo – pořádá SDH Čisovice' }
      ],
      poradatel: 'Rada mládeže OSH a pořádající SDH', kategorie: ['přípravka', 'mladší', 'starší', 'smíšený dorost'],
      info: [
        ['Registrace', '500 Kč za družstvo do 30. 4. 2026, max. 40 družstev'],
        ['Startovné', '200 Kč za družstvo na každém kole'],
        ['Bodování', 'vítěz kola získá tolik bodů, kolik je v kategorii přihlášených družstev'],
        ['Hodnocení', 'družstvo musí absolvovat alespoň polovinu kol']
      ],
      dokumenty: [
        ['Pravidla 2026', 'souteze/2026/pohar/pravidla.pdf'],
        ['Celkové bodování (xlsx)', 'souteze/2026/pohar/celkove.xlsx'],
        ['Pozvánka 1. kolo', 'souteze/2026/pohar/k1-pozvanka.pdf'], ['Pozvánka 2. kolo', 'souteze/2026/pohar/k2-pozvanka.pdf'],
        ['Pozvánka 3. kolo', 'souteze/2026/pohar/k3-pozvanka.pdf'], ['Pozvánka 4. kolo', 'souteze/2026/pohar/k4-pozvanka.pdf'],
        ['Výsledky 3. kolo', 'souteze/2026/pohar/vys-3k.pdf'], ['Výsledky 6. kolo', 'souteze/2026/pohar/vys-6k.pdf']
      ],
      kola: ['Davle 23. 5.', 'Davle 24. 5.', 'Horoměřice 13. 6.', 'Horoměřice 14. 6.', 'Psáry 6. 9.', 'Čisovice 13. 9.'],
      vysledky: [
        { kat: 'Přípravka', typ: 'druzstva', proudar: null, rows: [
          [1, 'Sloup', '19 b.', [2, 3, 4, 4, 3, 3]], [2, 'Zahořany', '18 b.', [4, 4, 0, 2, 4, 4]], [3, 'Horoměřice', '15 b.', [3, 2, 3, 3, 2, 2]], [4, 'Psáry', '4 b.', [1, 0, 0, 1, 1, 1]]] },
        { kat: 'Mladší', typ: 'druzstva', proudar: 'PP SDH Sloup – 14,22 s', rows: [
          [1, 'Sloup A', '60 b.', [10, 10, 10, 10, 10, 10]], [2, 'Zahořany A', '41 b.', [9, 9, 0, 5, 9, 9]], [3, 'Štěchovice', '40 b.', [8, 8, 7, 4, 8, 5]],
          [4, 'Sloup B', '36 b.', [7, 2, 9, 7, 3, 8]], [5, 'Úholičky', '36 b.', [3, 5, 8, 8, 6, 6]], [6, 'Psáry A', '33 b.', [4, 4, 5, 9, 7, 4]],
          [7, 'Sloup C', '31 b.', [5, 7, 6, 6, 4, 3]], [8, 'Zahořany B', '24 b.', [6, 6, 0, 0, 5, 7]], [9, 'Horoměřice', '15 b.', [2, 3, 4, 3, 2, 1]]] },
        { kat: 'Starší', typ: 'druzstva', proudar: 'LP SDH Sloup – 14,65 s', rows: [
          [1, 'Sloup A', '35 b.', [8, 2, 8, 7, 2, 8]], [2, 'Zahořany A', '35 b.', [7, 8, 0, 5, 8, 7]], [3, 'Sloup B', '32 b.', [6, 7, 4, 8, 4, 3]],
          [4, 'Úholičky', '30 b.', [1, 6, 5, 6, 6, 6]], [5, 'Horoměřice', '24 b.', [3, 4, 7, 4, 5, 1]], [6, 'Psáry', '23 b.', [4, 5, 6, 3, 1, 4]],
          [7, 'Zahořany B', '17 b.', [5, 3, 0, 0, 7, 2]], [8, 'Štěchovice', '16 b.', [2, 1, 3, 2, 3, 5]]] },
        { kat: 'Smíšený dorost', typ: 'druzstva', proudar: 'PP SDH Sloup – 17,24 s', rows: [
          [1, 'Sloup', '31 b.', [1, 6, 6, 6, 6, 6]], [2, 'Psáry', '26 b.', [5, 5, 2, 5, 5, 4]], [3, 'Zahořany', '19 b.', [6, 4, 0, 0, 4, 5]],
          [4, 'Úholičky', '19 b.', [4, 2, 5, 4, 3, 1]], [5, 'Horoměřice A', '15 b.', [3, 3, 4, 2, 1, 2]], [6, 'Horoměřice B', '13 b.', [1, 1, 3, 3, 2, 3]]] }
      ]
    },
    {
      id: 'zhvb', nazev: 'Závod hasičské všestrannosti a brannosti', podtitul: 'okresní kolo ZHVB',
      terminy: [{ d: '2026-10-03', misto: 'Psáry, ulice Na Vápence' }],
      poradatel: 'Rada mládeže ve spolupráci s SDH Psáry', kategorie: ['přípravka', 'mladší', 'starší', 'dorost'],
      uzaverka: '2026-09-22',
      info: [
        ['Prezence', 'přípravka a mladší 8:00, starší 10:00, dorost 13:00'],
        ['Nahlášení', 'počty hlídek a 2 pomocní rozhodčí do 22. 9. 2026 (SMS 604 173 028 nebo oorm@oshpz.cz)'],
        ['Hlídky', 'přípravka max. 2, mladší + starší max. 4, dorost 2 v každé kategorii'],
        ['Stanoviště', 'hod na cíl a střelba, orientace, uzlování, brannost, PO, první pomoc, ochrana obyvatelstva'],
        ['Startovné', '300 Kč na SDH do 11. 10. 2026'],
        ['Náčelník štábu', 'Jana Mertová'], ['Hlavní rozhodčí', 'Michal Zrno']
      ],
      dokumenty: [
        ['Organizační zabezpečení', 'souteze/2026/zhvb/OZ.pdf'], ['Přihláška (xlsx)', 'souteze/2026/zhvb/prihlasky.xlsx']
      ],
      vysledky: []
    }
  ]
};
