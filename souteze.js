/* Soutěže (B8) – výpočet pořadí v prohlížeči: závodní panel (zavod.html) ho potřebuje i bez signálu.
 * KOPIE soPoradi_ z apps-script/Souteze.gs – při změně pravidel upravit obě (server je zdroj pravdy pro web a PDF).
 * Požární útok: výsledný čas pokusu = delší z terčů L a P; platí lepší pokus; NP vždy za platnými;
 * shoda: „pravidla SH ČMS“ = součet obou pokusů (NP = 998 s, nenastoupil = 999 s), pak dělené místo; „horší pokus“ = rozhoduje čas horšího pokusu;
 * „rozhoduje pořadatel“ = pořadí při shodě určí hlavní rozhodčí. DIS, nenastoupil a bez výsledku jsou bez pořadí na konci. */
(function (koren) {
  const NP = 998, NENASTOUPIL = 999;
  const r2 = x => Math.round(Number(x) * 100) / 100;
  const casText = x => x == null || x === '' || isNaN(Number(x)) ? '' : r2(x).toFixed(2).replace('.', ',');
  /** „17,84“, „17.84“, „1:05,3“ → sekundy (2 desetinná místa); prázdné → null; nesmysl → NaN */
  function casZTextu(t) {
    const s = String(t == null ? '' : t).trim().replace(/\s+/g, '').replace(',', '.');
    if (!s) return null;
    let m = s.match(/^(\d{1,2}):(\d{1,2}(?:\.\d{1,2})?)$/);
    if (m && Number(m[2]) < 60) return r2(Number(m[1]) * 60 + Number(m[2]));
    m = s.match(/^\d{1,3}(?:\.\d{1,2})?$/);
    return m && Number(s) > 0 ? r2(Number(s)) : NaN;
  }

  function poradi(nast, druzstva, vysledky) {
    const pokusu = nast.pokusy === 1 ? 1 : 2, rucne = nast.shoda === 'rozhoduje pořadatel', horsi = nast.shoda === 'horší pokus';
    const podle = {};
    vysledky.forEach(v => { (podle[v.prihlaska] = podle[v.prihlaska] || {})[v.pokus] = v; });
    const hodnota = v => !v ? NENASTOUPIL : v.platnost === 'platný' && v.cas > 0 ? r2(v.cas) : v.platnost === 'NP' ? NP : NENASTOUPIL;
    const kats = (nast.kategorie || []).slice();
    druzstva.forEach(d => { if (d.stav !== 'odhlášeno' && kats.indexOf(d.kat) < 0) kats.push(d.kat); });
    return kats.map(kat => {
      const rows = druzstva.filter(d => d.kat === kat && d.stav !== 'odhlášeno').map(d => {
        const p = [];
        for (let i = 1; i <= pokusu; i++) p.push((podle[d.id] && podle[d.id][i]) || null);
        const hod = p.map(hodnota), nejl = Math.min.apply(null, hod), dis = p.some(v => v && v.platnost === 'DIS');
        const stav = dis ? 'DIS' : nejl < NP ? 'platný' : nejl === NP ? 'NP' : p.some(Boolean) ? 'nenastoupil' : 'bez výsledku';
        return { id: d.id, druzstvo: d.druzstvo, sbor: d.sbor, start: d.start, shodaRucne: d.shoda, stav: stav, nejlepsi: stav === 'platný' ? nejl : null,
          soucet: r2(hod.reduce((a, b) => a + b, 0)), horsi: Math.max.apply(null, hod), poradi: null, shoda: false, nerozhodnuto: false,
          vysledek: stav === 'platný' ? casText(nejl) + ' s' : stav === 'bez výsledku' ? '–' : stav,
          pokusy: p.map(v => v ? { casL: v.casL, casP: v.casP, cas: v.cas, platnost: v.platnost, poznamka: v.poznamka || '', trestne: v.trestne || 0 } : null) };
      });
      const hodn = rows.filter(r => r.stav === 'platný' || r.stav === 'NP'), ost = rows.filter(r => r.stav !== 'platný' && r.stav !== 'NP');
      const klic = r => r.stav === 'platný' ? r.nejlepsi : NP;
      const cmp = (a, b) => (klic(a) - klic(b)) ||
        (!rucne && pokusu === 2 ? (horsi ? a.horsi - b.horsi : a.soucet - b.soucet) : 0) ||
        (rucne && a.stav === 'platný' && b.stav === 'platný' ? (a.shodaRucne || 999) - (b.shodaRucne || 999) : 0);
      hodn.sort((a, b) => cmp(a, b) || (a.start || 999) - (b.start || 999) || String(a.druzstvo).localeCompare(String(b.druzstvo), 'cs'));
      hodn.forEach((r, i) => { r.poradi = i && cmp(hodn[i - 1], r) === 0 ? hodn[i - 1].poradi : i + 1; });
      hodn.forEach(r => {
        if (r.stav !== 'platný') return;
        const stejne = hodn.filter(x => x.stav === 'platný' && x.nejlepsi === r.nejlepsi);
        r.shoda = stejne.length > 1;
        r.nerozhodnuto = rucne && r.shoda && (stejne.some(x => !x.shodaRucne) || stejne.some(x => x !== r && x.shodaRucne === r.shodaRucne));
      });
      const PORADI_OST = { 'DIS': 1, 'nenastoupil': 2, 'bez výsledku': 3 };
      ost.sort((a, b) => PORADI_OST[a.stav] - PORADI_OST[b.stav] || (a.start || 999) - (b.start || 999));
      const vse = hodn.concat(ost);
      return { kat: kat, rows: vse, hotovo: vse.every(r => r.stav !== 'bez výsledku' && r.pokusy.every(Boolean) || r.stav === 'DIS'), nerozhodnuto: vse.some(r => r.nerozhodnuto) };
    });
  }

  /** Uzlová štafeta – KOPIE soUzlovka_ ze Souteze.gs (měnit obě). */
  function uzlovka(kat, cas, uzly, pomoc, starty) {
    const pripravka = /přípravk/i.test(kat), druzstva = !/jednotliv/i.test(kat), pocetUzlu = pripravka ? 3 : 5, minSpravne = pripravka ? 2 : 3, limit = pripravka ? 90 : 60;
    const n = (x, max) => Math.max(0, Math.min(max, Math.round(Number(x) || 0)));
    uzly = n(uzly, pocetUzlu); pomoc = n(pomoc, 10); starty = druzstva ? n(starty, 4) : 0;
    const trestne = 30 * uzly + 30 * pomoc + 10 * starty;
    const np = !(cas > 0) ? '' : cas > limit ? 'překročen limit ' + limit + ' s' : pocetUzlu - uzly < minSpravne ? 'méně než ' + minSpravne + ' správně uvázané uzly' : '';
    return { uzly: uzly, pomoc: pomoc, starty: starty, trestne: trestne, vysledny: cas > 0 ? r2(cas + trestne) : null, np: np, limit: limit, pocetUzlu: pocetUzlu, minSpravne: minSpravne, druzstva: druzstva };
  }

  const api = { poradi, uzlovka, casZTextu, casText, NP, NENASTOUPIL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else koren.OSH_PORADI = api;
})(typeof window !== 'undefined' ? window : globalThis);
