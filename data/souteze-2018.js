// Soutěže OSH Praha-západ — ročník 2018 (archiv; sezóna 2017/2018). Výsledky bez uvedení sborů – do statistik nepřevedeny.
window.OSH_SOUTEZE_ARCHIV = (window.OSH_SOUTEZE_ARCHIV || []).filter(y => y.rocnik !== 2018);
window.OSH_SOUTEZE_ARCHIV.push({
  rocnik: 2018,
  sboryMH: [],
  alias: {},
  souteze: [
    {
      id: 'plamen', nazev: 'Hra Plamen – okresní kolo', podtitul: 'ročník 2017/2018',
      terminy: [{ d: '2018-05-19', misto: 'Libeň, fotbalové hřiště' }],
      poradatel: 'Okresní odborná rada mládeže', kategorie: ['mladší', 'starší'],
      info: [['Výsledky', 'na disku jsou jen OZ a přihlášky – výsledky doplňte']],
      dokumenty: [['Organizační zabezpečení', 'souteze/2018/plamen/OZ.pdf'], ['Přihláška (xlsx)', 'souteze/2018/plamen/prihlasky.xlsx']],
      vysledky: []
    },
    {
      id: 'dorost', nazev: 'Okresní soutěž dorostu', podtitul: '1. kolo soutěže dorostu',
      terminy: [{ d: '2018-06-03', misto: 'Praha-Třebonice, hasičské cvičiště (ul. Pod Náplavkou)' }],
      poradatel: 'Okresní odborná rada mládeže', kategorie: ['dorostenci', 'dorostenky'],
      info: [['Výsledky', 'výsledkové listiny uvádějí jen jména bez sborů, proto nejsou ve statistikách sborů']],
      dokumenty: [['Organizační zabezpečení', 'souteze/2018/dorost/OZ.pdf'], ['Přihláška (xlsx)', 'souteze/2018/dorost/prihlasky.xlsx'],
        ['Výsledky – dorostenci střední', 'souteze/2018/dorost/vys-dorci_stredni.pdf'], ['Výsledky – dorostenci starší', 'souteze/2018/dorost/vys-dorci_starsi.pdf'],
        ['Výsledky – dorostenky mladší', 'souteze/2018/dorost/vys-dorky_mladsi.pdf'], ['Výsledky – dorostenky střední', 'souteze/2018/dorost/vys-dorky_stredni.pdf'],
        ['Výsledky – dorostenky starší', 'souteze/2018/dorost/vys-dorky_starsi.pdf'], ['Výsledky – družstva dorostenek', 'souteze/2018/dorost/vys-dorky_druzstva.pdf']],
      vysledky: []
    }
  ]
});
window.dispatchEvent && window.dispatchEvent(new Event('osh-data'));
