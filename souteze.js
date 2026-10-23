/* Soutěže (B8) – výpočet pořadí v prohlížeči: závodní panel (zavod.html) ho potřebuje i bez signálu.
 * KOPIE soPoradi_ z apps-script/Souteze.gs – při změně pravidel upravit obě (server je zdroj pravdy pro web a PDF).
 * Požární útok: výsledný čas pokusu = delší z terčů L a P; platí lepší pokus; NP vždy za platnými;
 * shoda: „pravidla SH ČMS“ = součet obou pokusů (NP = 998 s, nenastoupil = 999 s), pak dělené místo; „horší pokus“ = rozhoduje čas horšího pokusu;
 * „rozhoduje pořadatel“ = pořadí při shodě určí hlavní rozhodčí. DIS, nenastoupil a bez výsledku jsou bez pořadí na konci.
 * ZHVB (KOPIE soZhvb_ a soPoradiZhvb_): výsledný čas = trať − čekání + 60 s × trestné body; shoda → body, pak stanoviště K5, K7, K6, K4, K3, K2, K1.
 * Hra Plamen (KOPIE soPoradiPlamen_): umístění v disciplínách → body, shoda → PÚ, 4 × 60 m, PÚ CTIF, štafeta CTIF, dvojice. */
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
    if (nast.druh === 'ZHVB') return poradiZhvb(nast, druzstva, vysledky);
    if (nast.druh === 'Hra Plamen') return poradiPlamen(nast, druzstva, vysledky);
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
        const pn = p[hod.indexOf(nejl)];
        return { id: d.id, druzstvo: d.druzstvo, sbor: d.sbor, start: d.start, shodaRucne: d.shoda, stav: stav, nejlepsi: stav === 'platný' ? nejl : null, tbNejl: (pn && pn.trestne) || 0,
          soucet: r2(hod.reduce((a, b) => a + b, 0)), horsi: Math.max.apply(null, hod), poradi: null, shoda: false, nerozhodnuto: false,
          vysledek: stav === 'platný' ? casText(nejl) + ' s' : stav === 'bez výsledku' ? '–' : stav,
          pokusy: p.map(v => v ? { casL: v.casL, casP: v.casP, cas: v.cas, platnost: v.platnost, poznamka: v.poznamka || '', trestne: v.trestne || 0 } : null) };
      });
      const hodn = rows.filter(r => r.stav === 'platný' || r.stav === 'NP'), ost = rows.filter(r => r.stav !== 'platný' && r.stav !== 'NP');
      const klic = r => r.stav === 'platný' ? r.nejlepsi : NP;
      const cmp = (a, b) => (klic(a) - klic(b)) ||
        (!rucne && pokusu === 2 ? (horsi ? a.horsi - b.horsi : a.soucet - b.soucet) : 0) ||
        (nast.tbShoda && a.stav === 'platný' && b.stav === 'platný' ? a.tbNejl - b.tbNejl : 0) ||
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

  /** ZHVB – KOPIE soZhvb_ ze Souteze.gs (měnit obě). Pole: start, cil (čas dne v s), K1–K7 body 0–15, K8 chybějící razítka 0–3 (dorost, SŠ), c1–c8 čekání v s. */
  const ZHVB_STAN = ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8'], ZHVB_SHODA = ['K5', 'K7', 'K6', 'K4', 'K3', 'K2', 'K1'];
  function zhvb(kat, pole) {
    pole = pole || {};
    const k8 = /doros|SŠ/i.test(kat), stan = ZHVB_STAN.filter(k => k !== 'K8' || k8);
    const cislo = (x, max) => x === '' || x == null || isNaN(Number(x)) ? null : Math.max(0, Math.min(max, Math.round(Number(x))));
    const start = cislo(pole.start, 86399), cil = cislo(pole.cil, 86399), chybi = [], tb = {};
    if (start === null) chybi.push('start');
    if (cil === null) chybi.push('cíl');
    stan.forEach(k => { const n = cislo(pole[k], k === 'K8' ? 3 : 15); if (n === null) chybi.push(k); tb[k] = n === null ? 0 : k === 'K8' ? (n >= 3 ? 0 : 5 * n) : n; });
    const cek = stan.reduce((a, k) => a + (cislo(pole['c' + k.slice(1)], 7200) || 0), 0), body = stan.reduce((a, k) => a + tb[k], 0);
    const trat = start !== null && cil !== null ? (cil - start + 86400) % 86400 : null;
    return { stanoviste: stan, tb: tb, body: body, cek: cek, trat: trat, start: start, cil: cil, chybi: chybi,
      np: k8 && cislo(pole.K8, 3) === 3 ? 'chybí 3 razítka na K8' : '', vysledny: trat !== null && !chybi.length ? Math.max(0, trat - cek) + 60 * body : null };
  }
  const hms = x => { if (x == null || x === '' || isNaN(Number(x))) return ''; const n = Math.round(Number(x)), p = v => String(v).padStart(2, '0'); return Math.floor(n / 3600) + ':' + p(Math.floor(n % 3600 / 60)) + ':' + p(n % 60); };
  const ms = x => Math.floor(Number(x) / 60) + ':' + String(Math.round(Number(x)) % 60).padStart(2, '0');
  function zhvbText(z) {
    if (!z) return '';
    const nenul = z.stanoviste.filter(k => z.tb[k]).map(k => k + ' ' + z.tb[k]);
    const c = (z.trat != null ? ['trať ' + hms(z.trat)] : []).concat(z.cek ? ['− čekání ' + ms(z.cek)] : []);
    return z.trat == null && !z.body ? '' : c.concat((c.length ? '+ ' : '') + z.body + ' b.' + (nenul.length ? ' (' + nenul.join(' · ') + ')' : '')).join(' ');
  }
  /** KOPIE soPoradiZhvb_ (měnit obě). */
  function poradiZhvb(nast, druzstva, vysledky) {
    const podle = {};
    vysledky.forEach(v => { if (Number(v.pokus) === 1) podle[v.prihlaska] = v; });
    const kats = (nast.kategorie || []).slice();
    druzstva.forEach(d => { if (d.stav !== 'odhlášeno' && kats.indexOf(d.kat) < 0) kats.push(d.kat); });
    return kats.map(kat => {
      const rows = druzstva.filter(d => d.kat === kat && d.stav !== 'odhlášeno').map(d => {
        const v = podle[d.id] || null, pole = (v && v.rozpis && v.rozpis.pole) || {}, z = v ? zhvb(kat, pole) : null;
        const plat = v ? (v.rozpis && v.rozpis.pole ? pole.plat || 'platný' : v.platnost) : '';
        const stav = !v ? 'bez výsledku' : plat !== 'platný' ? plat : z.np ? 'NP' : z.chybi.length ? 'rozpracováno' : 'platný';
        const pozn = [v && (pole.pozn != null ? pole.pozn : v.poznamka), stav === 'NP' && z.np ? z.np : ''].filter(Boolean).join('; ');
        return { id: d.id, druzstvo: d.druzstvo, sbor: d.sbor, start: d.start, shodaRucne: d.shoda, stav: stav, nejlepsi: stav === 'platný' ? z.vysledny : null,
          trestne: z ? z.body : null, tb: z ? z.tb : {}, chybi: z ? z.chybi : [], detail: z && stav !== 'nenastoupil' ? zhvbText(z) : '',
          soucet: 0, horsi: 0, poradi: null, shoda: false, nerozhodnuto: false,
          vysledek: stav === 'platný' ? hms(z.vysledny) : stav === 'rozpracováno' ? 'chybí ' + z.chybi.join(', ') : stav === 'bez výsledku' ? '–' : stav,
          pokusy: [v ? { casL: z.trat, casP: null, cas: stav === 'platný' ? z.vysledny : null, platnost: stav === 'rozpracováno' ? 'platný' : stav, poznamka: pozn, trestne: z.body, zhvb: z } : null] };
      });
      const hodn = rows.filter(r => r.stav === 'platný'), ost = rows.filter(r => r.stav !== 'platný');
      const cmp = (a, b) => (a.nejlepsi - b.nejlepsi) || (a.trestne - b.trestne) || ZHVB_SHODA.reduce((x, k) => x || ((a.tb[k] || 0) - (b.tb[k] || 0)), 0);
      hodn.sort((a, b) => cmp(a, b) || (a.start || 999) - (b.start || 999) || String(a.druzstvo).localeCompare(String(b.druzstvo), 'cs'));
      hodn.forEach((r, i) => { r.poradi = i && cmp(hodn[i - 1], r) === 0 ? hodn[i - 1].poradi : i + 1; });
      hodn.forEach(r => { r.shoda = hodn.some(x => x !== r && x.nejlepsi === r.nejlepsi); });
      const PORADI_OST = { 'NP': 1, 'DIS': 2, 'nenastoupil': 3, 'rozpracováno': 4, 'bez výsledku': 5 };
      ost.sort((a, b) => (PORADI_OST[a.stav] || 9) - (PORADI_OST[b.stav] || 9) || (a.start || 999) - (b.start || 999));
      const vse = hodn.concat(ost);
      return { kat: kat, rows: vse, hotovo: vse.every(r => r.stav !== 'bez výsledku' && r.stav !== 'rozpracováno'), nerozhodnuto: false };
    });
  }
  /** Hra Plamen – KOPIE soPoradiPlamen_ ze Souteze.gs (měnit obě). */
  const PLAMEN_DISC = ['požární útok', 'štafeta 4 × 60 m', 'požární útok CTIF', 'štafeta CTIF', 'štafeta požárních dvojic'];
  const PLAMEN_ZKR = { 'požární útok': 'PÚ', 'štafeta 4 × 60 m': '4 × 60 m', 'požární útok CTIF': 'PÚ CTIF', 'štafeta CTIF': 'štafeta CTIF', 'štafeta požárních dvojic': 'dvojice' };
  function poradiPlamen(nast, druzstva, vysledky) {
    const disc = nast.discipliny || [], kats = (nast.kategorie || []).slice();
    druzstva.forEach(d => { if (d.stav !== 'odhlášeno' && kats.indexOf(d.kat) < 0) kats.push(d.kat); });
    return kats.map(kat => {
      const dr = druzstva.filter(d => d.kat === kat);
      const dis = disc.map(x => ({ d: x.d, pokusy: x.pokusy, rows: poradi({ kategorie: [kat], pokusy: x.pokusy, shoda: 'pravidla SH ČMS', tbShoda: true }, dr, vysledky.filter(v => v.disciplina === x.d))[0].rows }));
      const rows = dr.filter(d => d.stav !== 'odhlášeno').map(d => {
        const vd = dis.map(x => ({ d: x.d, r: x.rows.find(y => y.id === d.id) })), chybi = [], mista = {};
        vd.forEach(x => { mista[x.d] = x.r.poradi; if (x.r.stav !== 'DIS') x.r.pokusy.forEach((q, i) => { if (!q) chybi.push(PLAMEN_ZKR[x.d] + (x.r.pokusy.length > 1 ? ' ' + (i + 1) + '.' : '')); }); });
        const stav = !vd.length ? 'bez výsledku' : vd.some(x => x.r.stav === 'DIS') ? 'DIS' : chybi.length ? 'rozpracováno' : vd.every(x => x.r.stav === 'platný' || x.r.stav === 'NP') ? 'platný' : 'nehodnoceno';
        const body = vd.reduce((a, x) => a + (x.r.poradi || 0), 0);
        return { id: d.id, druzstvo: d.druzstvo, sbor: d.sbor, start: d.start, shodaRucne: d.shoda, stav: stav, nejlepsi: null, body: stav === 'platný' ? body : null, mista: mista, chybi: chybi,
          disc: vd.map(x => ({ d: x.d, poradi: x.r.poradi, stav: x.r.stav, vysledek: x.r.vysledek })),
          detail: vd.map(x => PLAMEN_ZKR[x.d] + ' ' + (x.r.poradi ? x.r.poradi + '.' + (x.r.stav === 'platný' ? ' (' + x.r.vysledek + ')' : ' (NP)') : x.r.stav === 'bez výsledku' ? '–' : x.r.stav)).join(' · '),
          soucet: 0, horsi: 0, poradi: null, shoda: false, nerozhodnuto: false,
          vysledek: stav === 'platný' ? body + ' b.' : stav === 'rozpracováno' ? 'chybí ' + chybi.join(', ') : stav === 'bez výsledku' ? '–' : stav, pokusy: [] };
      });
      const hodn = rows.filter(r => r.stav === 'platný'), ost = rows.filter(r => r.stav !== 'platný');
      const cmp = (a, b) => (a.body - b.body) || PLAMEN_DISC.reduce((x, k) => x || ((a.mista[k] || 0) - (b.mista[k] || 0)), 0);
      hodn.sort((a, b) => cmp(a, b) || (a.start || 999) - (b.start || 999) || String(a.druzstvo).localeCompare(String(b.druzstvo), 'cs'));
      hodn.forEach((r, i) => { r.poradi = i && cmp(hodn[i - 1], r) === 0 ? hodn[i - 1].poradi : i + 1; });
      hodn.forEach(r => { r.shoda = hodn.some(x => x !== r && x.body === r.body); });
      const PORADI_OST = { 'DIS': 1, 'nehodnoceno': 2, 'rozpracováno': 3, 'bez výsledku': 4 };
      ost.sort((a, b) => (PORADI_OST[a.stav] || 9) - (PORADI_OST[b.stav] || 9) || (a.start || 999) - (b.start || 999));
      const vse = hodn.concat(ost);
      return { kat: kat, rows: vse, discipliny: dis, hotovo: vse.every(r => r.stav !== 'rozpracováno' && r.stav !== 'bez výsledku'), nerozhodnuto: false };
    });
  }
  /** Čas dne pro start / cíl: „9:05“, „9:05:30“, „9.05.30“ → sekundy od půlnoci; prázdné → null; nesmysl → NaN */
  function casDneZTextu(t) {
    const s = String(t == null ? '' : t).trim().replace(/[.,]/g, ':').replace(/\s+/g, '');
    if (!s) return null;
    const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    return m && Number(m[1]) < 24 && Number(m[2]) < 60 && Number(m[3] || 0) < 60 ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] || 0) : NaN;
  }
  /** Čekací čas: „2:30“ = 2 min 30 s, „2“ = 2 minuty → sekundy; prázdné → null; nesmysl → NaN */
  function cekaniZTextu(t) {
    const s = String(t == null ? '' : t).trim().replace(/[.,]/g, ':').replace(/\s+/g, '');
    if (!s) return null;
    let m = s.match(/^(\d{1,3}):(\d{1,2})$/);
    if (m && Number(m[2]) < 60) return Math.min(7200, Number(m[1]) * 60 + Number(m[2]));
    m = s.match(/^\d{1,3}$/);
    return m ? Math.min(7200, Number(s) * 60) : NaN;
  }

  const api = { poradi, uzlovka, casZTextu, casText, NP, NENASTOUPIL, zhvb, zhvbText, hms, ms, casDneZTextu, cekaniZTextu, ZHVB_STAN, PLAMEN_DISC, PLAMEN_ZKR };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else koren.OSH_PORADI = api;
})(typeof window !== 'undefined' ? window : globalThis);
