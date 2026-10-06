// Soutěže OSH Praha-západ — ročník 2020 (archiv; sezóna 2019/2020).
window.OSH_SOUTEZE_ARCHIV = (window.OSH_SOUTEZE_ARCHIV || []).filter(y => y.rocnik !== 2020);
window.OSH_SOUTEZE_ARCHIV.push({
  rocnik: 2020,
  sboryMH: ['Bojanovice', 'Čisovice', 'Jílové u Prahy', 'Jíloviště', 'Jinočany', 'Kamenný Újezdec', 'Lety', 'Libeň', 'Mníšek pod Brdy', 'Mokropsy', 'Psáry', 'Roztoky', 'Rudná', 'Sloup', 'Solopisky', 'Středokluky', 'Zahořany'],
  alias: { 'Roztoky u Prahy': 'Roztoky' },
  souteze: [
    {
      id: 'zhvb', nazev: 'Závod požárnické všestrannosti (ZPV)', podtitul: 'ročník 2019/2020',
      terminy: [{ d: '2019-10-12', misto: 'Psáry, ulice Na Vápence' }],
      poradatel: 'Okresní odborná rada mládeže', kategorie: ['přípravka', 'mladší', 'starší'],
      info: [['Hodnocení', 'výsledný čas = čas na trati + trestné minuty'], ['Poznámka', 'některá umístění se z výsledkové listiny nepodařilo převést – v tabulce chybí']],
      dokumenty: [['Organizační zabezpečení', 'souteze/2020/zhvb/OZ.pdf'], ['Přihláška (xlsx)', 'souteze/2020/zhvb/prihlasky.xlsx'], ['Výsledky', 'souteze/2020/zhvb/vysledky.pdf']],
      vysledky: [
        { kat: 'Přípravka', typ: 'druzstva', rows: [[1, 'Libeň A', '—'], [2, 'Zahořany', '—'], [3, 'Libeň B', '—'], [5, 'Sloup A', '—'], [6, 'Sloup B', '—'], [7, 'Psáry A', '—'], [9, 'Čisovice', '—'], [11, 'Sloup C', '—'], [12, 'Libeň C', '—'], [13, 'Psáry B', '—'], [16, 'Solopisky', '—']] },
        { kat: 'Mladší', typ: 'druzstva', rows: [[1, 'Zahořany', '—'], [2, 'Jílové u Prahy', '—'], [3, 'Sloup', '—'], [4, 'Libeň', '—'], [6, 'Čisovice', '—'], [7, 'Kamenný Újezdec', '—'], [8, 'Jinočany', '—'], [10, 'Roztoky u Prahy', '—'], [11, 'Jíloviště', '—'], [12, 'Solopisky', '—'], [13, 'Bojanovice', '—'], [14, 'Rudná', '—'], [15, 'Psáry', '—'], [17, 'Lety', '—'], [19, 'Mníšek pod Brdy', '—']] },
        { kat: 'Starší', typ: 'druzstva', rows: [[1, 'Sloup', '—'], [2, 'Jílové u Prahy B', '—'], [3, 'Jílové u Prahy A', '—'], [4, 'Bojanovice', '—'], [5, 'Zahořany', '—'], [6, 'Středokluky', '—'], [8, 'Libeň', '—'], [12, 'Psáry', '—'], [13, 'Jíloviště', '—'], [15, 'Mokropsy', '—'], [16, 'Solopisky', '—'], [17, 'Lety', '—'], [18, 'Jinočany', '—'], [19, 'Mníšek pod Brdy', '—'], [20, 'Čisovice', '—']] }
      ]
    }
  ]
});
window.dispatchEvent && window.dispatchEvent(new Event('osh-data'));
