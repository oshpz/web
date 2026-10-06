// Soutěže OSH Praha-západ — ročník 2021 (archiv; sezóna 2020/2021, omezená covidem). Výsledky na disku nejsou.
window.OSH_SOUTEZE_ARCHIV = (window.OSH_SOUTEZE_ARCHIV || []).filter(y => y.rocnik !== 2021);
window.OSH_SOUTEZE_ARCHIV.push({
  rocnik: 2021,
  sboryMH: [],
  alias: {},
  souteze: [
    {
      id: 'zhvb', nazev: 'Závod požárnické všestrannosti (ZPV)', podtitul: 'ročník 2020/2021',
      terminy: [{ d: '2020-10-10', misto: 'Sloup u Davle, ulice U Jeřábu' }],
      poradatel: 'Okresní odborná rada mládeže', kategorie: ['mladší', 'starší'],
      info: [['Výsledky', 'na disku je jen organizační zabezpečení – výsledky doplňte']],
      dokumenty: [['Organizační zabezpečení', 'souteze/2021/zhvb/OZ.pdf']],
      vysledky: []
    },
    {
      id: 'plamen', nazev: 'Hra Plamen – nominační kemp starších', podtitul: 'ročník 2020/2021 – místo okresního kola (covid)',
      terminy: [{ d: '2021-05-30', misto: 'Zahořany u Mníšku pod Brdy' }],
      poradatel: 'Okresní odborná rada mládeže', kategorie: ['starší'],
      info: [['Účel', 'nominace družstva na krajské kolo hry Plamen'], ['Výsledky', 'na disku je jen organizační zabezpečení']],
      dokumenty: [['Organizační zabezpečení', 'souteze/2021/plamen/OZ-starsi.pdf']],
      vysledky: []
    },
    {
      id: 'dorost', nazev: 'Okresní soutěž dorostu', podtitul: 'jednotlivci a družstva',
      terminy: [{ d: '2021-05-30', misto: 'Zahořany u Mníšku pod Brdy' }],
      poradatel: 'Okresní odborná rada mládeže', kategorie: ['dorostenci', 'dorostenky'],
      info: [['Opatření', 'celý štáb testován na covid-19 v den konání'], ['Výsledky', 'na disku je jen organizační zabezpečení']],
      dokumenty: [['Organizační zabezpečení', 'souteze/2021/dorost/OZ.pdf']],
      vysledky: []
    },
    {
      id: 'uzlovka', nazev: 'Uzlová štafeta', podtitul: '10. ročník – mladší a starší',
      terminy: [{ d: '2021-11-06', misto: 'Středokluky, sokolovna' }],
      poradatel: 'Okresní odborná rada mládeže', kategorie: ['mladší', 'starší'],
      info: [['Disciplíny', 'jednotlivci a družstva, 2 pokusy'], ['Výsledky', 'na disku je jen organizační zabezpečení']],
      dokumenty: [['Organizační zabezpečení (Word)', 'souteze/2021/uzlovka/OZ.docx']],
      vysledky: []
    }
  ]
});
window.dispatchEvent && window.dispatchEvent(new Event('osh-data'));
