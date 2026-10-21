/**
 * OSH data – souhrn po přihlášení (revize 10/2026, S4).
 *
 * Jedno volání místo osmi: ověří relaci (jako „ja“) a vrátí jen to, co aplikace potřebuje hned –
 * položky k vyřízení pro odznaky, zvonek a přehled. Plná data modulu (dokumenty, kalendář, žádosti, majetek,
 * příspěvky, změny sborů) si aplikace načte až při otevření obrazovky.
 * Každá část jen pro roli, která ji smí vidět (stejné kontroly jako v modulech).
 */

function apiSouhrn_(req) {
  const o = prihlaseny_(req.token);
  if (!o) return { ok: false, chyba: 'Nepřihlášen', odhlasen: true };
  const out = { ok: true, uzivatel: o };
  if (!Object.keys(o.role || {}).length) return out; // jen sbor – portál si načte sám
  const iso = r => Object.keys(r).reduce((x, k) => (x[k] = r[k] instanceof Date ? r[k].toISOString() : r[k], x), {});
  const cast = (k, fn) => { try { out[k] = fn(); } catch (e) { console.error('Souhrn ' + k + ': ' + e.message); } }; // chyba jedné části nezastaví ostatní
  const dnes = new Date(), za30 = new Date(Date.now() + 31 * 864e5), vcera = new Date(Date.now() - 864e5);

  if (o.role['Dokumenty'] || o.role['Správce'])
    cast('dokumenty', () => radky_('Dokumenty').filter(r => r['Stav'] === 'ke schválení').map(iso));

  if (o.role['Termíny'] || o.role['Správce'])
    cast('kalendar', () => {
      const data = [];
      Object.keys(KAL_LISTY).forEach(l => radky_(l).filter(r => r['ID'] && r['Stav'] !== 'zrušeno').forEach(r => {
        const od = new Date(r['Od'] || r['Datum']), doo = new Date(r['Do'] || r['Od'] || r['Datum']);
        if (!isNaN(od) && od <= za30 && (isNaN(doo) ? od : doo) >= vcera) data.push(Object.assign(iso(r), { list: l }));
      }));
      return data;
    });

  if (smiZadostiOkres_(o))
    cast('zadosti', () => radky_(LIST_ZADOSTI).filter(r => r['ID'] && r['Stav'] === 'podáno')
      .map(r => ({ 'ID': r['ID'], 'Název': r['Název'], 'Sbor': r['Sbor'], 'Stav': r['Stav'], 'Upraveno': iso({ u: r['Upraveno'] }).u || '' })));

  if (smiMajetek_(o))
    cast('vypujckyPo', () => {
      const z = CacheService.getScriptCache().get('mj_data'); // celá evidence z mezipaměti, jinak jen list Výpůjčky
      const vyp = z ? JSON.parse(z).vypujcky : mjNacist_(mjList_(MJ_VYP.soubor, MJ_VYP.list)).rows, d = mjDnes_();
      return vyp.filter(v => MJ_AKTIVNI_VYP.indexOf(v['Stav_výpůjčky']) >= 0 && v['Plánované_vrácení'] && v['Plánované_vrácení'] < d)
        .map(v => ({ _id: v._id, 'ID_Majetku': v['ID_Majetku'], 'Název_věci': v['Název_věci'], 'Jméno_příjmení': v['Jméno_příjmení'], 'Plánované_vrácení': v['Plánované_vrácení'], 'Stav_výpůjčky': v['Stav_výpůjčky'] }));
    });

  const pr = prRole_(o);
  if (pr)
    cast('prispevky', () => {
      const jmena = prJmena_(), pred14 = new Date(Date.now() - 14 * 864e5);
      return radky_(LIST_PRISPEVKY).filter(r => r['ID'] && ((pr === 'zveřejnit' && r['Stav'] === 'ke schválení') ||
          (normEmail_(r['Autor']) === o.email && (r['Stav'] === 'vráceno k úpravě' || (r['Stav'] === 'zveřejněno' && new Date(r['Zveřejněno']) >= pred14)))))
        .map(r => ({ 'ID': r['ID'], 'Titulek': r['Titulek'], 'Autor': normEmail_(r['Autor']), autorJmeno: jmena[normEmail_(r['Autor'])] || '', 'Stav': r['Stav'],
          'Poznámka': r['Poznámka'] || '', 'Upraveno': iso({ u: r['Upraveno'] }).u || '', 'Zveřejněno': iso({ u: r['Zveřejněno'] }).u || '' }));
    });

  if (smiSbory_(o))
    cast('zmeny', () => radky_(LIST_ZMENY_SBORU).filter(r => r['ID'] && r['Stav'] === 'podáno').map(zmenaJson_)
      .map(z => ({ ID: z.ID, Sbor: z.Sbor, Stav: z.Stav, zmeny: z.zmeny || [] })));

  if (smiSouteze_(o)) // soutěže s výsledky ověřenými hlavním rozhodčím → ke zveřejnění
    cast('souteze', () => soSouteze_().filter(s => s.stav === 'ověřeno' && smiSouteze_(o, s.pro)).map(s => ({ id: s.id, nazev: s.nazev, stav: s.stav, od: s.od })));

  if (smiPrihlaskyOkres_(o))
    cast('prihlasky', () => radky_(LIST_PRIHLASKY).filter(r => r['ID'] && r['Stav'] === 'sken u okresu')
      .map(r => ({ 'ID': r['ID'], 'Jméno': r['Jméno'], 'Příjmení': r['Příjmení'], 'Sbor': r['Sbor'], 'Stav': r['Stav'] })));

  out.dnes = dnes.toISOString();
  return out;
}
