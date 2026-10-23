/**
 * OSH data – soutěže (B8): rámec soutěží, požární útok (dospělí, dorost), pohár / liga okresu.
 * Nový soubor „Souteze“ ve stejném projektu. Rozbor pravidel a otevřené otázky: docs/souteze.md.
 *
 * Soutěž = řádek v listu Akce (Typ soutěž) + řádek v listu Soutěže (druh, kategorie, pokusy, uzávěrka, stav…).
 *   Okres (role Soutěže: všechny / MH / dospělí, nebo Správce) ji založí přímo, nebo ze schválené žádosti sboru (B12).
 *   Založená soutěž je schválená – hned je v kalendáři (B5.4).
 * Stav: koncept → přihlášky → uzavřeno → závod → ověřeno → zveřejněno (zrušeno kdykoli před zveřejněním).
 * Přihlášky družstev (list Přihlášky družstev): sbor v portálu do uzávěrky, okres kdykoli; startovní pořadí losem nebo ručně.
 * Závodní panel (zavod.html) pro rozhodčí bez přihlášení: odkaz s kódem jen pro jednu soutěž, platí do konce soutěže.
 *   Zápisy se drží v telefonu a odešlou se po připojení (každý má vlastní klíč → server ho nezapíše dvakrát).
 *   Hlavní rozhodčí (vlastní odkaz) výsledky ověří, okres je zveřejní (web ?soutez=…, PDF výsledková listina na Disku).
 * Pořadí – požární útok: lepší z pokusů, výsledný čas pokusu = delší z terčů L a P; NP vždy za platnými;
 *   shoda: pravidla SH ČMS (součet obou pokusů, pak dělené místo) nebo rozhoduje pořadatel (hlavní rozhodčí určí pořadí).
 *   Kopie výpočtu je v souteze.js (závodní panel počítá pořadí i bez signálu) – měnit obě.
 * Pohár (list Poháry): body za umístění v kolech podle tabulky, součet započítaných kol, pořadí.
 * ZHVB: jeden řádek výsledku na hlídku, stanoviště zapisují jen svá pole (start, cíl, K1–K8, čekání) – soZhvb_, soPoradiZhvb_.
 * Hra Plamen: kolo = soutěž s vlastními disciplínami (soPoradiPlamen_), víc kol = pohár s Typ „Hra Plamen“ (soPlamenRocnik_).
 */

const LIST_SOUTEZE = 'Soutěže', LIST_DRUZSTVA = 'Přihlášky družstev', LIST_VYSLEDKY = 'Výsledky', LIST_POHARY = 'Poháry';
const SO_DRUHY = ['požární útok', 'Hra Plamen', 'ZHVB', 'uzlová štafeta'];
const SO_DRUHY_HOTOVE = ['požární útok', 'uzlová štafeta', 'ZHVB', 'Hra Plamen']; // všechny druhy SO_DRUHY (pravidla v docs/souteze.md)
const SO_STAVY = ['koncept', 'přihlášky', 'uzavřeno', 'závod', 'ověřeno', 'zveřejněno', 'zrušeno'];
const SO_SHODA = ['pravidla SH ČMS', 'horší pokus', 'rozhoduje pořadatel']; // horší pokus = OZ uzlové štafety a 60 m, Plamen 5.6
const SO_PLATNOST = ['platný', 'NP', 'DIS', 'nenastoupil'];
const SO_NP = 998, SO_NENASTOUPIL = 999; // číselná hodnota neplatného a nenastoupeného pokusu (Směrnice hry Plamen – hodnocení družstev)
const SO_MAX_DRUZSTEV = 40; // na sbor a soutěž

/* ---------- oprávnění ---------- */

/** Role Soutěže: 'všechny' | 'MH' | 'dospělí' | '' (Správce = všechny). */
function soRole_(o) {
  if (!o) return '';
  if (o.role['Správce']) return 'všechny';
  const r = o.role['Soutěže'];
  return r === true ? 'všechny' : ['všechny', 'MH', 'dospělí'].indexOf(r) >= 0 ? r : '';
}
function smiSouteze_(o, pro) { const r = soRole_(o); return !!r && (!pro || r === 'všechny' || r === pro); }
/** Smí spravovat konkrétní soutěž: role Soutěže pro její Pro, nebo pořádající sbor (o.soPoradatel nastaví apiSouteze_ po ověření členství). */
function soMuze_(o, s) { return smiSouteze_(o, s.pro) || !!(o.soPoradatel && s.poradatelSkupina && s.poradatelSkupina === o.soPoradatel); }

/* ---------- čtení ---------- */

function soTab_(list) {
  const sh = dataSs_().getSheetByName(list);
  if (!sh) throw new Error('Chybí list „' + list + '“ – spusťte v tabulce OSH data → Založit / doplnit strukturu.');
  const h = hlavicka_(sh);
  return { sh: sh, h: h, col: k => h.indexOf(k) };
}
function soRadky_(t) { return t.sh.getLastRow() < 2 ? [] : t.sh.getRange(2, 1, t.sh.getLastRow() - 1, t.h.length).getValues().map((r, i) => ({ r: r, n: i + 2 })); }
const soObj_ = (h, r) => h.reduce((x, k, j) => (k && (x[k] = r[j]), x), {});
const soIso_ = v => v instanceof Date ? v.toISOString() : (v == null ? '' : v);
const soDen_ = v => v instanceof Date ? Utilities.formatDate(v, 'Europe/Prague', 'yyyy-MM-dd') : (v ? String(v).slice(0, 10) : '');
const soCislo_ = v => v === '' || v == null || isNaN(Number(v)) ? null : Number(v);
function soKategorie_(t) { return String(t || '').split(/[,;\n]+/).map(x => x.trim()).filter(Boolean); }
function soNoveId_(pismeno) { return pismeno + Utilities.formatDate(new Date(), 'Europe/Prague', 'yyMMddHHmmss') + Math.floor(Math.random() * 900 + 100); }

function soJson_(r, a) {
  a = a || {};
  return { id: String(r['Akce – ID']), nazev: String(a['Název'] || ''), od: soIso_(a['Od']), do: soIso_(a['Do']), misto: String(a['Místo'] || ''), poradatel: String(a['Pořadatel'] || ''),
    proKoho: String(a['Pro koho'] || ''), popis: String(a['Popis'] || ''), stavAkce: String(a['Stav'] || ''),
    druh: r['Druh'] || 'požární útok', pro: r['Pro'] === 'dospělí' ? 'dospělí' : 'MH', kategorie: soKategorie_(r['Kategorie']), pokusy: Number(r['Pokusy']) === 1 ? 1 : 2,
    shoda: SO_SHODA.indexOf(r['Shoda časů']) >= 0 ? r['Shoda časů'] : 'pravidla SH ČMS', uzaverka: soDen_(r['Uzávěrka']), propozice: String(r['Propozice'] || ''),
    pohar: String(r['Pohár – ID'] || ''), kolo: soCislo_(r['Kolo']), hlavniRozhodci: String(r['Hlavní rozhodčí'] || ''), stav: r['Stav'] || 'koncept',
    kodyDo: soIso_(r['Kódy platí do']), maKody: !!r['Kód rozhodčích – otisk'], overil: String(r['Ověřil'] || ''), overeno: soIso_(r['Ověřeno']),
    zverejnil: String(r['Zveřejnil'] || ''), zverejneno: soIso_(r['Zveřejněno']), pdf: String(r['Výsledky – PDF'] || ''), zadost: String(r['Žádost – ID'] || ''),
    oz: soOzCist_(r['OZ']), ozPdf: String(r['OZ – PDF'] || ''), poradatelSkupina: String(r['Pořadatel – skupina'] || '').split('@')[0].toLowerCase(),
    stojany: soStojanyCist_(r['Stojany']), discipliny: soDisciplinyCist_(r['Disciplíny']), poznamka: String(r['Poznámka'] || ''), upraveno: soIso_(r['Upraveno']) };
}
/** Stojany uzlové štafety: JSON seznam jmen rozhodčích (počet = počet stojanů). */
function soStojanyCist_(v) { try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a.slice(0, 30).map(x => String(x == null ? '' : x)) : []; } catch (e) { return []; } }
function soDruzstvoJson_(r, sKontaktem) {
  const o = { id: String(r['ID']), soutez: String(r['Akce – ID']), sbor: String(r['Sbor'] || ''), skupina: String(r['Skupina'] || ''), kat: String(r['Kategorie'] || ''),
    druzstvo: String(r['Družstvo'] || ''), stav: r['Stav'] || 'přihlášeno', start: soCislo_(r['Start']), shoda: soCislo_(r['Pořadí při shodě']), vytvoreno: soIso_(r['Vytvořeno']),
    rozpis: soCislo_(r['Rozběh 1']) ? [1, 2].map(n => soCislo_(r['Rozběh ' + n]) ? { pokus: n, rozbeh: soCislo_(r['Rozběh ' + n]), stojan: soCislo_(r['Stojan ' + n]) } : null).filter(Boolean) : [] };
  if (sKontaktem) { o.kontakt = String(r['Kontakt'] || ''); o.prihlasil = String(r['Přihlásil'] || ''); }
  return o;
}
function soVysledekJson_(r) {
  return { id: String(r['ID']), prihlaska: String(r['Přihláška – ID'] || ''), pokus: Number(r['Pokus']) === 2 ? 2 : 1, casL: soCislo_(r['Čas L']), casP: soCislo_(r['Čas P']),
    cas: soCislo_(r['Čas (s)']), platnost: SO_PLATNOST.indexOf(r['Platnost']) >= 0 ? r['Platnost'] : 'platný', poznamka: String(r['Poznámka'] || ''),
    rozhodci: String(r['Rozhodčí'] || ''), zapsano: soIso_(r['Zapsáno']), stav: String(r['Stav'] || 'zapsáno'),
    trestne: soCislo_(r['Trestné body']), disciplina: String(r['Disciplína'] || ''), rozpis: (() => { try { return JSON.parse(r['Rozpis'] || 'null'); } catch (e) { return null; } })() };
}

/**
 * Uzlová štafeta (OZ okresního kola 2026): výsledný čas = naměřený + 30 s za chybně uvázaný uzel + 30 s za pomoc (i slovní)
 * + 10 s za předčasný start 2.–5. závodníka (jen družstva). Neplatný pokus: nad 60 s (přípravka 90 s), méně než 3 správné uzly
 * (přípravka 2 ze 3). Ostatní důvody NP (2. chybný start, vynechaný uzel, zkoušení uzlů) určí rozhodčí. Kopie v souteze.js – měnit obě.
 */
function soUzlovka_(kat, cas, uzly, pomoc, starty) {
  const pripravka = /přípravk/i.test(kat), druzstva = !/jednotliv/i.test(kat), pocetUzlu = pripravka ? 3 : 5, minSpravne = pripravka ? 2 : 3, limit = pripravka ? 90 : 60;
  const n = (x, max) => Math.max(0, Math.min(max, Math.round(Number(x) || 0)));
  uzly = n(uzly, pocetUzlu); pomoc = n(pomoc, 10); starty = druzstva ? n(starty, 4) : 0;
  const trestne = 30 * uzly + 30 * pomoc + 10 * starty;
  const np = !(cas > 0) ? '' : cas > limit ? 'překročen limit ' + limit + ' s' : pocetUzlu - uzly < minSpravne ? 'méně než ' + minSpravne + ' správně uvázané uzly' : '';
  return { uzly: uzly, pomoc: pomoc, starty: starty, trestne: trestne, vysledny: cas > 0 ? soR2_(cas + trestne) : null, np: np, limit: limit, pocetUzlu: pocetUzlu, minSpravne: minSpravne, druzstva: druzstva };
}

/**
 * ZHVB (rámcové OZ 2026/2027, okresní OZ a prováděcí směrnice OSH PZ mají přednost) – jedna hlídka = jeden řádek Výsledků, pole z panelu:
 * start, cil = čas dne v s; K1–K7 = trestné body na stanovišti (0–15); K8 = chybějící razítka (0–3, jen dorost a SŠ: 5 / 10 b., 3 = neplatný výsledek);
 * c1–c8 = čekací čas na stanovišti v s. Výsledný čas = (cíl − start) − čekání + 60 s × trestné body. Kopie v souteze.js – měnit obě.
 * Přepis startovní karty ukládá navíc body za úkoly (K2a/b, K4a/b, K5a–c, K7a–c) – jen pro kontrolu a protesty, počítá se z K1–K8.
 */
const SO_ZHVB_STAN = ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8'];
const SO_ZHVB_SHODA = ['K5', 'K7', 'K6', 'K4', 'K3', 'K2', 'K1']; // shoda času: nižší trestné body, pak body na stanovištích v tomto pořadí (PO, OO, ZPP, brannost, uzly, orientace, střelba)
function soZhvb_(kat, pole) {
  pole = pole || {};
  const k8 = /doros|SŠ/i.test(kat), stan = SO_ZHVB_STAN.filter(k => k !== 'K8' || k8);
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
/** 2403 → „0:40:03“ */
const soHms_ = x => { if (x == null || x === '' || isNaN(Number(x))) return ''; const n = Math.round(Number(x)), p = v => String(v).padStart(2, '0'); return Math.floor(n / 3600) + ':' + p(Math.floor(n % 3600 / 60)) + ':' + p(n % 60); };
/** 90 → „1:30“ (čekací čas) */
const soMs_ = x => Math.floor(Number(x) / 60) + ':' + String(Math.round(Number(x)) % 60).padStart(2, '0');
/** Rozpis hlídky ZHVB pro aplikaci, panel i PDF: „trať 0:23:22 − čekání 1:30 + 17 b. (K1 9 · K3 3 · K7 5)“. */
function soZhvbText_(z) {
  if (!z) return '';
  const nenul = z.stanoviste.filter(k => z.tb[k]).map(k => k + ' ' + z.tb[k]);
  const c = (z.trat != null ? ['trať ' + soHms_(z.trat)] : []).concat(z.cek ? ['− čekání ' + soMs_(z.cek)] : []);
  return z.trat == null && !z.body ? '' : c.concat((c.length ? '+ ' : '') + z.body + ' b.' + (nenul.length ? ' (' + nenul.join(' · ') + ')' : '')).join(' ');
}

/**
 * Hra Plamen (Směrnice hry Plamen 2022; okresní OZ mají přednost) – kolo = soutěž s vlastními disciplínami (sloupec Disciplíny = JSON [{ d, pokusy }]).
 * Pokus (u štafet štafeta): požární útok = delší z terčů L a P; štafeta 4 × 60 m = čas; ostatní = čas + trestné sekundy. Platí lepší pokus,
 * shoda → součet pokusů (NP 998 s, nenastoupil 999 s) → trestné sekundy u lepšího času → dělené místo.
 * Kolo: body = součet umístění v disciplínách, nižší vyhrává; shoda → lepší umístění v pořadí SO_PLAMEN_DISC. Hodnoceno jen družstvo,
 * které absolvovalo všechny disciplíny (platný nebo NP). Víc kol = pohár s Typ „Hra Plamen“ (soPlamenRocnik_). Kopie v souteze.js – měnit obě.
 */
const SO_PLAMEN_DISC = ['požární útok', 'štafeta 4 × 60 m', 'požární útok CTIF', 'štafeta CTIF', 'štafeta požárních dvojic'];
const SO_PLAMEN_ZKR = { 'požární útok': 'PÚ', 'štafeta 4 × 60 m': '4 × 60 m', 'požární útok CTIF': 'PÚ CTIF', 'štafeta CTIF': 'štafeta CTIF', 'štafeta požárních dvojic': 'dvojice' };
function soDisciplinyCist_(v) {
  let a = []; try { a = typeof v === 'string' ? JSON.parse(v || '[]') : v; } catch (e) { a = []; }
  return (Array.isArray(a) ? a : []).filter(x => x && SO_PLAMEN_DISC.indexOf(x.d) >= 0).map(x => ({ d: x.d, pokusy: Number(x.pokusy) === 1 ? 1 : 2 }))
    .filter((x, i, b) => b.findIndex(y => y.d === x.d) === i).sort((x, y) => SO_PLAMEN_DISC.indexOf(x.d) - SO_PLAMEN_DISC.indexOf(y.d));
}

/** Všechny soutěže (s řádkem Akce). akce = mapa ID → řádek listu Akce (volitelně už načtená). */
function soSouteze_(akce) {
  if (!akce) { akce = {}; radky_('Akce').forEach(a => { if (a['ID']) akce[String(a['ID'])] = a; }); }
  return radky_(LIST_SOUTEZE).filter(r => r['Akce – ID'] && akce[String(r['Akce – ID'])]).map(r => soJson_(r, akce[String(r['Akce – ID'])]));
}
function soDruzstva_(id, sKontaktem) { return radky_(LIST_DRUZSTVA).filter(r => r['ID'] && (!id || String(r['Akce – ID']) === id)).map(r => soDruzstvoJson_(r, sKontaktem)); }
function soVysledky_(id) { return radky_(LIST_VYSLEDKY).filter(r => r['ID'] && String(r['Akce – ID']) === id && r['Přihláška – ID']).map(soVysledekJson_); }

/* ---------- pořadí (kopie v souteze.js – měnit obě) ---------- */

const soR2_ = x => Math.round(Number(x) * 100) / 100;

/**
 * Pořadí požárního útoku po kategoriích.
 * nast = { kategorie: [...], pokusy: 1|2, shoda: 'pravidla SH ČMS'|'horší pokus'|'rozhoduje pořadatel' }
 * druzstva = [{ id, kat, druzstvo, sbor, start, shoda, stav }], vysledky = [{ prihlaska, pokus, casL, casP, cas, platnost, poznamka }]
 * Vrací [{ kat, hotovo, nerozhodnuto, rows: [{ id, druzstvo, sbor, start, poradi|null, stav, nejlepsi, soucet, vysledek, pokusy:[…], shoda, nerozhodnuto }] }]
 * stav: platný | NP | DIS | nenastoupil | bez výsledku. Bez pořadí: DIS, nenastoupil, bez výsledku (na konci).
 */
function soPoradi_(nast, druzstva, vysledky) {
  if (nast.druh === 'ZHVB') return soPoradiZhvb_(nast, druzstva, vysledky);
  if (nast.druh === 'Hra Plamen') return soPoradiPlamen_(nast, druzstva, vysledky);
  const pokusu = nast.pokusy === 1 ? 1 : 2, rucne = nast.shoda === 'rozhoduje pořadatel', horsi = nast.shoda === 'horší pokus';
  const podle = {};
  vysledky.forEach(v => { (podle[v.prihlaska] = podle[v.prihlaska] || {})[v.pokus] = v; });
  const hodnota = v => !v ? SO_NENASTOUPIL : v.platnost === 'platný' && v.cas > 0 ? soR2_(v.cas) : v.platnost === 'NP' ? SO_NP : SO_NENASTOUPIL;
  const cas = x => String(soR2_(x).toFixed(2)).replace('.', ',');
  const kats = (nast.kategorie || []).slice();
  druzstva.forEach(d => { if (d.stav !== 'odhlášeno' && kats.indexOf(d.kat) < 0) kats.push(d.kat); });
  return kats.map(kat => {
    const rows = druzstva.filter(d => d.kat === kat && d.stav !== 'odhlášeno').map(d => {
      const p = [];
      for (let i = 1; i <= pokusu; i++) p.push((podle[d.id] && podle[d.id][i]) || null);
      const hod = p.map(hodnota), nejl = Math.min.apply(null, hod), dis = p.some(v => v && v.platnost === 'DIS');
      const stav = dis ? 'DIS' : nejl < SO_NP ? 'platný' : nejl === SO_NP ? 'NP' : p.some(Boolean) ? 'nenastoupil' : 'bez výsledku';
      const pn = p[hod.indexOf(nejl)];
      return { id: d.id, druzstvo: d.druzstvo, sbor: d.sbor, start: d.start, shodaRucne: d.shoda, stav: stav, nejlepsi: stav === 'platný' ? nejl : null, tbNejl: (pn && pn.trestne) || 0,
        soucet: soR2_(hod.reduce((a, b) => a + b, 0)), horsi: Math.max.apply(null, hod), poradi: null, shoda: false, nerozhodnuto: false,
        vysledek: stav === 'platný' ? cas(nejl) + ' s' : stav === 'bez výsledku' ? '–' : stav,
        pokusy: p.map(v => v ? { casL: v.casL, casP: v.casP, cas: v.cas, platnost: v.platnost, poznamka: v.poznamka || '', trestne: v.trestne || 0 } : null) };
    });
    const hodn = rows.filter(r => r.stav === 'platný' || r.stav === 'NP'), ost = rows.filter(r => r.stav !== 'platný' && r.stav !== 'NP');
    const klic = r => r.stav === 'platný' ? r.nejlepsi : SO_NP;
    const cmp = (a, b) => (klic(a) - klic(b)) ||
      (!rucne && pokusu === 2 ? (horsi ? a.horsi - b.horsi : a.soucet - b.soucet) : 0) ||
      (nast.tbShoda && a.stav === 'platný' && b.stav === 'platný' ? a.tbNejl - b.tbNejl : 0) || // Plamen: trestné sekundy u lepšího času
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

/**
 * Pořadí ZHVB (jeden řádek výsledku na hlídku, pole v rozpis.pole – viz soZhvb_). Nižší výsledný čas; shoda: nižší součet trestných bodů,
 * pak nižší body na stanovištích v pořadí SO_ZHVB_SHODA, pak dělené místo. Neplatný výsledek (NP), DIS, nenastoupil, rozpracováno
 * (chybí start, cíl nebo stanoviště) a bez výsledku jsou bez pořadí na konci. Stejný tvar řádků jako soPoradi_ + trestne, detail, chybi.
 */
function soPoradiZhvb_(nast, druzstva, vysledky) {
  const podle = {};
  vysledky.forEach(v => { if (Number(v.pokus) === 1) podle[v.prihlaska] = v; });
  const kats = (nast.kategorie || []).slice();
  druzstva.forEach(d => { if (d.stav !== 'odhlášeno' && kats.indexOf(d.kat) < 0) kats.push(d.kat); });
  return kats.map(kat => {
    const rows = druzstva.filter(d => d.kat === kat && d.stav !== 'odhlášeno').map(d => {
      const v = podle[d.id] || null, pole = (v && v.rozpis && v.rozpis.pole) || {}, z = v ? soZhvb_(kat, pole) : null;
      const plat = v ? (v.rozpis && v.rozpis.pole ? pole.plat || 'platný' : v.platnost) : '';
      const stav = !v ? 'bez výsledku' : plat !== 'platný' ? plat : z.np ? 'NP' : z.chybi.length ? 'rozpracováno' : 'platný';
      const pozn = [v && (pole.pozn != null ? pole.pozn : v.poznamka), stav === 'NP' && z.np ? z.np : ''].filter(Boolean).join('; ');
      return { id: d.id, druzstvo: d.druzstvo, sbor: d.sbor, start: d.start, shodaRucne: d.shoda, stav: stav, nejlepsi: stav === 'platný' ? z.vysledny : null,
        trestne: z ? z.body : null, tb: z ? z.tb : {}, chybi: z ? z.chybi : [], detail: z && stav !== 'nenastoupil' ? soZhvbText_(z) : '',
        soucet: 0, horsi: 0, poradi: null, shoda: false, nerozhodnuto: false,
        vysledek: stav === 'platný' ? soHms_(z.vysledny) : stav === 'rozpracováno' ? 'chybí ' + z.chybi.join(', ') : stav === 'bez výsledku' ? '–' : stav,
        pokusy: [v ? { casL: z.trat, casP: null, cas: stav === 'platný' ? z.vysledny : null, platnost: stav === 'rozpracováno' ? 'platný' : stav, poznamka: pozn, trestne: z.body, zhvb: z } : null] };
    });
    const hodn = rows.filter(r => r.stav === 'platný'), ost = rows.filter(r => r.stav !== 'platný');
    const cmp = (a, b) => (a.nejlepsi - b.nejlepsi) || (a.trestne - b.trestne) || SO_ZHVB_SHODA.reduce((x, k) => x || ((a.tb[k] || 0) - (b.tb[k] || 0)), 0);
    hodn.sort((a, b) => cmp(a, b) || (a.start || 999) - (b.start || 999) || String(a.druzstvo).localeCompare(String(b.druzstvo), 'cs'));
    hodn.forEach((r, i) => { r.poradi = i && cmp(hodn[i - 1], r) === 0 ? hodn[i - 1].poradi : i + 1; });
    hodn.forEach(r => { r.shoda = hodn.some(x => x !== r && x.nejlepsi === r.nejlepsi); });
    const PORADI_OST = { 'NP': 1, 'DIS': 2, 'nenastoupil': 3, 'rozpracováno': 4, 'bez výsledku': 5 };
    ost.sort((a, b) => (PORADI_OST[a.stav] || 9) - (PORADI_OST[b.stav] || 9) || (a.start || 999) - (b.start || 999));
    const vse = hodn.concat(ost);
    return { kat: kat, rows: vse, hotovo: vse.every(r => r.stav !== 'bez výsledku' && r.stav !== 'rozpracováno'), nerozhodnuto: false };
  });
}

/** Pořadí kola hry Plamen: v každé kategorii pořadí v disciplínách (soPoradi_ s trestnými sekundami u shody) a celkové body. */
function soPoradiPlamen_(nast, druzstva, vysledky) {
  const disc = nast.discipliny || [], kats = (nast.kategorie || []).slice();
  druzstva.forEach(d => { if (d.stav !== 'odhlášeno' && kats.indexOf(d.kat) < 0) kats.push(d.kat); });
  return kats.map(kat => {
    const dr = druzstva.filter(d => d.kat === kat);
    const dis = disc.map(x => ({ d: x.d, pokusy: x.pokusy, rows: soPoradi_({ kategorie: [kat], pokusy: x.pokusy, shoda: 'pravidla SH ČMS', tbShoda: true }, dr, vysledky.filter(v => v.disciplina === x.d))[0].rows }));
    const rows = dr.filter(d => d.stav !== 'odhlášeno').map(d => {
      const vd = dis.map(x => ({ d: x.d, r: x.rows.find(y => y.id === d.id) })), chybi = [], mista = {};
      vd.forEach(x => { mista[x.d] = x.r.poradi; if (x.r.stav !== 'DIS') x.r.pokusy.forEach((q, i) => { if (!q) chybi.push(SO_PLAMEN_ZKR[x.d] + (x.r.pokusy.length > 1 ? ' ' + (i + 1) + '.' : '')); }); });
      const stav = !vd.length ? 'bez výsledku' : vd.some(x => x.r.stav === 'DIS') ? 'DIS' : chybi.length ? 'rozpracováno' : vd.every(x => x.r.stav === 'platný' || x.r.stav === 'NP') ? 'platný' : 'nehodnoceno';
      const body = vd.reduce((a, x) => a + (x.r.poradi || 0), 0);
      return { id: d.id, druzstvo: d.druzstvo, sbor: d.sbor, start: d.start, shodaRucne: d.shoda, stav: stav, nejlepsi: null, body: stav === 'platný' ? body : null, mista: mista, chybi: chybi,
        disc: vd.map(x => ({ d: x.d, poradi: x.r.poradi, stav: x.r.stav, vysledek: x.r.vysledek })),
        detail: vd.map(x => SO_PLAMEN_ZKR[x.d] + ' ' + (x.r.poradi ? x.r.poradi + '.' + (x.r.stav === 'platný' ? ' (' + x.r.vysledek + ')' : ' (NP)') : x.r.stav === 'bez výsledku' ? '–' : x.r.stav)).join(' · '),
        soucet: 0, horsi: 0, poradi: null, shoda: false, nerozhodnuto: false,
        vysledek: stav === 'platný' ? body + ' b.' : stav === 'rozpracováno' ? 'chybí ' + chybi.join(', ') : stav === 'bez výsledku' ? '–' : stav, pokusy: [] };
    });
    const hodn = rows.filter(r => r.stav === 'platný'), ost = rows.filter(r => r.stav !== 'platný');
    const cmp = (a, b) => (a.body - b.body) || SO_PLAMEN_DISC.reduce((x, k) => x || ((a.mista[k] || 0) - (b.mista[k] || 0)), 0);
    hodn.sort((a, b) => cmp(a, b) || (a.start || 999) - (b.start || 999) || String(a.druzstvo).localeCompare(String(b.druzstvo), 'cs'));
    hodn.forEach((r, i) => { r.poradi = i && cmp(hodn[i - 1], r) === 0 ? hodn[i - 1].poradi : i + 1; });
    hodn.forEach(r => { r.shoda = hodn.some(x => x !== r && x.body === r.body); });
    const PORADI_OST = { 'DIS': 1, 'nehodnoceno': 2, 'rozpracováno': 3, 'bez výsledku': 4 };
    ost.sort((a, b) => (PORADI_OST[a.stav] || 9) - (PORADI_OST[b.stav] || 9) || (a.start || 999) - (b.start || 999));
    const vse = hodn.concat(ost);
    return { kat: kat, rows: vse, discipliny: dis, hotovo: vse.every(r => r.stav !== 'rozpracováno' && r.stav !== 'bez výsledku'), nerozhodnuto: false };
  });
}

/**
 * Celkové pořadí ročníku hry Plamen (pohár s Typ „Hra Plamen“): sloupce = disciplíny zveřejněných kol, ve kterých kategorie soutěžila
 * (přípravka jen ve svých kolech). Body = součet umístění, hodnocen jen ten, kdo absolvoval všechny disciplíny (platný nebo NP);
 * shoda → součet umístění v disciplínách v pořadí SO_PLAMEN_DISC. Družstvo se mezi koly páruje podle názvu (jako u poháru).
 */
function soPlamenRocnik_(p, kola) {
  const kats = p.kategorie.length ? p.kategorie.slice() : [];
  kola.forEach(k => k.poradi.forEach(c => { if (kats.indexOf(c.kat) < 0 && c.rows.length) kats.push(c.kat); }));
  return kats.map(kat => {
    const sloupce = [], tymy = {}, kl = r => String(r.druzstvo).trim().toLowerCase();
    kola.forEach((k, ki) => {
      const c = k.poradi.find(x => x.kat === kat);
      if (!c || !c.rows.length || !c.discipliny) return;
      c.discipliny.forEach(x => sloupce.push({ kolo: k.sou.kolo || ki + 1, d: x.d, rows: x.rows }));
      c.rows.forEach(r => { if (!tymy[kl(r)]) tymy[kl(r)] = String(r.druzstvo).trim(); });
    });
    const rows = Object.keys(tymy).map(key => {
      const mista = sloupce.map(sl => { const r = sl.rows.find(y => kl(y) === key); return r && r.poradi && (r.stav === 'platný' || r.stav === 'NP') ? r.poradi : null; });
      const podleDisc = {}; sloupce.forEach((sl, i) => { podleDisc[sl.d] = (podleDisc[sl.d] || 0) + (mista[i] || 0); });
      return { druzstvo: tymy[key], body: mista, pocita: mista.map(() => true), mista: mista, podleDisc: podleDisc, celkem: mista.reduce((a, m) => a + (m || 0), 0),
        starty: mista.filter(m => m != null).length, hodnocen: sloupce.length > 0 && mista.every(m => m != null), nejCas: null };
    });
    const cmp = (a, b) => (a.celkem - b.celkem) || SO_PLAMEN_DISC.reduce((x, k) => x || ((a.podleDisc[k] || 0) - (b.podleDisc[k] || 0)), 0);
    const hodn = rows.filter(r => r.hodnocen).sort((a, b) => cmp(a, b) || a.druzstvo.localeCompare(b.druzstvo, 'cs'));
    hodn.forEach((r, i) => { r.poradi = i && cmp(hodn[i - 1], r) === 0 ? hodn[i - 1].poradi : i + 1; });
    const ost = rows.filter(r => !r.hodnocen).sort((a, b) => b.starty - a.starty || a.celkem - b.celkem || a.druzstvo.localeCompare(b.druzstvo, 'cs'));
    ost.forEach(r => { r.poradi = null; });
    return { kat: kat, druzstev: rows.length, sloupce: sloupce.map(sl => sl.kolo + '. kolo · ' + SO_PLAMEN_ZKR[sl.d]), rows: hodn.concat(ost) };
  });
}

/* ---------- pohár / liga ---------- */

function soPoharJson_(r) {
  return { id: String(r['ID']), nazev: String(r['Název'] || ''), rocnik: soCislo_(r['Ročník']), pro: r['Pro'] === 'dospělí' ? 'dospělí' : 'MH', kategorie: soKategorie_(r['Kategorie']),
    body: String(r['Body'] || ''), bodyNP: soCislo_(r['Body za NP']), zapocitat: soCislo_(r['Započítat kol']), minKol: soCislo_(r['Min. kol']) || 0,
    druzstev: String(r['Družstev v poháru'] || ''), typ: r['Typ'] === 'Hra Plamen' ? 'Hra Plamen' : 'pohár',
    stav: r['Stav'] || 'koncept', popis: String(r['Popis'] || ''), upraveno: soIso_(r['Upraveno']) };
}
function soPohary_() { return radky_(LIST_POHARY).filter(r => r['ID']).map(soPoharJson_); }

/** Body za umístění: „počet družstev“ = vítěz dostane tolik bodů, kolik je v kategorii družstev; jinak tabulka „10,8,6,…“. */
function soBodyZa_(tabulka, poradi, pocet) {
  if (!poradi) return 0;
  if (/počet/i.test(tabulka)) return Math.max(pocet - poradi + 1, 0);
  const t = String(tabulka || '').split(/[,;\s]+/).map(Number).filter(x => !isNaN(x));
  return t[poradi - 1] || 0;
}

/** „mladší 10, starší 8“ → { mladší: 10, starší: 8 } (počet družstev přihlášených do poháru v kategorii). */
function soPocty_(t) {
  const o = {};
  String(t || '').split(/[,;\n]+/).forEach(x => { const m = x.trim().match(/^(.+?)\s*[=:]?\s*(\d{1,3})$/); if (m) o[m[1].trim().toLowerCase()] = Number(m[2]); });
  return o;
}

/**
 * Celkové pořadí poháru (pravidla Poháru rady mládeže 2026, schválená VV 3. 12. 2025). kola = [{ sou, poradi }] (zveřejněná kola, podle data).
 * Body za umístění v kole: tabulka „10,8,6,…“, nebo „počet družstev“ = vítěz dostane tolik bodů, kolik je družstev přihlášených do poháru
 * v kategorii (pole Družstev v poháru; bez něj počet různých družstev ze všech kol), druhý o bod méně – bez ohledu na účast v kole.
 * NP: Body za NP, prázdné = podle umístění. DIS 0 b., nenastoupil = nestartoval.
 * Shoda bodů: větší počet lepších umístění (1. míst, pak 2. míst…), pak lepší čas v celém ročníku, pak dělené místo.
 */
function soPoharPoradi_(p, kola) {
  if (p.typ === 'Hra Plamen') return soPlamenRocnik_(p, kola);
  const kats = p.kategorie.length ? p.kategorie.slice() : [];
  kola.forEach(k => k.poradi.forEach(c => { if (kats.indexOf(c.kat) < 0) kats.push(c.kat); }));
  const pocty = soPocty_(p.druzstev);
  return kats.map(kat => {
    const tymy = {}, kl = r => String(r.druzstvo).trim().toLowerCase();
    kola.forEach(k => { const c = k.poradi.find(x => x.kat === kat); if (c) c.rows.forEach(r => { tymy[kl(r)] = true; }); });
    const N = pocty[String(kat).toLowerCase()] || Object.keys(tymy).length;
    Object.keys(tymy).forEach(k => { tymy[k] = null; });
    kola.forEach((k, ki) => {
      const c = k.poradi.find(x => x.kat === kat);
      if (!c) return;
      c.rows.forEach(r => {
        const t = tymy[kl(r)] = tymy[kl(r)] || { druzstvo: String(r.druzstvo).trim(), body: kola.map(() => null), mista: kola.map(() => null), nejCas: null };
        t.body[ki] = r.stav === 'platný' ? soBodyZa_(p.body, r.poradi, N) : r.stav === 'NP' ? (p.bodyNP != null ? p.bodyNP : soBodyZa_(p.body, r.poradi, N)) : r.stav === 'DIS' ? 0 : null; // nenastoupil = nestartoval
        if (r.poradi && (r.stav === 'platný' || r.stav === 'NP')) t.mista[ki] = r.poradi;
        if (r.stav === 'platný' && r.nejlepsi != null && (t.nejCas == null || r.nejlepsi < t.nejCas)) t.nejCas = r.nejlepsi;
      });
    });
    const rows = Object.keys(tymy).map(k => {
      const t = tymy[k], starty = t.body.filter(x => x != null).sort((a, b) => b - a);
      const zapoc = p.zapocitat ? starty.slice(0, p.zapocitat) : starty;
      // které kolo se započítává (nejlepší kola; při stejných bodech dřívější) – pro tabulku po kolech
      const pocita = t.body.map(() => false); t.body.map((b, i) => [b, i]).filter(x => x[0] != null).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, p.zapocitat || t.body.length).forEach(x => { pocita[x[1]] = true; });
      return { druzstvo: t.druzstvo, body: t.body, pocita: pocita, mista: t.mista, nejCas: t.nejCas, celkem: zapoc.reduce((a, b) => a + b, 0), starty: starty.length, hodnocen: starty.length >= p.minKol };
    });
    const pocetMist = (r, m) => r.mista.filter(x => x === m).length;
    const cmp = (a, b) => (b.celkem - a.celkem) ||
      (() => { for (let m = 1; m <= Math.max(N, 1); m++) { const d = pocetMist(b, m) - pocetMist(a, m); if (d) return d; } return 0; })() ||
      ((a.nejCas == null ? 1e9 : a.nejCas) - (b.nejCas == null ? 1e9 : b.nejCas));
    const hodn = rows.filter(r => r.hodnocen).sort((a, b) => cmp(a, b) || a.druzstvo.localeCompare(b.druzstvo, 'cs'));
    hodn.forEach((r, i) => { r.poradi = i && cmp(hodn[i - 1], r) === 0 ? hodn[i - 1].poradi : i + 1; });
    const ost = rows.filter(r => !r.hodnocen).sort((a, b) => cmp(a, b));
    ost.forEach(r => { r.poradi = null; });
    return { kat: kat, druzstev: N, rows: hodn.concat(ost) };
  });
}

/* ---------- API ---------- */

function apiSouteze_(req) {
  let o = prihlaseny_(req.token);
  if (!o) return { ok: false, chyba: 'Nepřihlášen', odhlasen: true };
  const okresni = ['soutezeOkres', 'soutez', 'soutezUlozit', 'soutezStav', 'soutezStart', 'soutezRozradit', 'soutezTest', 'soutezTestLiga', 'soutezDruzstvo', 'soutezZverejnit', 'poharUlozit', 'soutezOz'];
  const poradatelske = ['soutez', 'soutezUlozit', 'soutezStav', 'soutezStart', 'soutezRozradit', 'soutezTest', 'soutezDruzstvo', 'soutezZverejnit', 'soutezOz']; // sbor, který soutěž pořádá (schválená žádost)
  if (okresni.indexOf(req.akce) >= 0) {
    if (!smiSouteze_(o)) {
      const u = req.sbor ? pohledSboru_(o, req.sbor) : null;
      if (!u || poradatelske.indexOf(req.akce) < 0 || !req.id) return { ok: false, chyba: 'Soutěže spravuje role Soutěže nebo Správce, sborovou soutěž sbor, který ji pořádá.' };
      o = Object.assign({}, o, { soPoradatel: u.sbor.skupina, soPoradatelNazev: u.sbor.sbor }); // konkrétní soutěž ještě ověří soMuze_
    }
    switch (req.akce) {
      case 'soutezeOkres': return soOkres_(o);
      case 'soutez': return soDetail_(o, String(req.id || ''));
      case 'soutezUlozit': return soUlozit_(o, req);
      case 'soutezStav': return soZmenitStav_(o, req);
      case 'soutezStart': return soStart_(o, req);
      case 'soutezRozradit': return soRozradit_(o, req);
      case 'soutezTest': return soTestDoplnit_(o, req);
      case 'soutezTestLiga': return soTestLiga_(o);
      case 'soutezDruzstvo': return soDruzstvoOkres_(o, req);
      case 'soutezZverejnit': return soZverejnit_(o, req);
      case 'poharUlozit': return soPoharUlozit_(o, req);
      case 'soutezOz': return soOzVytvorit_(o, req);
    }
  }
  // portál sboru: vždy jen vlastní sbor (pohledSboru_ ověří členství)
  const u = pohledSboru_(o, req.sbor);
  if (!u) return { ok: false, chyba: 'Ke sboru ' + (req.sbor || '(nevybrán)') + ' nemáte přístup.' };
  if (req.akce === 'soutezeSbor') return soSbor_(u);
  if (req.akce === 'soutezPrihlasit') return soPrihlasit_(o, u, req);
  if (req.akce === 'soutezOdhlasit') return soOdhlasit_(o, u, req);
  return { ok: false, chyba: 'Neznámá akce' };
}

/** Seznam pro okres: soutěže (podle role), poháry, schválené žádosti o pořádání soutěže bez založené soutěže. */
function soOkres_(o) {
  const role = soRole_(o), druzstva = soDruzstva_(null, false), vys = radky_(LIST_VYSLEDKY);
  const souteze = soSouteze_().filter(s => role === 'všechny' || s.pro === role).map(s => {
    const d = druzstva.filter(x => x.soutez === s.id && x.stav !== 'odhlášeno');
    s.pocty = s.kategorie.map(k => ({ kat: k, n: d.filter(x => x.kat === k).length }));
    s.druzstev = d.length;
    s.vysledku = vys.filter(v => String(v['Akce – ID']) === s.id).length;
    return s;
  });
  const maSoutez = {}; radky_(LIST_SOUTEZE).forEach(r => { if (r['Žádost – ID']) maSoutez[String(r['Žádost – ID'])] = true; maSoutez['A:' + r['Akce – ID']] = true; });
  const zadosti = radky_(LIST_ZADOSTI).filter(z => z['Typ'] === 'pořádání soutěže' && z['Stav'] === 'schváleno' && z['Akce – ID'] && !maSoutez[String(z['ID'])] && !maSoutez['A:' + z['Akce – ID']])
    .map(z => ({ id: String(z['ID']), akce: String(z['Akce – ID']), nazev: String(z['Název'] || ''), sbor: String(z['Sbor'] || ''), datum: soDen_(z['Datum']), misto: String(z['Místo'] || '') }));
  const vsechny = soSouteze_(), pohary = soPohary_().filter(p => role === 'všechny' || p.pro === role).map(p => Object.assign(p, { poradi: soPoharVypocet_(p, vsechny, druzstva).poradi }));
  const sbory = radkyRychle_('Sbory').filter(r => r['Sbor'] && String(r['Aktivní']).trim().toUpperCase() !== 'NE').map(r => String(r['Sbor'])).sort((a, b) => a.localeCompare(b, 'cs'));
  return { ok: true, data: souteze.sort((a, b) => String(b.od).localeCompare(String(a.od))), pohary: pohary, zadosti: zadosti, sbory: sbory, role: role, hotove: SO_DRUHY_HOTOVE };
}

function soNajit_(id) {
  const t = soTab_(LIST_SOUTEZE), i = soRadky_(t).find(x => String(x.r[t.col('Akce – ID')]) === id);
  return i ? { t: t, r: i.r, n: i.n } : null;
}
function soAkceRadek_(id) {
  const t = soTab_('Akce'), x = soRadky_(t).find(y => String(y.r[t.col('ID')]) === id);
  return x ? { t: t, r: x.r, n: x.n } : null;
}
function soNacistJednu_(id) {
  const x = soNajit_(id), a = x && soAkceRadek_(id);
  return x && a ? soJson_(soObj_(x.t.h, x.r), soObj_(a.t.h, a.r)) : null;
}

/** Detail pro okres: soutěž, družstva (s kontaktem), výsledky, pořadí, pohár. */
function soDetail_(o, id) {
  const s = soNacistJednu_(id);
  if (!s) return { ok: false, chyba: 'Soutěž nenalezena.' };
  if (!soMuze_(o, s)) return { ok: false, chyba: 'Tuto soutěž nespravujete.' };
  const druzstva = soDruzstva_(id, true), vysledky = soVysledky_(id);
  return { ok: true, data: s, druzstva: druzstva, vysledky: vysledky, poradi: soPoradi_(s, druzstva, vysledky) };
}

/** Založení / úprava soutěže. data = pole pro Akce i Soutěže. zadost = ID schválené žádosti (soutěž k její akci). */
function soUlozit_(o, req) {
  const d = req.data || {}, id = String(req.id || '');
  const chyba = kontrolaTextu_({ 'Název': d.nazev, 'Místo': d.misto, 'Pořadatel': d.poradatel, 'Popis': d.popis, 'Kategorie': d.kategorie, 'Hlavní rozhodčí': d.hlavniRozhodci, 'Poznámka': d.poznamka },
      { 'Název': 200, 'Místo': 200, 'Pořadatel': 100, 'Popis': 5000, 'Kategorie': 400, 'Hlavní rozhodčí': 100, 'Poznámka': 1000 }) ||
    kontrolaVolby_(d.druh, SO_DRUHY, 'Druh') || kontrolaVolby_(d.pro, ['MH', 'dospělí'], 'Pro') || kontrolaVolby_(d.shoda, SO_SHODA, 'Shoda časů') ||
    kontrolaData_(d.od, 'Od') || kontrolaData_(d.do, 'Do') || kontrolaData_(d.uzaverka, 'Uzávěrka') || kontrolaOdkazu_(d.propozice, 'Propozice') ||
    (d.pokusy !== undefined && [1, 2].indexOf(Number(d.pokusy)) < 0 ? 'Pokusy: 1 nebo 2.' : null) ||
    (d.kolo !== undefined && d.kolo !== '' && d.kolo !== null && !(Number(d.kolo) >= 1 && Number(d.kolo) <= 30) ? 'Kolo poháru: číslo 1–30.' : null);
  if (chyba) return { ok: false, chyba: chyba };
  const jePoradatel = !!o.soPoradatel && !smiSouteze_(o); // pořádající sbor: jen svou existující soutěž, bez termínu, místa a poháru (ty schválil okres)
  if (jePoradatel && !id) return { ok: false, chyba: 'Sbor zakládá soutěž žádostí o pořádání (Žádosti).' };
  if (!jePoradatel && !smiSouteze_(o, d.pro || 'MH')) return { ok: false, chyba: 'Soutěže pro ' + (d.pro || 'MH') + ' nespravujete.' };
  if (d.druh && SO_DRUHY_HOTOVE.indexOf(d.druh) < 0) return { ok: false, chyba: d.druh + ' zatím aplikace neumí vyhodnotit.' };
  const kat = soKategorie_(d.kategorie);
  if (!kat.length) return { ok: false, chyba: 'Vyplňte aspoň jednu kategorii (např. muži, ženy).' };
  if (kat.length > 12 || kat.some(k => k.length > 40)) return { ok: false, chyba: 'Nejvýš 12 kategorií, každá do 40 znaků.' };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const ted = new Date();
    let x = id ? soNajit_(id) : null, a = null, akceId = id;
    if (id && !x) return { ok: false, chyba: 'Soutěž nenalezena.' };
    if (x) {
      const st = x.r[x.t.col('Stav')];
      if (st === 'zveřejněno' || st === 'zrušeno') return { ok: false, chyba: 'Soutěž je ve stavu „' + st + '“ – už ji nejde upravit.' };
      const pro0 = x.r[x.t.col('Pro')] || 'MH';
      if (!soMuze_(o, { pro: pro0, poradatelSkupina: String(x.r[x.t.col('Pořadatel – skupina')] || '').toLowerCase() })) return { ok: false, chyba: 'Tuto soutěž nespravujete.' };
      if (jePoradatel) ['nazev', 'od', 'do', 'misto', 'poradatel', 'pohar', 'kolo'].forEach(k => { delete d[k]; });
    }
    // řádek Akce: ze žádosti (už existuje), při úpravě (existuje), jinak nový (zveřejněno → kalendář, B5.4)
    if (!x && req.zadost) {
      const z = radky_(LIST_ZADOSTI).find(r => String(r['ID']) === String(req.zadost));
      if (!z || z['Stav'] !== 'schváleno' || !z['Akce – ID']) return { ok: false, chyba: 'Žádost není schválená nebo nemá akci.' };
      akceId = String(z['Akce – ID']);
      if (soNajit_(akceId)) return { ok: false, chyba: 'K této žádosti už soutěž existuje.' };
    }
    a = akceId ? soAkceRadek_(akceId) : null;
    if (akceId && !a) return { ok: false, chyba: 'Akce ' + akceId + ' nenalezena.' };
    const ta = a ? a.t : soTab_('Akce'), ra = a ? a.r : ta.h.map(() => '');
    const pred = a ? JSON.stringify([ra[ta.col('Název')], soIso_(ra[ta.col('Od')])]) : '';
    const seta = (k, v) => { if (ta.col(k) >= 0 && v !== undefined) ra[ta.col(k)] = v; };
    seta('Název', d.nazev !== undefined ? bezVzorce_(String(d.nazev).trim()) : undefined);
    if (d.od) seta('Od', new Date(d.od));
    if (d.do !== undefined) seta('Do', d.do ? new Date(d.do) : '');
    seta('Místo', d.misto !== undefined ? bezVzorce_(String(d.misto)) : undefined);
    seta('Pořadatel', d.poradatel !== undefined ? bezVzorce_(String(d.poradatel)) : undefined);
    seta('Popis', d.popis !== undefined ? bezVzorce_(String(d.popis)) : undefined);
    if (!a) { seta('Typ', 'soutěž'); seta('Pro koho', 'veřejnost'); seta('Stav', 'zveřejněno'); seta('Vytvořeno', ted); seta('Vytvořil', o.email); }
    seta('Upraveno', ted); seta('Upravil', o.email);
    if (!String(ra[ta.col('Název')] || '').trim()) return { ok: false, chyba: 'Chybí název soutěže.' };
    if (!(ra[ta.col('Od')] instanceof Date)) return { ok: false, chyba: 'Chybí datum soutěže.' };
    doplnitId_('Akce', ta.h, ra);
    try { syncRadek_(kalendar_(), 'Akce', ta.h, ra); } catch (e) { console.error('Kalendář: ' + e.message); }
    if (a) ta.sh.getRange(a.n, 1, 1, ta.h.length).setValues([ra.map(bezVzorce_)]); else ta.sh.appendRow(ra.map(bezVzorce_));
    akceId = String(ra[ta.col('ID')]);
    if (!a) zaznamZmeny_(o.email, 'Akce', akceId, 'vytvořeno', '', 'soutěž' + (req.zadost ? ' ze žádosti ' + req.zadost : ''));
    else zaznamZmeny_(o.email, 'Akce', akceId, 'upraveno', pred, JSON.stringify([ra[ta.col('Název')], soIso_(ra[ta.col('Od')])]));
    // řádek Soutěže
    const t = x ? x.t : soTab_(LIST_SOUTEZE), r = x ? x.r : t.h.map(() => '');
    const set = (k, v) => { if (t.col(k) >= 0 && v !== undefined) r[t.col(k)] = v; };
    set('Akce – ID', akceId); set('Druh', d.druh || r[t.col('Druh')] || 'požární útok'); set('Pro', d.pro || r[t.col('Pro')] || 'MH');
    set('Kategorie', bezVzorce_(kat.join(', '))); set('Pokusy', r[t.col('Druh')] === 'ZHVB' ? 1 : d.pokusy !== undefined ? Number(d.pokusy) : (r[t.col('Pokusy')] || 2)); // ZHVB = jeden průchod tratí
    set('Shoda časů', d.shoda || r[t.col('Shoda časů')] || 'pravidla SH ČMS');
    if (d.uzaverka !== undefined) set('Uzávěrka', d.uzaverka ? new Date(d.uzaverka) : '');
    if (d.propozice !== undefined) set('Propozice', String(d.propozice || '').trim());
    if (d.pohar !== undefined) {
      if (d.pohar && !soPohary_().some(p => p.id === String(d.pohar))) return { ok: false, chyba: 'Pohár ' + d.pohar + ' nenalezen.' };
      set('Pohár – ID', String(d.pohar || ''));
    }
    if (d.kolo !== undefined) set('Kolo', d.kolo === '' || d.kolo === null ? '' : Number(d.kolo));
    if (d.hlavniRozhodci !== undefined) set('Hlavní rozhodčí', bezVzorce_(String(d.hlavniRozhodci).trim()));
    if (d.poznamka !== undefined) set('Poznámka', bezVzorce_(String(d.poznamka)));
    if (d.stojany !== undefined) { // uzlová štafeta: jména rozhodčích u stojanů
      const st = Array.isArray(d.stojany) ? d.stojany.map(x => String(x == null ? '' : x).trim()) : [];
      if (st.length > 30) return { ok: false, chyba: 'Nejvýš 30 stojanů.' };
      const ch2 = st.map((x, i) => kontrolaTextu_({ ['Stojan ' + (i + 1)]: x }, { ['Stojan ' + (i + 1)]: 60 })).find(Boolean);
      if (ch2) return { ok: false, chyba: ch2 };
      set('Stojany', st.length ? JSON.stringify(st.map(bezVzorce_)) : '');
    }
    if (d.oz !== undefined) { const z = soOzKontrola_(d.oz, kat); if (z.chyba) return { ok: false, chyba: z.chyba }; set('OZ', JSON.stringify(z.oz)); }
    if (r[t.col('Druh')] === 'Hra Plamen') { // disciplíny kola a počet pokusů / štafet; Pokusy = nejvíc z nich (panel)
      if (t.col('Disciplíny') < 0) return { ok: false, chyba: 'V listu Soutěže chybí sloupec Disciplíny – spusťte v tabulce OSH data → Založit / doplnit strukturu.' };
      const dis = soDisciplinyCist_(d.discipliny !== undefined ? d.discipliny : r[t.col('Disciplíny')]);
      if (!dis.length) return { ok: false, chyba: 'Vyberte aspoň jednu disciplínu kola.' };
      set('Disciplíny', JSON.stringify(dis)); set('Pokusy', Math.max.apply(null, dis.map(x => x.pokusy)));
    }
    if (!x) { set('Stav', 'koncept'); set('Žádost – ID', req.zadost ? String(req.zadost) : ''); set('Vytvořeno', ted); set('Vytvořil', o.email); }
    set('Upraveno', ted); set('Upravil', o.email);
    if (x) t.sh.getRange(x.n, 1, 1, t.h.length).setValues([r]); else t.sh.appendRow(r);
    zaznamZmeny_(o.email, LIST_SOUTEZE, akceId, x ? 'upraveno' : 'vytvořeno', '', kat.join(', ') + ' · ' + (r[t.col('Pokusy')]) + ' pokusy');
    vycistitCache_();
    let varovani = ''; // OZ v PDF už existuje → hned aktualizovat podle uložených údajů
    if (t.col('OZ – PDF') >= 0 && r[t.col('OZ – PDF')]) { try { soOzPdfUlozit_(akceId); } catch (e) { console.error(e); varovani = 'Soutěž je uložená, ale PDF organizačního zabezpečení se nepodařilo aktualizovat: ' + e.message; } }
    return Object.assign(soDetail_(o, akceId), varovani ? { varovani: varovani } : {});
  } finally { lock.releaseLock(); }
}

/** Přechody stavu. Okres: koncept ↔ přihlášky ↔ uzavřeno ↔ závod (kódy) ← ověřeno; zveřejnit zvlášť (soutezZverejnit); zrušit. */
function soZmenitStav_(o, req) {
  const id = String(req.id || ''), novy = String(req.stav || '');
  const povolene = { 'koncept': ['přihlášky', 'zrušeno'], 'přihlášky': ['koncept', 'uzavřeno', 'zrušeno'], 'uzavřeno': ['přihlášky', 'závod', 'zrušeno'],
    'závod': ['uzavřeno', 'závod', 'zrušeno'], 'ověřeno': ['závod'], 'zveřejněno': ['ověřeno'] };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const x = soNajit_(id);
    if (!x) return { ok: false, chyba: 'Soutěž nenalezena.' };
    const t = x.t, r = x.r, c = t.col, pred = r[c('Stav')] || 'koncept', pro = r[c('Pro')] || 'MH';
    if (!soMuze_(o, { pro: pro, poradatelSkupina: String(r[c('Pořadatel – skupina')] || '').toLowerCase() })) return { ok: false, chyba: 'Tuto soutěž nespravujete.' };
    if ((povolene[pred] || []).indexOf(novy) < 0) return { ok: false, chyba: 'Ze stavu „' + pred + '“ nejde přejít na „' + novy + '“.' };
    const ted = new Date(), out = { ok: true };
    if (novy === 'přihlášky' && !soKategorie_(r[c('Kategorie')]).length) return { ok: false, chyba: 'Nejdřív doplňte kategorie.' };
    if (novy === 'závod') {
      // startovní pořadí: kdo ho nemá, dostane číslo podle pořadí přihlášení (los / ruční úprava zůstane)
      soDoplnitStart_(id);
      const a = soAkceRadek_(id), konec = a ? (a.r[a.t.col('Do')] || a.r[a.t.col('Od')]) : ted;
      const den = soDen_(konec instanceof Date ? konec : ted).split('-').map(Number);
      const plati = new Date(den[0], den[1] - 1, den[2], 23, 59, 59);
      if (plati < ted) return { ok: false, chyba: 'Soutěž už podle data skončila. Upravte datum (Do), pak vytvořte odkazy pro rozhodčí.' };
      const k1 = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 32), k2 = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 32);
      r[c('Kód rozhodčích – otisk')] = otisk_('so|' + k1); r[c('Kód hlavního rozhodčího – otisk')] = otisk_('so|' + k2); r[c('Kódy platí do')] = plati;
      const web = String(nastaveniWeb_('WEB_URL') || '').replace(/\/+$/, '');
      out.kody = { rozhodci: web + '/zavod.html#k=' + k1, hlavni: web + '/zavod.html#k=' + k2, plati: plati.toISOString() };
    }
    if (novy === 'uzavřeno' || novy === 'koncept' || novy === 'přihlášky' || novy === 'zrušeno') {
      r[c('Kód rozhodčích – otisk')] = ''; r[c('Kód hlavního rozhodčího – otisk')] = ''; r[c('Kódy platí do')] = '';
    }
    if (pred === 'ověřeno' && novy === 'závod') { r[c('Ověřil')] = ''; r[c('Ověřeno')] = ''; soStavVysledku_(id, 'zapsáno'); }
    if (pred === 'zveřejněno') { r[c('Zveřejnil')] = ''; r[c('Zveřejněno')] = ''; soStavVysledku_(id, 'ověřeno'); soSdiletPdf_(r[c('Výsledky – PDF')], false); }
    if (novy === 'zrušeno') { // akce zmizí z kalendáře i webu, řádky zůstanou; žádost sboru → Zrušeno, vybavení uvolněné
      try { zadostPoZruseniAkce_(id, o.email, o.soPoradatel ? 'Soutěž zrušil pořádající sbor.' : 'Soutěž zrušil okres.'); } catch (e) { console.error(e); }
      const a = soAkceRadek_(id);
      if (a) { a.r[a.t.col('Stav')] = 'zrušeno'; try { syncRadek_(kalendar_(), 'Akce', a.t.h, a.r); } catch (e) { console.error(e); } a.t.sh.getRange(a.n, 1, 1, a.t.h.length).setValues([a.r]); }
    }
    if (c('OZ – PDF') >= 0 && r[c('OZ – PDF')]) soSdiletPdf_(r[c('OZ – PDF')], SO_PRO_SBORY.indexOf(novy) >= 0); // OZ veřejné od otevření přihlášek
    r[c('Stav')] = novy; r[c('Upraveno')] = ted; r[c('Upravil')] = o.email;
    t.sh.getRange(x.n, 1, 1, t.h.length).setValues([r]);
    zaznamZmeny_(o.email, LIST_SOUTEZE, id, 'upraveno', pred, novy + (novy === 'závod' ? ' (nové odkazy pro rozhodčí)' : ''));
    if (o.soPoradatel && novy === 'zrušeno') { try { const a2 = soAkceRadek_(id); soPostaOkresu_({ pro: pro, nazev: a2 ? String(a2.r[a2.t.col('Název')]) : id, od: a2 ? soIso_(a2.r[a2.t.col('Od')]) : '', id: id }, 'Sbor zrušil soutěž', 'SDH ' + (o.soPoradatelNazev || '') + ' zrušil svou soutěž. Zmizela z kalendáře i webu okresu.'); } catch (e) { console.error(e); } }
    vycistitCache_();
    const det = soDetail_(o, id);
    return Object.assign(det, out.kody ? { kody: out.kody } : {});
  } finally { lock.releaseLock(); }
}

function soStavVysledku_(id, stav) {
  const t = soTab_(LIST_VYSLEDKY), v = soRadky_(t).filter(x => String(x.r[t.col('Akce – ID')]) === id);
  v.forEach(x => { x.r[t.col('Stav')] = stav; t.sh.getRange(x.n, 1, 1, t.h.length).setValues([x.r]); });
}

/** Družstvům bez startovního čísla doplní číslo za posledním v kategorii (podle pořadí přihlášení). */
function soDoplnitStart_(id) {
  const t = soTab_(LIST_DRUZSTVA), c = t.col, v = soRadky_(t).filter(x => String(x.r[c('Akce – ID')]) === id), max = {};
  v.forEach(x => { const k = x.r[c('Akce – ID')] + '|' + x.r[c('Kategorie')], s = soCislo_(x.r[c('Start')]); if (s && x.r[c('Stav')] !== 'odhlášeno') max[k] = Math.max(max[k] || 0, s); });
  v.forEach(x => {
    if (x.r[c('Stav')] === 'odhlášeno' || soCislo_(x.r[c('Start')])) return;
    const k = x.r[c('Akce – ID')] + '|' + x.r[c('Kategorie')];
    max[k] = (max[k] || 0) + 1; x.r[c('Start')] = max[k];
    t.sh.getRange(x.n, 1, 1, t.h.length).setValues([x.r]);
  });
}

/** Startovní pořadí v kategorii: los = náhodně, jinak poradi = [ID přihlášek v pořadí]. */
function soStart_(o, req) {
  const id = String(req.id || ''), kat = String(req.kategorie || '');
  const s = soNacistJednu_(id);
  if (!s) return { ok: false, chyba: 'Soutěž nenalezena.' };
  if (!soMuze_(o, s)) return { ok: false, chyba: 'Tuto soutěž nespravujete.' };
  if (['koncept', 'přihlášky', 'uzavřeno', 'závod'].indexOf(s.stav) < 0) return { ok: false, chyba: 'Po ověření výsledků už startovní pořadí nejde měnit.' };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const t = soTab_(LIST_DRUZSTVA), c = t.col, v = soRadky_(t).filter(x => String(x.r[c('Akce – ID')]) === id && x.r[c('Kategorie')] === kat && x.r[c('Stav')] !== 'odhlášeno');
    let poradi;
    if (req.los) { poradi = v.map(x => String(x.r[c('ID')])); for (let i = poradi.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [poradi[i], poradi[j]] = [poradi[j], poradi[i]]; } }
    else {
      poradi = (Array.isArray(req.poradi) ? req.poradi : []).map(String);
      const ids = v.map(x => String(x.r[c('ID')])).sort();
      if (poradi.slice().sort().join('|') !== ids.join('|')) return { ok: false, chyba: 'Seznam družstev se mezitím změnil. Načtěte soutěž znovu.' };
    }
    v.forEach(x => { x.r[c('Start')] = poradi.indexOf(String(x.r[c('ID')])) + 1; t.sh.getRange(x.n, 1, 1, t.h.length).setValues([x.r]); });
    zaznamZmeny_(o.email, LIST_DRUZSTVA, id, 'upraveno', '', 'startovní pořadí ' + kat + (req.los ? ' (los)' : ' (ručně)'));
    return soDetail_(o, id);
  } finally { lock.releaseLock(); }
}

/** Okres přidá / upraví / odhlásí družstvo kdykoli před ověřením (pozdní přihláška, přihláška na místě). */
function soDruzstvoOkres_(o, req) {
  const id = String(req.id || ''), d = req.data || {};
  const s = soNacistJednu_(id);
  if (!s) return { ok: false, chyba: 'Soutěž nenalezena.' };
  if (!soMuze_(o, s)) return { ok: false, chyba: 'Tuto soutěž nespravujete.' };
  if (['koncept', 'přihlášky', 'uzavřeno', 'závod'].indexOf(s.stav) < 0) return { ok: false, chyba: 'Po ověření výsledků už družstva nejde měnit.' };
  const sbory = radkyRychle_('Sbory'), sb = sbory.find(r => String(r['Sbor']) === String(d.sbor || ''));
  const v = soZapsatDruzstvo_(o, s, { prihlaska: req.prihlaska, sbor: sb ? String(sb['Sbor']) : String(d.sbor || '').trim(), skupina: sb ? String(sb['Skupina'] || '').split('@')[0] : '',
    kat: d.kat, druzstvo: d.druzstvo, kontakt: d.kontakt, odhlasit: !!req.odhlasit });
  return v.ok ? soDetail_(o, id) : v;
}

/** Zápis přihlášky družstva (sbor i okres). prihlaska = ID při úpravě / odhlášení. */
function soZapsatDruzstvo_(o, s, x) {
  const druzstvo = String(x.druzstvo || '').trim(), kontakt = normEmail_(x.kontakt || o.email);
  if (!x.odhlasit) {
    const ch = kontrolaTextu_({ 'Družstvo': druzstvo, 'Sbor': x.sbor }, { 'Družstvo': 60, 'Sbor': 100 });
    if (ch) return { ok: false, chyba: ch };
    if (!x.sbor) return { ok: false, chyba: 'Vyberte sbor.' };
    if (!druzstvo) return { ok: false, chyba: /jednotliv/i.test(x.kat) ? 'Vyplňte jméno a příjmení závodníka.' : 'Vyplňte název družstva (např. ' + String(x.sbor).replace(/^SDH\s+/i, '') + ' A).' };
    if (s.kategorie.indexOf(x.kat) < 0) return { ok: false, chyba: 'Vyberte kategorii.' };
    if (kontakt && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(kontakt)) return { ok: false, chyba: 'Kontakt: neplatný e-mail.' };
  }
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const t = soTab_(LIST_DRUZSTVA), c = t.col, v = soRadky_(t), ted = new Date();
    const moje = v.filter(y => String(y.r[c('Akce – ID')]) === s.id && y.r[c('Stav')] !== 'odhlášeno');
    let y = x.prihlaska ? v.find(z => String(z.r[c('ID')]) === String(x.prihlaska) && String(z.r[c('Akce – ID')]) === s.id) : null;
    if (x.prihlaska && !y) return { ok: false, chyba: 'Přihláška nenalezena.' };
    if (y && x.skupinaOvereni && String(y.r[c('Skupina')]) !== x.skupinaOvereni) return { ok: false, chyba: 'Přihláška patří jinému sboru.' };
    if (x.odhlasit) {
      if (!y) return { ok: false, chyba: 'Přihláška nenalezena.' };
      if (soVysledky_(s.id).some(w => w.prihlaska === String(y.r[c('ID')]))) return { ok: false, chyba: 'Družstvo už má zapsaný výsledek – odhlásit ho nejde (rozhodčí může zapsat „nenastoupil“).' };
      y.r[c('Stav')] = 'odhlášeno'; y.r[c('Upraveno')] = ted; y.r[c('Upravil')] = o.email;
      t.sh.getRange(y.n, 1, 1, t.h.length).setValues([y.r]);
      zaznamZmeny_(o.email, LIST_DRUZSTVA, String(y.r[c('ID')]), 'upraveno', 'přihlášeno', 'odhlášeno');
      return { ok: true };
    }
    const kl = druzstvo.toLowerCase();
    if (moje.some(z => z !== y && z.r[c('Kategorie')] === x.kat && String(z.r[c('Družstvo')]).trim().toLowerCase() === kl))
      return { ok: false, chyba: /jednotliv/i.test(x.kat) ? 'Závodník „' + druzstvo + '“ už je v kategorii ' + x.kat + ' přihlášený.' : 'Družstvo „' + druzstvo + '“ už je v kategorii ' + x.kat + ' přihlášené. Odlište ho (A, B…).' };
    if (!y && moje.filter(z => z.r[c('Sbor')] === x.sbor).length >= SO_MAX_DRUZSTEV) return { ok: false, chyba: 'Sbor má v soutěži už ' + SO_MAX_DRUZSTEV + ' družstev.' };
    const limit = x.limitSdh ? ((s.oz.kategorie || {})[x.kat] || {}).maxSdh : null; // OZ: max. družstev na SDH v kategorii (hlídá se jen u sborů)
    if (limit && moje.filter(z => z !== y && z.r[c('Sbor')] === x.sbor && z.r[c('Kategorie')] === x.kat).length >= limit)
      return { ok: false, chyba: 'Podle organizačního zabezpečení může sbor v kategorii ' + x.kat + ' přihlásit nejvýš ' + limit + (/jednotliv/i.test(x.kat) ? (limit === 1 ? ' závodníka.' : limit < 5 ? ' závodníky.' : ' závodníků.') : (limit === 1 ? ' družstvo.' : limit < 5 ? ' družstva.' : ' družstev.')) };
    // OZ: společný limit pro víc kategorií (např. mladší + starší dohromady max. 4 hlídky na SDH) – jen u sborů, okres smí výjimku
    const plna = x.limitSdh ? (s.oz.spolecne || []).find(g => g.kat.indexOf(x.kat) >= 0 && moje.filter(z => z !== y && z.r[c('Sbor')] === x.sbor && g.kat.indexOf(z.r[c('Kategorie')]) >= 0).length >= g.max) : null;
    if (plna) return { ok: false, chyba: 'Podle organizačního zabezpečení může sbor v kategoriích ' + soSeznam_(plna.kat) + ' přihlásit dohromady nejvýš ' + soTvarDruzstev_(plna.max, s.druh === 'ZHVB') + '.' };
    const r = y ? y.r : t.h.map(() => '');
    const set = (k, val) => { if (c(k) >= 0) r[c(k)] = val; };
    const katPred = y ? r[c('Kategorie')] : '';
    if (!y) { set('ID', soNoveId_('D')); set('Akce – ID', s.id); set('Stav', 'přihlášeno'); set('Přihlásil', o.email); set('Vytvořeno', ted); set('Vytvořil', o.email); }
    set('Sbor', bezVzorce_(x.sbor)); if (x.skupina) set('Skupina', x.skupina); set('Kategorie', bezVzorce_(x.kat)); set('Družstvo', bezVzorce_(druzstvo)); set('Kontakt', kontakt);
    if (y && katPred !== x.kat) set('Start', ''); // jiná kategorie = nové startovní číslo
    if (!y && s.stav === 'závod') { // přihláška na místě: hned na konec startovky
      set('Start', moje.filter(z => z.r[c('Kategorie')] === x.kat).reduce((m, z) => Math.max(m, soCislo_(z.r[c('Start')]) || 0), 0) + 1);
    }
    set('Upraveno', ted); set('Upravil', o.email);
    if (y) t.sh.getRange(y.n, 1, 1, t.h.length).setValues([r]); else t.sh.appendRow(r);
    zaznamZmeny_(o.email, LIST_DRUZSTVA, String(r[c('ID')]), y ? 'upraveno' : 'vytvořeno', '', s.nazev + ': ' + x.kat + ' – ' + druzstvo);
    return { ok: true, id: String(r[c('ID')]) };
  } finally { lock.releaseLock(); }
}

/* ---------- uzlová štafeta: rozřazení ke stojanům ---------- */

/**
 * Rozdělí přihlášky do rozběhů u stojanů (čistá funkce, kvůli testu bez tabulky). Kategorie jdou po sobě, v každé nejdřív všechny 1. pokusy, pak 2. pokusy.
 * Pravidla: závodníci (družstva) jednoho sboru nikdy ve stejném rozběhu – vedoucí je u všech; 2. pokus u jiného stojanu (jiný rozhodčí).
 * Rozběhů = max(počet / stojanů, nejvíc závodníků jednoho sboru v kategorii). Přiřazení „k-tý v pořadí → rozběh k mod R“ se sbory od největšího
 * dává každému sboru různé rozběhy a rozběhy nejvýš po S. Vrací { mapa: { ID: { r1, s1, r2, s2 } }, info: [...] }.
 */
function soRozdelit_(kategorie, druzstva, S, pokusy, nahoda) {
  const rnd = nahoda || Math.random, michat = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const kats = (kategorie || []).slice(); druzstva.forEach(d => { if (kats.indexOf(d.kat) < 0) kats.push(d.kat); });
  const mapa = {}, info = []; let zaklad = 0;
  kats.forEach(kat => {
    const v = druzstva.filter(d => d.kat === kat);
    if (!v.length) return;
    const skup = {}; v.forEach(d => { const k = String(d.skupina || d.sbor || d.id).toLowerCase(); (skup[k] = skup[k] || []).push(d); });
    const sk = michat(Object.keys(skup)).map(k => ({ sbor: skup[k][0].sbor, l: michat(skup[k]) })).sort((a, b) => b.l.length - a.l.length);
    const minR = Math.ceil(v.length / S), R = Math.max(minR, sk[0].l.length);
    const tvar = (n, a, b, c) => n + ' ' + (n === 1 ? a : n < 5 ? b : c), m = sk[0].l.length, jed = /jednotliv/i.test(kat);
    if (R > minR) info.push(kat + ': ' + tvar(R, 'rozběh', 'rozběhy', 'rozběhů') + ' místo ' + minR + ' – ' + sk[0].sbor + ' má ' + (jed ? tvar(m, 'závodníka', 'závodníky', 'závodníků') : tvar(m, 'družstvo', 'družstva', 'družstev')) + ' a ti nesmí jít naráz.');
    const vlny = []; for (let i = 0; i < R; i++) vlny.push([]);
    let k = 0; sk.forEach(g => g.l.forEach(d => { vlny[k % R].push(d); k++; }));
    michat(vlny).forEach((w, i) => {
      const st = michat(Array.from({ length: S }, (_, j) => j + 1));
      w.forEach((d, j) => { mapa[d.id] = { r1: zaklad + i + 1, s1: st[j], r2: pokusy === 2 ? zaklad + R + i + 1 : null, s2: pokusy === 2 ? (S > 1 ? st[j] % S + 1 : st[j]) : null }; });
    });
    zaklad += R * (pokusy === 2 ? 2 : 1);
  });
  if (S === 1 && pokusy === 2) info.push('Jen jeden stojan – 2. pokus nejde dát k jinému rozhodčímu.');
  return { mapa: mapa, info: info, rozbehu: zaklad };
}

/** Akce soutezRozradit: rozřadí přihlášené (uzlová štafeta) ke stojanům a podle 1. pokusu přečísluje startovní pořadí. */
function soRozradit_(o, req) {
  const id = String(req.id || ''), s = soNacistJednu_(id);
  if (!s) return { ok: false, chyba: 'Soutěž nenalezena.' };
  if (!soMuze_(o, s)) return { ok: false, chyba: 'Tuto soutěž nespravujete.' };
  if (s.druh !== 'uzlová štafeta') return { ok: false, chyba: 'Rozřazení ke stojanům je jen u uzlové štafety.' };
  if (['přihlášky', 'uzavřeno', 'závod'].indexOf(s.stav) < 0) return { ok: false, chyba: 'Rozřadit jde po otevření přihlášek a před ověřením výsledků.' };
  const S = s.stojany.length;
  if (!S) return { ok: false, chyba: 'Nejdřív v Upravit doplňte počet stojanů a rozhodčí.' };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const t = soTab_(LIST_DRUZSTVA), c = t.col;
    if (c('Rozběh 1') < 0) return { ok: false, chyba: 'V listu Přihlášky družstev chybí sloupce Rozběh / Stojan – spusťte v tabulce OSH data → Založit / doplnit strukturu.' };
    const v = soRadky_(t).filter(x => String(x.r[c('Akce – ID')]) === id && x.r[c('Stav')] !== 'odhlášeno');
    if (!v.length) return { ok: false, chyba: 'V soutěži zatím nikdo není přihlášený.' };
    const d = v.map(x => ({ id: String(x.r[c('ID')]), kat: String(x.r[c('Kategorie')]), sbor: String(x.r[c('Sbor')] || ''), skupina: String(x.r[c('Skupina')] || ''), x: x }));
    const roz = soRozdelit_(s.kategorie, d, S, s.pokusy);
    const start = {}; d.slice().sort((a, b) => roz.mapa[a.id].r1 - roz.mapa[b.id].r1 || roz.mapa[a.id].s1 - roz.mapa[b.id].s1).forEach(z => { start[z.kat] = (start[z.kat] || 0) + 1; z.start = start[z.kat]; });
    d.forEach(z => { const m = roz.mapa[z.id], r = z.x.r; r[c('Rozběh 1')] = m.r1; r[c('Stojan 1')] = m.s1; r[c('Rozběh 2')] = m.r2 || ''; r[c('Stojan 2')] = m.s2 || ''; r[c('Start')] = z.start; });
    // celé řádky soutěže najednou (jsou rozházené – zapisuje se po řádcích, ale jen změněné)
    d.forEach(z => t.sh.getRange(z.x.n, 1, 1, t.h.length).setValues([z.x.r]));
    zaznamZmeny_(o.email, LIST_DRUZSTVA, id, 'upraveno', '', 'rozřazení ke stojanům: ' + d.length + ' přihlášek, ' + S + ' stojanů, ' + roz.rozbehu + ' rozběhů');
    return Object.assign(soDetail_(o, id), { zprava: 'Rozřazeno: ' + d.length + ' přihlášek do ' + roz.rozbehu + ' rozběhů u ' + S + ' stojanů.' + (roz.info.length ? ' ' + roz.info.join(' ') : '') });
  } finally { lock.releaseLock(); }
}

/* ---------- testovací data (jen TEST a soutěž s názvem TEST…) ---------- */

const SO_TEST_JMENA = { kluci: ['Jakub', 'Jan', 'Tomáš', 'Matyáš', 'Adam', 'Filip', 'Vojtěch', 'Lukáš', 'Ondřej', 'David', 'Matěj', 'Šimon', 'Daniel', 'Martin', 'Antonín', 'Vít', 'Kryštof', 'Josef'],
  holky: ['Eliška', 'Tereza', 'Anna', 'Adéla', 'Natálie', 'Sofie', 'Karolína', 'Kristýna', 'Viktorie', 'Barbora', 'Klára', 'Ema', 'Julie', 'Nela', 'Rozálie', 'Markéta', 'Zuzana', 'Lucie'],
  prijmeni: [['Novák', 'Nováková'], ['Svoboda', 'Svobodová'], ['Dvořák', 'Dvořáková'], ['Černý', 'Černá'], ['Procházka', 'Procházková'], ['Kučera', 'Kučerová'], ['Veselý', 'Veselá'],
    ['Horák', 'Horáková'], ['Němec', 'Němcová'], ['Pokorný', 'Pokorná'], ['Marek', 'Marková'], ['Pospíšil', 'Pospíšilová'], ['Hájek', 'Hájková'], ['Král', 'Králová'], ['Jelínek', 'Jelínková'],
    ['Růžička', 'Růžičková'], ['Beneš', 'Benešová'], ['Fiala', 'Fialová'], ['Sedláček', 'Sedláčková'], ['Doležal', 'Doležalová'], ['Zeman', 'Zemanová'], ['Kolář', 'Kolářová']] };

/** Akce soutezTest: krok prihlasky = doplní vymyšlené závodníky / družstva (pocet), krok vysledky = náhodné výsledky chybějícím pokusům. */
function soTestDoplnit_(o, req) {
  const id = String(req.id || ''), s = soNacistJednu_(id);
  if (!s) return { ok: false, chyba: 'Soutěž nenalezena.' };
  if (!soMuze_(o, s)) return { ok: false, chyba: 'Tuto soutěž nespravujete.' };
  if (ostryRezim_()) return { ok: false, chyba: 'Testovací data jdou doplnit jen v TESTu.' };
  if (!/^TEST/i.test(s.nazev)) return { ok: false, chyba: 'Testovací data jen u soutěže, jejíž název začíná TEST.' };
  const rnd = Math.random, vyber = a => a[Math.floor(rnd() * a.length)], jedn = k => /jednotliv/i.test(k), uzl = s.druh === 'uzlová štafeta';
  if (req.krok === 'overit') { // jako hlavní rozhodčí v panelu (i když odkazy už podle data neplatí)
    if (s.stav !== 'závod') return { ok: false, chyba: 'Ověřit jde soutěž ve stavu závod.' };
    const x = soNajit_(id), v = soZavodOverit_(Object.assign({}, x, { hlavni: true }), s, { jmeno: s.hlavniRozhodci && s.hlavniRozhodci.length >= 3 ? s.hlavniRozhodci : 'TEST hlavní rozhodčí' });
    return v.ok ? Object.assign(soDetail_(o, id), { zprava: 'Výsledky ověřené (jako hlavní rozhodčí). Teď je můžete zveřejnit.' }) : v;
  }
  if (req.krok === 'vysledky') {
    if (s.stav !== 'závod') return { ok: false, chyba: 'Výsledky jde doplnit ve stavu závod (Zahájit závod).' };
    const druzstva = soDruzstva_(id, false).filter(d => d.stav !== 'odhlášeno'), ma = {};
    soVysledky_(id).forEach(v => { ma[v.prihlaska + '|' + (s.druh === 'Hra Plamen' ? v.disciplina + '|' : '') + v.pokus] = true; });
    const r2 = x => Math.round(x * 100) / 100, ted = new Date().toISOString(), zapisy = [];
    if (s.druh === 'ZHVB') { // celá hlídka jako od sčítací komise: start po 5 min v kategorii, trať 18–45 min, pár trestných bodů a čekání
      const kats = s.kategorie.concat(druzstva.map(d => d.kat)).filter((k, i, a) => a.indexOf(k) === i);
      druzstva.forEach(d => {
        if (ma[d.id + '|1']) return;
        const z = { klic: 'test-' + d.id + '-1', prihlaska: d.id, pokus: 1, platnost: 'platný', poznamka: '', rozhodci: 'TEST sčítací komise', zapsano: ted }, h = rnd();
        if (h < 0.03) { z.platnost = 'nenastoupil'; zapisy.push(z); return; }
        const start = 9 * 3600 + kats.indexOf(d.kat) * 3600 + ((d.start || 1) - 1) * 300, zh = { start: start, cil: start + Math.round((18 + rnd() * 27) * 60) };
        soZhvb_(d.kat, {}).stanoviste.forEach(k => {
          zh[k] = k === 'K8' ? (rnd() < 0.7 ? 0 : 1) : Math.min(15, Math.floor(Math.pow(rnd(), 2.2) * (k === 'K1' ? 12 : 7)));
          if (rnd() < 0.15) zh['c' + k.slice(1)] = 30 + Math.round(rnd() * 150);
        });
        if (h < 0.06) { z.platnost = 'NP'; z.poznamka = 'odmítnutí úkolu na K3'; }
        z.zhvb = zh; zapisy.push(z);
      });
    }
    else if (s.druh === 'Hra Plamen') { // každá disciplína a pokus (štafeta): časy podle disciplíny a kategorie, občas trestné sekundy, NP a nenastoupil
      const ZAKL = { 'požární útok': 22, 'štafeta 4 × 60 m': 62, 'požární útok CTIF': 75, 'štafeta CTIF': 85, 'štafeta požárních dvojic': 40 };
      druzstva.forEach(d => s.discipliny.forEach(x => { for (let p = 1; p <= x.pokusy; p++) {
        if (ma[d.id + '|' + x.d + '|' + p]) continue;
        const z = { klic: 'test-' + d.id + '-' + SO_PLAMEN_DISC.indexOf(x.d) + '-' + p, prihlaska: d.id, disciplina: x.d, pokus: p, casL: null, casP: null, trestne: 0, platnost: 'platný', poznamka: '', rozhodci: 'TEST rozhodčí', zapsano: ted }, h = rnd();
        if (h < 0.02) z.platnost = 'nenastoupil';
        else if (h < 0.08) { z.platnost = 'NP'; z.poznamka = 'neplatný pokus'; }
        else {
          z.casL = r2(ZAKL[x.d] * (/přípravk/i.test(d.kat) ? 1.4 : /mladší/i.test(d.kat) ? 1.15 : 1) * (0.9 + rnd() * 0.35));
          if (x.d === 'požární útok') z.casP = r2(Math.max(10, z.casL + (rnd() - 0.5)));
          else if (x.d !== 'štafeta 4 × 60 m' && rnd() < 0.35) z.trestne = 10 * (1 + Math.floor(rnd() * 3));
        }
        zapisy.push(z);
      } }));
    }
    else druzstva.forEach(d => { for (let p = 1; p <= s.pokusy; p++) {
      if (ma[d.id + '|' + p]) continue;
      const z = { klic: 'test-' + d.id + '-' + p, prihlaska: d.id, pokus: p, casL: null, casP: null, platnost: 'platný', poznamka: '', rozhodci: 'TEST rozhodčí', zapsano: ted }, h = rnd();
      if (h < 0.02) z.platnost = 'nenastoupil';
      else if (h < 0.07) { z.platnost = 'NP'; z.poznamka = uzl ? 'vynechaný uzel' : 'nesražený terč'; }
      else if (uzl) {
        const prip = /přípravk/i.test(d.kat);
        z.casL = r2(prip ? 35 + rnd() * 45 : jedn(d.kat) ? 22 + rnd() * 30 : 32 + rnd() * 26);
        z.uzly = rnd() < 0.15 ? 1 : rnd() < 0.03 ? 2 : 0; z.pomoc = rnd() < 0.05 ? 1 : 0; z.starty = !jedn(d.kat) && rnd() < 0.1 ? 1 : 0;
      } else { z.casL = r2(16 + rnd() * 12); z.casP = r2(Math.max(10, z.casL + (rnd() - 0.5))); }
      zapisy.push(z);
    } });
    if (!zapisy.length) return Object.assign(soDetail_(o, id), { zprava: 'Všechny pokusy už mají výsledek.' });
    let chyb = 0;
    for (let i = 0; i < zapisy.length; i += 200) { const w = soZavodZapis_({ hlavni: false }, s, { zapisy: zapisy.slice(i, i + 200) }); if (!w.ok) return w; chyb += (w.chyby || []).filter(x => !x.info).length; }
    return Object.assign(soDetail_(o, id), { zprava: 'Doplněno ' + (zapisy.length - chyb) + ' testovacích výsledků' + (chyb ? ' (' + chyb + ' odmítnuto)' : '') + '.' });
  }
  if (['koncept', 'přihlášky', 'uzavřeno', 'závod'].indexOf(s.stav) < 0) return { ok: false, chyba: 'Po ověření už přihlášky nejde doplnit.' };
  if (!s.kategorie.length) return { ok: false, chyba: 'Soutěž nemá kategorie.' };
  const naKat = Math.max(1, Math.min(60, Math.round(Number(req.naKategorii) || 15))); // obvykle kolem 15 družstev v kategorii
  // limity z OZ (max. na SDH v kategorii, společné limity) – s nimi všechny sbory rovnoměrně, bez nich 14 sborů, některé s víc dětmi (kvůli rozřazení)
  const ozKat = s.oz.kategorie || {}, spol = s.oz.spolecne || [], maLimity = spol.length > 0 || s.kategorie.some(k => (ozKat[k] || {}).maxSdh);
  const sbory = radkyRychle_('Sbory').filter(r => r['Sbor'] && String(r['Aktivní']).trim().toUpperCase() !== 'NE')
    .map(r => ({ sbor: String(r['Sbor']), skupina: String(r['Skupina'] || '').split('@')[0] })).sort(() => rnd() - 0.5).slice(0, maLimity ? 999 : 14);
  if (!sbory.length) return { ok: false, chyba: 'V listu Sbory nejsou aktivní sbory.' };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const t = soTab_(LIST_DRUZSTVA), c = t.col, ted = new Date();
    const moje = soRadky_(t).filter(x => String(x.r[c('Akce – ID')]) === id && x.r[c('Stav')] !== 'odhlášeno');
    const jmena = {}, start = {};
    moje.forEach(x => { jmena[x.r[c('Kategorie')] + '|' + String(x.r[c('Družstvo')]).toLowerCase()] = true; start[x.r[c('Kategorie')]] = Math.max(start[x.r[c('Kategorie')]] || 0, soCislo_(x.r[c('Start')]) || 0); });
    const zaklad = soNoveId_('D').slice(0, 13), radky = [], pocty = {}; // pocty[sbor|kat]
    moje.forEach(x => { const k = x.r[c('Sbor')] + '|' + x.r[c('Kategorie')]; pocty[k] = (pocty[k] || 0) + 1; });
    const volno = (sb, kat) => { const n = k => pocty[sb.sbor + '|' + k] || 0, max = (ozKat[kat] || {}).maxSdh;
      return !(max && n(kat) >= max) && !spol.some(g => g.kat.indexOf(kat) >= 0 && g.kat.reduce((a, k) => a + n(k), 0) >= g.max); };
    const chci = {}; s.kategorie.forEach(k => { chci[k] = naKat; });
    for (let i = 0; i < naKat * s.kategorie.length * 40 && s.kategorie.some(k => chci[k] > 0); i++) {
      const kat = s.kategorie[i % s.kategorie.length], sb = sbory[Math.floor((maLimity ? rnd() : Math.pow(rnd(), 1.8)) * sbory.length)];
      if (chci[kat] <= 0 || !volno(sb, kat)) continue;
      let nazev = '';
      for (let pokus = 0; pokus < 50 && (!nazev || jmena[kat + '|' + nazev.toLowerCase()]); pokus++) {
        if (jedn(kat)) { const kluk = rnd() < 0.5, p = vyber(SO_TEST_JMENA.prijmeni); nazev = vyber(kluk ? SO_TEST_JMENA.kluci : SO_TEST_JMENA.holky) + ' ' + p[kluk ? 0 : 1]; }
        else { const base = sb.sbor.replace(/^SDH\s+/i, ''); nazev = base + (pokus ? ' ' + 'BCDEFGHIJKLMNOPQRSTUVWXYZ'.charAt(pokus - 1) : ''); }
      }
      if (jmena[kat + '|' + nazev.toLowerCase()]) continue;
      jmena[kat + '|' + nazev.toLowerCase()] = true; pocty[sb.sbor + '|' + kat] = (pocty[sb.sbor + '|' + kat] || 0) + 1; chci[kat]--;
      const r = t.h.map(() => ''), set = (k, val) => { if (c(k) >= 0) r[c(k)] = val; };
      set('ID', zaklad + String(100 + radky.length)); set('Akce – ID', id); set('Stav', 'přihlášeno'); set('Přihlásil', o.email); set('Vytvořeno', ted); set('Vytvořil', o.email);
      set('Sbor', sb.sbor); set('Skupina', sb.skupina); set('Kategorie', kat); set('Družstvo', nazev); set('Kontakt', o.email); set('Upraveno', ted); set('Upravil', o.email);
      if (s.stav === 'závod') { start[kat] = (start[kat] || 0) + 1; set('Start', start[kat]); }
      radky.push(r.map(bezVzorce_));
    }
    if (radky.length) t.sh.getRange(t.sh.getLastRow() + 1, 1, radky.length, t.h.length).setValues(radky);
    zaznamZmeny_(o.email, LIST_DRUZSTVA, id, 'vytvořeno', '', 'testovací přihlášky: ' + radky.length);
    return Object.assign(soDetail_(o, id), { zprava: 'Přidáno ' + radky.length + ' testovacích přihlášek (' + naKat + ' v každé kategorii, vymyšlená jména).' + (s.kategorie.some(k => chci[k] > 0) && maLimity ? ' Víc nedovolí limity na SDH v organizačním zabezpečení.' : '') + (s.druh === 'uzlová štafeta' && s.stojany.length ? ' Teď je rozřaďte ke stojanům.' : '') });
  } finally { lock.releaseLock(); }
}

/**
 * Testovací liga (jen TEST): pohár dospělých se 3 koly požárního útoku – stejná družstva (v posledním kole jedno chybí),
 * náhodné výsledky, ověřeno a zveřejněno; pohár zveřejněný. Celé pořadí ligy jde hned zkontrolovat v aplikaci i na webu.
 */
function soTestLiga_(o) {
  if (ostryRezim_()) return { ok: false, chyba: 'Testovací liga jde vložit jen v TESTu.' };
  if (!smiSouteze_(o, 'dospělí')) return { ok: false, chyba: 'Testovací liga je pro dospělé – potřebujete roli Soutěže (všechny nebo dospělí) nebo Správce.' };
  const sbory = radkyRychle_('Sbory').filter(r => r['Sbor'] && String(r['Aktivní']).trim().toUpperCase() !== 'NE').slice(0, 6);
  if (sbory.length < 4) return { ok: false, chyba: 'V listu Sbory jsou méně než 4 aktivní sbory.' };
  const ted = new Date(), oznaceni = Utilities.formatDate(ted, 'Europe/Prague', 'd. M. HH:mm');
  const p = soPoharUlozit_(o, { data: { nazev: 'TEST liga ' + oznaceni, rocnik: ted.getFullYear(), pro: 'dospělí', kategorie: 'muži, ženy', body: 'počet družstev', bodyNP: '', zapocitat: 2, minKol: 2, stav: 'koncept' } });
  if (!p.ok) return p;
  const tymy = [['muži', 0], ['muži', 1], ['muži', 2], ['muži', 3], ['muži', 4], ['ženy', 0], ['ženy', 2], ['ženy', 5]].filter(t => sbory[t[1]]);
  const kola = [];
  for (let k = 1; k <= 3; k++) {
    const den = soDen_(new Date(ted.getTime() + (1 + (k - 1) * 7) * 864e5));
    const s = soUlozit_(o, { data: { nazev: 'TEST liga – ' + k + '. kolo', od: den + 'T09:00:00', do: den + 'T14:00:00', misto: 'Testovací hřiště ' + k, poradatel: 'OSH Praha-západ',
      druh: 'požární útok', pro: 'dospělí', kategorie: 'muži, ženy', pokusy: 2, shoda: 'pravidla SH ČMS', uzaverka: soDen_(ted), pohar: p.pohar.id, kolo: k, hlavniRozhodci: 'TEST Hlavní Rozhodčí' } });
    if (!s.ok) return s;
    const id = s.data.id;
    tymy.forEach(([kat, i], j) => {
      if (k === 3 && j === 1) return; // ve 3. kole jedno družstvo nenastoupí do poháru (méně kol = pořadí podle Min. kol)
      const sb = sbory[i], v = soZapsatDruzstvo_(o, s.data, { sbor: String(sb['Sbor']), skupina: String(sb['Skupina'] || '').split('@')[0], kat: kat, druzstvo: String(sb['Sbor']).replace(/^SDH\s+/i, ''), kontakt: o.email });
      if (!v.ok) throw new Error(v.chyba);
    });
    ['přihlášky', 'uzavřeno', 'závod'].forEach(st => { const z = soZmenitStav_(o, { id: id, stav: st }); if (!z.ok) throw new Error(z.chyba); });
    [{ krok: 'vysledky' }, { krok: 'overit' }].forEach(q => { const z = soTestDoplnit_(o, Object.assign({ id: id }, q)); if (!z.ok) throw new Error(z.chyba); });
    const zv = soZverejnit_(o, { id: id }); if (!zv.ok) throw new Error(zv.chyba);
    kola.push(id);
  }
  const p2 = soPoharUlozit_(o, { id: p.pohar.id, data: { nazev: p.pohar.nazev, rocnik: p.pohar.rocnik, pro: 'dospělí', kategorie: 'muži, ženy', body: 'počet družstev', bodyNP: '', zapocitat: 2, minKol: 2, stav: 'zveřejněno' } });
  if (!p2.ok) return p2;
  return Object.assign(soOkres_(o), { pohar: p2.pohar.id, zprava: 'Vložena ' + p2.pohar.nazev + ': 3 kola se zveřejněnými výsledky, započítávají se 2 nejlepší, hodnocení od 2 kol. Otevřete ji v seznamu níže.' });
}
function vlozitTestovaciLigu() {
  const v = soTestLiga_({ email: Session.getActiveUser().getEmail() || 'test', role: { 'Správce': true } });
  const t = v.ok ? v.zprava : 'CHYBA: ' + v.chyba;
  console.log(t);
  try { SpreadsheetApp.getActive().toast(t, 'Soutěže', 10); } catch (e) {}
  return t;
}

/* ---------- organizační zabezpečení (OZ) ----------
 * Uložené jako JSON ve sloupci OZ listu Soutěže, PDF ve stylu dosavadních OZ okresu (hlavička z Nastavení OZ_HLAVICKA)
 * ve složce Soutěže/<rok> na sdíleném disku; kdokoli s odkazem až od otevření přihlášek (soZmenitStav_). */

const SO_MESICE = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
function soOzPrazdne_() {
  return { harmonogram: [], stab: { nacelnik: '', velitel: '', komise: '', zdravotni: '' }, kategorie: {}, spolecne: [], podminky: [], discipliny: [], upravy: [], material: [],
    startovne: { castka: '', za: 'SDH', splatnost: '', zprava: '' }, prihlasky: '', strava: '', doprava: '', protesty: '', podpis: { jmeno: '', funkce: '' } };
}
function soOzCist_(t) {
  const p = soOzPrazdne_();
  let x = {}; try { x = JSON.parse(t || '{}') || {}; } catch (e) {}
  return Object.assign(p, x, { stab: Object.assign(p.stab, x.stab || {}), startovne: Object.assign(p.startovne, x.startovne || {}), podpis: Object.assign(p.podpis, x.podpis || {}) });
}
/** Kontrola a úprava OZ z aplikace. Řádky textů = [úroveň 0/1, text]. Vrací { oz } nebo { chyba }. */
function soOzKontrola_(vstup, kategorie) {
  // JSON v buňce začíná „{“ → vzorec nehrozí; kontrola jen délky a HTML (HTML_VZOR z Ochrana.gs), úvodní odrážky pryč
  const v = vstup || {}, chyby = [], t = (x, max, pole) => { const s = String(x == null ? '' : x).trim().replace(/^[-–•▪]\s+/, '').slice(0, max); if (s && HTML_VZOR.test(s)) chyby.push('Pole „' + pole + '“ nesmí obsahovat HTML značky.'); return s; };
  const cislo = (x, max) => x === '' || x == null || isNaN(Number(x)) ? null : Math.max(0, Math.min(max, Math.round(Number(x))));
  const radky = (pole, nazev) => (Array.isArray(pole) ? pole : []).slice(0, 80).map(x => [Array.isArray(x) && x[0] ? 1 : 0, t(Array.isArray(x) ? x[1] : x, 400, nazev)]).filter(x => x[1]);
  const kat = {};
  (kategorie || []).forEach(k => { const x = (v.kategorie || {})[k] || {}; kat[k] = { rocniky: t(x.rocniky, 80, 'Ročníky narození'), min: cislo(x.min, 99), max: cislo(x.max, 99), maxSdh: cislo(x.maxSdh, 40) }; });
  const oz = {
    harmonogram: (Array.isArray(v.harmonogram) ? v.harmonogram : []).slice(0, 25).map(h => [t(h[0], 80, 'Harmonogram'), t(h[1], 120, 'Harmonogram')]).filter(h => h[0] || h[1]),
    stab: { nacelnik: t(v.stab && v.stab.nacelnik, 100, 'Náčelník štábu'), velitel: t(v.stab && v.stab.velitel, 100, 'Velitel soutěže'), komise: t(v.stab && v.stab.komise, 120, 'Prezence a sčítací komise'), zdravotni: t(v.stab && v.stab.zdravotni, 120, 'Zdravotní služba') },
    kategorie: kat, spolecne: soOzSpolecne_(v.spolecne, kategorie), podminky: radky(v.podminky, 'Podmínky účasti'), discipliny: radky(v.discipliny, 'Disciplíny'), upravy: radky(v.upravy, 'Úpravy pravidel'), material: radky(v.material, 'Vlastní materiál'),
    startovne: { castka: cislo(v.startovne && v.startovne.castka, 100000), za: ['SDH', 'družstvo', 'závodníka'].indexOf(v.startovne && v.startovne.za) >= 0 ? v.startovne.za : 'SDH',
      splatnost: t(v.startovne && v.startovne.splatnost, 120, 'Splatnost startovného'), zprava: t(v.startovne && v.startovne.zprava, 100, 'Zpráva pro příjemce') },
    prihlasky: t(v.prihlasky, 400, 'Přihlášky'), strava: t(v.strava, 300, 'Strava'), doprava: t(v.doprava, 300, 'Doprava'), protesty: t(v.protesty, 300, 'Protesty'),
    podpis: { jmeno: t(v.podpis && v.podpis.jmeno, 100, 'Podpis'), funkce: t(v.podpis && v.podpis.funkce, 100, 'Funkce') }
  };
  if (chyby.length) return { chyba: 'Organizační zabezpečení: ' + chyby[0] };
  if (JSON.stringify(oz).length > 40000) return { chyba: 'Organizační zabezpečení je příliš dlouhé.' };
  return { oz: oz };
}
/** Společný limit na SDH pro víc kategorií (např. ZHVB okres: mladší + starší dohromady max. 4 hlídky): [{ kat: [...], max }], jen kategorie soutěže, aspoň 2. */
function soOzSpolecne_(v, kategorie) {
  return (Array.isArray(v) ? v : []).slice(0, 6).map(g => {
    const k = (g && Array.isArray(g.kat) ? g.kat : []).map(String).filter((x, i, a) => (kategorie || []).indexOf(x) >= 0 && a.indexOf(x) === i);
    const m = g && g.max !== '' && g.max != null && !isNaN(Number(g.max)) ? Math.max(0, Math.min(40, Math.round(Number(g.max)))) : 0;
    return { kat: k, max: m };
  }).filter(g => g.kat.length >= 2 && g.max > 0);
}
/** „mladší a starší“, „a, b a c“ */
const soSeznam_ = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' a ' + a[a.length - 1];
/** 1 hlídka / 2 hlídky / 5 hlídek (ZHVB), jinak družstvo / družstva / družstev */
const soTvarDruzstev_ = (n, zhvb) => n + ' ' + (zhvb ? (n === 1 ? 'hlídku' : n < 5 ? 'hlídky' : 'hlídek') : (n === 1 ? 'družstvo' : n < 5 ? 'družstva' : 'družstev'));
function soStartovneText_(oz) {
  const st = (oz || {}).startovne || {};
  if (!st.castka) return '';
  const ucet = String(nastaveniWeb_('OKRES_UCET') || '').trim();
  return st.castka + ' Kč ' + (st.za === 'SDH' ? 'na SDH bez ohledu na počet družstev' : 'za ' + st.za) + (st.splatnost ? ', ' + st.splatnost : '') +
    (ucet ? ', na účet OSH č. ' + ucet : '') + (st.zprava ? ', do zprávy pro příjemce: ' + st.zprava : '');
}
const soDenDlouhy_ = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.getDate() + '. ' + SO_MESICE[d.getMonth()] + ' ' + d.getFullYear(); };

/** HTML organizačního zabezpečení (stejná kostra jako OZ okresu 2026). */
function soOzHtml_(s) {
  const oz = s.oz, e = esc_, hl = String(nastaveniWeb_('OZ_HLAVICKA') || 'SH ČMS – Okresní sdružení hasičů Praha-západ\nK Výtopně 1224, Zbraslav, 156 00 Praha 5').split(/\n|\\n/).filter(Boolean);
  const seznam = r => r.length ? '<ul>' + r.map(x => '<li class="' + (x[0] ? 'u2' : '') + '">' + e(x[1]) + '</li>').join('') + '</ul>' : '';
  const radek = (k, v) => v ? '<tr><td class="k">' + e(k) + '</td><td>' + e(v) + '</td></tr>' : '';
  const katRadky = s.kategorie.map(k => { const x = oz.kategorie[k] || {};
    const jed = /jednotliv/i.test(k);
    return [0, 'kategorie ' + k + (x.rocniky ? ' (rok narození ' + x.rocniky + ')' : '') + (!jed && (x.min || x.max) ? ', družstvo ' + (x.min && x.max ? x.min + '–' + x.max : x.min ? 'min. ' + x.min : 'max. ' + x.max) + ' členů' : '') +
      (x.maxSdh ? ', max. ' + x.maxSdh + (jed ? (x.maxSdh === 1 ? ' závodník' : x.maxSdh < 5 ? ' závodníci' : ' závodníků') : (x.maxSdh === 1 ? ' družstvo' : x.maxSdh < 5 ? ' družstva' : ' družstev')) + ' na SDH' : '')]; });
  (oz.spolecne || []).forEach(g => katRadky.push([0, 'kategorie ' + soSeznam_(g.kat) + ' dohromady max. ' + soTvarDruzstev_(g.max, s.druh === 'ZHVB').replace(/hlídku$/, 'hlídka') + ' na SDH']));
  const disc = oz.discipliny.length ? oz.discipliny : s.druh === 'uzlová štafeta'
    ? [[0, 'uzlová štafeta – ' + (s.pokusy === 2 ? '2 pokusy, do celkového hodnocení se počítá rychlejší čas' : '1 pokus')], [0, 'o pořadí při shodném čase rozhoduje čas horšího pokusu'],
      [0, 'trestné sekundy: předčasný start 2. až 5. závodníka u družstva 10 s, chybně uvázaný uzel 30 s, pomoc i slovní 30 s'],
      [0, 'neplatný pokus: 2. chybný start, vynechaný uzel, méně než 3 správné uzly (přípravka 2), zkoušení uzlů při přípravě, nad 60 s (přípravka 90 s)']]
    : s.druh === 'Hra Plamen'
    ? s.discipliny.map(x => [0, x.d + ' – ' + (/štafeta/.test(x.d) ? (x.pokusy === 2 ? '2 štafety, platí lepší' : '1 štafeta') : x.pokusy === 2 ? '2 pokusy, platí lepší' : '1 pokus')])
      .concat([[0, 'celkové pořadí podle součtu umístění v disciplínách dle směrnice hry Plamen']])
    : s.druh === 'ZHVB'
    ? [[0, 'stanoviště: K1 hod na cíl (přípravka) / střelba ze vzduchovky, K2 orientace v přírodě, K3 uzlování, K4 brannost, K5 požární ochrana, K6 základy první pomoci, K7 ochrana obyvatelstva, K8 orientace v terénu s vlastní buzolou (jen dorost)'],
      [0, 'hodnocení: čas na trati + trestné body (1 bod = 1 minuta) − čekací čas na stanovištích; při shodě rozhoduje nižší počet trestných bodů, pak body na stanovištích v pořadí požární ochrana, ochrana obyvatelstva, první pomoc, brannost, uzlování, orientace v přírodě, střelba'],
      [0, 'provedení podle rámcového OZ ZHVB a prováděcí směrnice ZHVB OSH Praha-západ']]
    : [[0, s.druh + ' – ' + (s.pokusy === 2 ? '2 pokusy, do hodnocení se započítává lepší' : '1 pokus')]];
  const prihl = 'Přihlášky družstev v portálu sborů (aplikace OSH Praha-západ, záložka Soutěže)' + (s.uzaverka ? ' nejpozději do ' + soDenDlouhy_(s.uzaverka) : '') + '.' + (oz.prihlasky ? ' ' + oz.prihlasky : '');
  const hlava = '<div class="hl">' + hl.map((x, i) => i ? '<div>' + e(x) + '</div>' : '<b>' + e(x) + '</b>').join('') + '</div>';
  return '<html><head><meta charset="utf-8"><style>body{font-family:Arial,Helvetica,sans-serif;color:#201e1d;font-size:10.5pt;line-height:1.35}' +
    '.hl{border-bottom:2px solid #201e1d;padding-bottom:6pt;margin-bottom:12pt;font-size:9.5pt}h1{font-size:15pt;margin:0 0 10pt}h2{font-size:11.5pt;margin:12pt 0 4pt}' +
    'table{border-collapse:collapse}td{padding:1.5pt 10pt 1.5pt 0;vertical-align:top}td.k{font-weight:bold;white-space:nowrap}ul{margin:2pt 0 2pt 16pt;padding:0}li{margin:1pt 0}li.u2{margin-left:16pt;list-style:circle}' +
    '.podpis{margin-top:22pt}.novastr{page-break-before:always}</style></head><body>' + hlava +
    '<h1>Organizační zabezpečení – ' + e(s.nazev) + '</h1><table>' + radek('Místo konání:', s.misto) + radek('Pořádá:', s.poradatel) + radek('Den konání:', soDenDlouhy_(s.od)) +
    oz.harmonogram.map(h => radek(h[0] + ':', h[1])).join('') + radek('Doprava:', oz.doprava) + '</table>' +
    (oz.stab.nacelnik || oz.stab.velitel || s.hlavniRozhodci || oz.stab.komise || oz.stab.zdravotni ? '<h2>Štáb soutěže</h2><table>' + radek('Náčelník štábu:', oz.stab.nacelnik) + radek('Velitel soutěže:', oz.stab.velitel) +
      radek('Hlavní rozhodčí:', s.hlavniRozhodci) + radek('Prezence a sčítací komise:', oz.stab.komise) + radek('Zdravotní služba:', oz.stab.zdravotni) + '</table>' : '') +
    '<h2>Podmínky účasti</h2>' + seznam(katRadky.concat(oz.podminky)) +
    '<h2>Disciplíny a počet pokusů</h2>' + seznam(disc) + (oz.upravy.length ? '<h2>Úprava pravidel</h2>' + seznam(oz.upravy) : '') +
    (soStartovneText_(oz) ? '<h2>Startovné</h2><p>' + e(soStartovneText_(oz)) + '</p>' : '') + '<h2>Přihlášky</h2><p>' + e(prihl) + '</p>' +
    (oz.strava ? '<h2>Strava a pití</h2><p>' + e(oz.strava) + '</p>' : '') + (oz.protesty ? '<h2>Protesty</h2><p>' + e(oz.protesty) + '</p>' : '') +
    (oz.podpis.jmeno ? '<div class="podpis">' + e(oz.podpis.jmeno) + (oz.podpis.funkce ? '<br>' + e(oz.podpis.funkce) : '') + '</div>' : '') +
    (oz.material.length ? '<div class="novastr">' + hlava + '<h2>Příloha č. 1 – použití vlastního materiálu</h2>' + seznam(oz.material) + '</div>' : '') + '</body></html>';
}
/** Vytvoří / přepíše PDF OZ ve složce Soutěže/<rok>, zapíše odkaz do listu, sdílení podle stavu. Vrací odkaz. */
function soOzPdfUlozit_(id) {
  const x = soNajit_(id), a = soAkceRadek_(id);
  if (!x || !a) throw new Error('Soutěž nenalezena.');
  const s = soJson_(soObj_(x.t.h, x.r), soObj_(a.t.h, a.r));
  const rok = String(s.od || '').slice(0, 4) || String(new Date().getFullYear());
  const disk = DriveApp.getFolderById(nastaveniWeb_('DISK_ID'));
  const it = disk.getFoldersByName('Soutěže'), koren = it.hasNext() ? it.next() : disk.createFolder('Soutěže');
  const it2 = koren.getFoldersByName(rok), slozka = it2.hasNext() ? it2.next() : koren.createFolder(rok);
  const nazev = s.nazev.replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 120) + ' – organizační zabezpečení.pdf';
  const stary = slozka.getFilesByName(nazev); while (stary.hasNext()) stary.next().setTrashed(true);
  const f = slozka.createFile(Utilities.newBlob(soOzHtml_(s), 'text/html', 'oz.html').getAs('application/pdf').setName(nazev));
  if (SO_PRO_SBORY.indexOf(s.stav) >= 0) f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  x.r[x.t.col('OZ – PDF')] = f.getUrl();
  x.t.sh.getRange(x.n, 1, 1, x.t.h.length).setValues([x.r]);
  return f.getUrl();
}
function soOzVytvorit_(o, req) {
  const id = String(req.id || ''), s = soNacistJednu_(id);
  if (!s) return { ok: false, chyba: 'Soutěž nenalezena.' };
  if (!soMuze_(o, s)) return { ok: false, chyba: 'Tuto soutěž nespravujete.' };
  if (soTab_(LIST_SOUTEZE).col('OZ – PDF') < 0) return { ok: false, chyba: 'Chybí sloupec OZ – PDF – spusťte OSH data → Založit / doplnit strukturu.' };
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    const url = soOzPdfUlozit_(id);
    zaznamZmeny_(o.email, LIST_SOUTEZE, id, 'upraveno', '', 'PDF organizačního zabezpečení');
    vycistitCache_();
    return Object.assign(soDetail_(o, id), { ozUrl: url });
  } finally { lock.releaseLock(); }
}

/* ---------- portál sboru ---------- */

const SO_PRO_SBORY = ['přihlášky', 'uzavřeno', 'závod', 'ověřeno', 'zveřejněno'];

/** Soutěže pro sbor: otevřené přihlášky, startovky, výsledky. Kontakty jiných sborů nevidí. */
function soSbor_(u) {
  const sk = u.sbor.skupina, dnes = soDen_(new Date()), druzstva = soDruzstva_(null, false);
  const data = soSouteze_().filter(s => SO_PRO_SBORY.indexOf(s.stav) >= 0 || (s.poradatelSkupina === sk && s.stav !== 'zrušeno')).map(s => {
    s.poradam = !!sk && s.poradatelSkupina === sk; // sborová soutěž – sbor ji spravuje (Spravovat)
    const d = druzstva.filter(x => x.soutez === s.id && x.stav !== 'odhlášeno');
    s.lzePrihlasit = s.stav === 'přihlášky' && (!s.uzaverka || s.uzaverka >= dnes);
    s.moje = d.filter(x => x.skupina === sk || x.sbor === u.sbor.sbor);
    s.pocty = s.kategorie.map(k => ({ kat: k, n: d.filter(x => x.kat === k).length }));
    if (['uzavřeno', 'závod', 'ověřeno', 'zveřejněno'].indexOf(s.stav) >= 0) s.startovka = s.kategorie.map(k => ({ kat: k, rows: d.filter(x => x.kat === k).sort((a, b) => (a.start || 999) - (b.start || 999)).map(x => ({ start: x.start, druzstvo: x.druzstvo, moje: x.skupina === sk })) }));
    if (s.stav === 'zveřejněno') s.poradi = soPoradi_(s, d, soVysledky_(s.id)).map(c => ({ kat: c.kat, rows: c.rows.map(r => ({ poradi: r.poradi, druzstvo: r.druzstvo, vysledek: r.vysledek, moje: s.moje.some(m => m.id === r.id) })) }));
    delete s.kodyDo; delete s.maKody; delete s.zverejnil; delete s.poznamka;
    s.startovneText = soStartovneText_(s.oz);
    return s;
  }).sort((a, b) => String(a.od).localeCompare(String(b.od)));
  return { ok: true, data: data, sbor: u.sbor.sbor };
}

/** Pro zvonek v portálu (apiPortal_): otevřené přihlášky (soutěže MH jen sborům s MH) a výsledky soutěží sboru zveřejněné za 14 dní. */
function soPortal_(u, maMH) {
  const dnes = soDen_(new Date()), pred14 = new Date(Date.now() - 14 * 864e5), druzstva = soDruzstva_(null, false);
  return soSouteze_().map(s => {
    const moje = druzstva.filter(d => d.soutez === s.id && d.stav !== 'odhlášeno' && (d.skupina === u.sbor.skupina || d.sbor === u.sbor.sbor)).length;
    return { id: s.id, nazev: s.nazev, od: s.od, uzaverka: s.uzaverka, stav: s.stav, pro: s.pro, prihlaseno: moje, zverejneno: s.zverejneno, poradam: s.poradatelSkupina === u.sbor.skupina };
  }).filter(s => (s.poradam && (s.stav === 'koncept' || s.stav === 'ověřeno')) || // pořadatel: doplnit a otevřít přihlášky / zveřejnit výsledky
    (s.stav === 'přihlášky' ? !s.poradam && (!s.uzaverka || s.uzaverka >= dnes) && (s.pro !== 'MH' || maMH) : s.stav === 'zveřejněno' && s.prihlaseno > 0 && new Date(s.zverejneno) >= pred14));
}

function soPrihlasit_(o, u, req) {
  const s = soNacistJednu_(String(req.id || ''));
  if (!s || SO_PRO_SBORY.indexOf(s.stav) < 0) return { ok: false, chyba: 'Soutěž nenalezena.' };
  const dnes = soDen_(new Date());
  if (s.stav !== 'přihlášky' || (s.uzaverka && s.uzaverka < dnes)) return { ok: false, chyba: 'Přihlášky do této soutěže jsou uzavřené. Domluvte se s pořadatelem nebo okresem.' };
  const d = req.data || {};
  const v = soZapsatDruzstvo_(o, s, { limitSdh: true, prihlaska: req.prihlaska, sbor: u.sbor.sbor, skupina: u.sbor.skupina, skupinaOvereni: req.prihlaska ? u.sbor.skupina : '', kat: d.kat, druzstvo: d.druzstvo, kontakt: d.kontakt || o.email });
  return v.ok ? Object.assign(soSbor_(u), { id: v.id }) : v;
}

function soOdhlasit_(o, u, req) {
  const s = soNacistJednu_(String(req.id || ''));
  if (!s) return { ok: false, chyba: 'Soutěž nenalezena.' };
  const dnes = soDen_(new Date());
  if (s.stav !== 'přihlášky' || (s.uzaverka && s.uzaverka < dnes)) return { ok: false, chyba: 'Po uzávěrce družstvo odhlásí jen okres nebo pořadatel.' };
  const v = soZapsatDruzstvo_(o, s, { prihlaska: req.prihlaska, skupinaOvereni: u.sbor.skupina, odhlasit: true });
  return v.ok ? soSbor_(u) : v;
}

/* ---------- závodní panel (bez přihlášení, kód v odkazu) ---------- */

function soPodleKodu_(kod) {
  kod = String(kod || '');
  if (!/^[a-f0-9]{32}$/.test(kod)) return { chyba: 'Neplatný odkaz pro rozhodčí.' };
  const o = otisk_('so|' + kod), t = soTab_(LIST_SOUTEZE);
  const x = soRadky_(t).find(y => y.r[t.col('Kód rozhodčích – otisk')] === o || y.r[t.col('Kód hlavního rozhodčího – otisk')] === o);
  if (!x) return { chyba: 'Odkaz neplatí – okres mohl vytvořit nové odkazy. Požádejte hlavního rozhodčího o aktuální.' };
  const plati = x.r[t.col('Kódy platí do')];
  if (!(plati instanceof Date) || plati < new Date()) return { chyba: 'Platnost odkazu skončila (platí do konce soutěže).' };
  return { t: t, r: x.r, n: x.n, hlavni: x.r[t.col('Kód hlavního rozhodčího – otisk')] === o, id: String(x.r[t.col('Akce – ID')]) };
}

/** Veřejná akce „zavod“: krok data | zapis | overit. Chybné kódy počítá limit (proti zkoušení). */
function zavodApi_(req) {
  const c = CacheService.getScriptCache(), klicChyb = 'so_chyb_' + Math.floor(Date.now() / 600000); // neplatné kódy za 10 min (všichni dohromady)
  if (Number(c.get(klicChyb) || 0) >= 200) return { ok: false, chyba: 'Příliš mnoho neplatných odkazů. Zkuste to za 10 minut.' };
  const k = soPodleKodu_(req.kod);
  if (k.chyba) { c.put(klicChyb, String(Number(c.get(klicChyb) || 0) + 1), 600); return { ok: false, chyba: k.chyba, neplatny: true }; }
  const a = soAkceRadek_(k.id), s = soJson_(soObj_(k.t.h, k.r), a ? soObj_(a.t.h, a.r) : {});
  const krok = String(req.krok || 'data');
  if (krok === 'zapis') return soZavodZapis_(k, s, req);
  if (krok === 'overit') return soZavodOverit_(k, s, req);
  return soZavodData_(k, s);
}

function soZavodData_(k, s, prijato) {
  const druzstva = soDruzstva_(s.id, false).filter(d => d.stav !== 'odhlášeno');
  return { ok: true, role: k.hlavni ? 'hlavni' : 'rozhodci', prijato: prijato || [],
    soutez: { id: s.id, nazev: s.nazev, od: s.od, misto: s.misto, druh: s.druh, kategorie: s.kategorie, pokusy: s.pokusy, shoda: s.shoda, stav: s.stav,
      hlavniRozhodci: s.hlavniRozhodci, overil: s.overil, overeno: s.overeno, kodyDo: s.kodyDo, stojany: s.stojany, discipliny: s.discipliny },
    druzstva: druzstva.map(d => ({ id: d.id, kat: d.kat, druzstvo: d.druzstvo, sbor: d.sbor, start: d.start, shoda: d.shoda, rozpis: d.rozpis })),
    vysledky: soVysledky_(s.id), ted: new Date().toISOString() };
}

/** Zápisy z panelu (dávka z fronty v telefonu). Každý: { klic, prihlaska, pokus, casL, casP, platnost, poznamka, rozhodci, zapsano }. */
function soZavodZapis_(k, s, req) {
  if (s.stav !== 'závod') return { ok: false, chyba: s.stav === 'ověřeno' ? 'Výsledky už ověřil hlavní rozhodčí – zápis není možný. Opravu povolí okres (vrátí soutěž do stavu závod).' : 'Soutěž není ve stavu závod.' };
  const zapisy = Array.isArray(req.zapisy) ? req.zapisy.slice(0, 200) : [];
  const druzstva = {}; soDruzstva_(s.id, false).filter(d => d.stav !== 'odhlášeno').forEach(d => { druzstva[d.id] = d; });
  const cislo = v => v === '' || v == null ? null : Number(v);
  const chyby = [], prijato = [];
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    const t = soTab_(LIST_VYSLEDKY), c = t.col, v = soRadky_(t).filter(x => String(x.r[c('Akce – ID')]) === s.id), ted = new Date(), zaznamy = [];
    zapisy.forEach(z => {
      if (s.druh === 'ZHVB') return soZhvbZapis_({ s: s, k: k, t: t, c: c, v: v, ted: ted, zaznamy: zaznamy, prijato: prijato, chyby: chyby, druzstva: druzstva }, z);
      const klic = String(z.klic || ''), d = druzstva[String(z.prihlaska || '')], pokus = Number(z.pokus), plat = String(z.platnost || '');
      const L = cislo(z.casL), P = cislo(z.casP), kdy = new Date(z.zapsano || ted);
      const vadnyCas = x => x !== null && !(x > 0 && x < 1000 && Math.abs(x * 100 - Math.round(x * 100)) < 1e-6);
      const uzl = s.druh === 'uzlová štafeta', pl = s.druh === 'Hra Plamen', ds = pl ? s.discipliny.find(x => x.d === String(z.disciplina || '')) : null;
      const lp = !pl || (ds && ds.d === 'požární útok'), tb = pl ? cislo(z.trestne) || 0 : 0; // Plamen: L a P jen u požárního útoku, jinak čas + trestné sekundy
      const ch = !/^[\w-]{8,64}$/.test(klic) ? 'neplatný klíč zápisu' : !d ? 'družstvo není v soutěži' : pl && !ds ? 'neznámá disciplína' :
        !(pokus >= 1 && pokus <= (ds ? ds.pokusy : s.pokusy)) ? 'pokus ' + z.pokus + ' – ' + (ds ? ds.d + ' má ' + ds.pokusy : 'soutěž má ' + s.pokusy) :
        pl && !(Number.isInteger(tb) && tb >= 0 && tb <= 300 && (tb === 0 || ds.d !== 'štafeta 4 × 60 m')) ? 'trestné sekundy 0–300 (štafeta 4 × 60 m je nemá)' :
        SO_PLATNOST.indexOf(plat) < 0 ? 'neznámá platnost' : vadnyCas(L) || vadnyCas(P) ? 'čas má být 0,01–999,99 s' :
        plat === 'platný' && L === null ? 'chybí čas' : !uzl && lp && plat === 'platný' && P === null ? 'u platného pokusu oba terče' :
        isNaN(kdy) || kdy > new Date(ted.getTime() + 864e5) ? 'neplatný čas zápisu' :
        kontrolaTextu_({ 'Poznámka': z.poznamka || '', 'Rozhodčí': z.rozhodci || '' }, { 'Poznámka': 300, 'Rozhodčí': 60 });
      if (ch) { chyby.push({ klic: klic, chyba: d ? d.druzstvo + (ds ? ', ' + ds.d : '') + ', ' + z.pokus + '. pokus: ' + ch : ch }); return; }
      let x = v.find(y => String(y.r[c('Přihláška – ID')]) === d.id && Number(y.r[c('Pokus')]) === pokus && (!pl || String(y.r[c('Disciplína')]) === ds.d));
      if (x && String(x.r[c('Zápis – klíč')]) === klic) { prijato.push(klic); return; } // už zapsáno (opakované odeslání)
      if (x && x.r[c('Zapsáno')] instanceof Date && x.r[c('Zapsáno')] > kdy) { prijato.push(klic); chyby.push({ klic: klic, info: true, chyba: d.druzstvo + ', ' + pokus + '. pokus: novější zápis jiného rozhodčího zůstal.' }); return; }
      const r = x ? x.r : t.h.map(() => ''), pred = x ? [r[c('Platnost')], r[c('Čas L')], r[c('Čas P')]].join(' / ') : '';
      const set = (kk, val) => { if (c(kk) >= 0) r[c(kk)] = val; };
      if (!x) { set('ID', soNoveId_('V')); set('Akce – ID', s.id); set('Přihláška – ID', d.id); set('Pokus', pokus); set('Vytvořeno', ted); }
      set('Kategorie', d.kat); set('Disciplína', pl ? ds.d : s.druh); set('Sbor', d.sbor); set('Družstvo', d.druzstvo);
      // uzlová štafeta: Čas L = naměřený čas, Trestné body = trestné sekundy, Čas (s) = výsledný; NP podle limitu a počtu správných uzlů dopočítá server
      const u = uzl ? soUzlovka_(d.kat, L, z.uzly, z.pomoc, z.starty) : null;
      let platnost = plat, pozn = String(z.poznamka || '').trim();
      if (u && plat === 'platný' && u.np) { platnost = 'NP'; pozn = (pozn ? pozn + '; ' : '') + u.np; }
      set('Čas L', L === null ? '' : L); set('Čas P', uzl || !lp || P === null ? '' : P);
      const vysl = platnost === 'platný' ? (u ? u.vysledny : lp ? soR2_(Math.max(L, P)) : soR2_(L + tb)) : '';
      set('Čas (s)', vysl); set('Výsledek', vysl); set('Trestné body', u ? u.trestne : pl && tb ? tb : ''); set('Platnost', platnost);
      set('Rozpis', u ? JSON.stringify({ uzly: u.uzly, pomoc: u.pomoc, starty: u.starty }) : '');
      set('Poznámka', bezVzorce_(pozn.slice(0, 300))); set('Rozhodčí', bezVzorce_(String(z.rozhodci || '').trim() || (k.hlavni ? 'hlavní rozhodčí' : 'rozhodčí')));
      set('Zapsáno', kdy); set('Zápis – klíč', klic); set('Stav', 'zapsáno'); set('Upraveno', ted); set('Upravil', 'závodní panel');
      if (x) t.sh.getRange(x.n, 1, 1, t.h.length).setValues([r]); else { t.sh.appendRow(r); v.push({ r: r, n: t.sh.getLastRow() }); }
      zaznamy.push(['závodní panel – ' + String(z.rozhodci || '').slice(0, 60), LIST_VYSLEDKY, String(r[c('ID')]), x ? 'upraveno' : 'vytvořeno', pred, d.druzstvo + (pl ? ', ' + ds.d : '') + ', ' + pokus + '. pokus: ' + platnost + (vysl ? ' ' + vysl + ' s' : '')]);
      prijato.push(klic);
    });
    if (zaznamy.length) zaznamZmenyHromadne_(zaznamy);
  } finally { lock.releaseLock(); }
  return Object.assign(soZavodData_(k, s, prijato), { chyby: chyby });
}

/**
 * Zápis ZHVB z panelu: z.zhvb = jen pole, která rozhodčí zapsal (start, cil, K1–K8, c1–c8; null = smazat), z.platnost jen při změně
 * (NP / DIS / nenastoupil, „platný“ = zrušit). Pole se slučují do Rozpis.pole – u každého platí novější zápis (Rozpis.kdy), takže
 * stanoviště, start a cíl si zápisy nepřepisují. Rozpis.klice = posledních 60 klíčů (opakované odeslání se nezapíše dvakrát).
 */
function soZhvbZapis_(x, z) {
  const t = x.t, c = x.c, ted = x.ted, klic = String(z.klic || ''), d = x.druzstva[String(z.prihlaska || '')], plat = String(z.platnost || ''), kdy = new Date(z.zapsano || ted);
  const pole = z.zhvb && typeof z.zhvb === 'object' && !Array.isArray(z.zhvb) ? z.zhvb : {}, klice = Object.keys(pole);
  const max = k => k === 'start' || k === 'cil' ? 86399 : /^c/.test(k) ? 7200 : k === 'K8' ? 3 : 15; // K2a… = úkol na kartě
  const ch = !/^[\w-]{8,64}$/.test(klic) ? 'neplatný klíč zápisu' : !d ? 'hlídka není v soutěži' : Number(z.pokus) !== 1 ? 'ZHVB má jeden průchod tratí' :
    plat && SO_PLATNOST.indexOf(plat) < 0 ? 'neznámá platnost' : klice.length > 30 || klice.some(k => !/^(start|cil|K[1-8]|K[2457][abc]|c[1-8])$/.test(k)) ? 'neznámé pole zápisu' :
    klice.some(k => pole[k] !== null && !(Number.isInteger(Number(pole[k])) && pole[k] !== '' && Number(pole[k]) >= 0 && Number(pole[k]) <= max(k))) ? 'hodnota mimo rozsah' :
    !klice.length && !plat && z.poznamka === undefined ? 'prázdný zápis' : isNaN(kdy) || kdy > new Date(ted.getTime() + 864e5) ? 'neplatný čas zápisu' :
    kontrolaTextu_({ 'Poznámka': z.poznamka || '', 'Rozhodčí': z.rozhodci || '' }, { 'Poznámka': 300, 'Rozhodčí': 60 });
  if (ch) { x.chyby.push({ klic: klic, chyba: d ? d.druzstvo + ': ' + ch : ch }); return; }
  let y = x.v.find(q => String(q.r[c('Přihláška – ID')]) === d.id && Number(q.r[c('Pokus')]) === 1);
  const r = y ? y.r : t.h.map(() => '');
  let rz = {}; try { rz = JSON.parse(r[c('Rozpis')] || '{}') || {}; } catch (e) { rz = {}; }
  const P0 = rz.pole && typeof rz.pole === 'object' ? rz.pole : {}, K0 = rz.kdy && typeof rz.kdy === 'object' ? rz.kdy : {}, KL = Array.isArray(rz.klice) ? rz.klice : [];
  if (KL.indexOf(klic) >= 0) { x.prijato.push(klic); return; } // už zapsáno (opakované odeslání)
  const nove = {}; klice.forEach(k => { nove[k] = pole[k] === null ? null : Number(pole[k]); });
  if (plat) nove.plat = plat;
  if (z.poznamka !== undefined) nove.pozn = String(z.poznamka || '').trim().slice(0, 300); // vzorec na začátku odmítne kontrolaTextu_, do buňky jde přes bezVzorce_
  const starsi = [], pred = soZhvbText_(soZhvb_(d.kat, P0)) + ' ' + (P0.plat || '');
  Object.keys(nove).forEach(k => {
    if (K0[k] && new Date(K0[k]) > kdy) { starsi.push(k); return; }
    if (nove[k] === null || nove[k] === '') delete P0[k]; else P0[k] = nove[k];
    K0[k] = kdy.toISOString();
  });
  if (starsi.length) x.chyby.push({ klic: klic, info: true, chyba: d.druzstvo + ': u pole ' + starsi.join(', ') + ' zůstal novější zápis jiného rozhodčího.' });
  const zz = soZhvb_(d.kat, P0);
  let platnost = P0.plat || 'platný', pozn = String(P0.pozn || '');
  if (platnost === 'platný' && zz.np) { platnost = 'NP'; pozn = (pozn ? pozn + '; ' : '') + zz.np; }
  const set = (kk, val) => { if (c(kk) >= 0) r[c(kk)] = val; };
  if (!y) { set('ID', soNoveId_('V')); set('Akce – ID', x.s.id); set('Přihláška – ID', d.id); set('Pokus', 1); set('Vytvořeno', ted); }
  set('Kategorie', d.kat); set('Disciplína', 'ZHVB'); set('Sbor', d.sbor); set('Družstvo', d.druzstvo);
  // Čas L = čas na trati (s), Čas P = čekací čas celkem (s), Trestné body = součet, Čas (s) = výsledný – až když je hlídka kompletní
  const vysl = platnost === 'platný' && zz.vysledny != null ? zz.vysledny : '';
  set('Čas L', zz.trat == null ? '' : zz.trat); set('Čas P', zz.cek || ''); set('Trestné body', zz.body); set('Čas (s)', vysl); set('Výsledek', vysl); set('Platnost', platnost);
  set('Rozpis', JSON.stringify({ pole: P0, kdy: K0, klice: KL.concat(klic).slice(-60) }));
  set('Poznámka', bezVzorce_(pozn.slice(0, 300)));
  if (starsi.length < Object.keys(nove).length) { // poslední rozhodčí, který něco změnil
    set('Rozhodčí', bezVzorce_(String(z.rozhodci || '').trim() || (x.k.hlavni ? 'hlavní rozhodčí' : 'rozhodčí'))); set('Zápis – klíč', klic);
    if (!(r[c('Zapsáno')] instanceof Date) || r[c('Zapsáno')] < kdy) set('Zapsáno', kdy);
  }
  set('Stav', 'zapsáno'); set('Upraveno', ted); set('Upravil', 'závodní panel');
  if (y) t.sh.getRange(y.n, 1, 1, t.h.length).setValues([r]); else { t.sh.appendRow(r); x.v.push({ r: r, n: t.sh.getLastRow() }); }
  x.zaznamy.push(['závodní panel – ' + String(z.rozhodci || '').slice(0, 60), LIST_VYSLEDKY, String(r[c('ID')]), y ? 'upraveno' : 'vytvořeno', y ? pred : '',
    d.druzstvo + ': ' + Object.keys(nove).filter(k => starsi.indexOf(k) < 0).map(k => k + '=' + (nove[k] === null ? '–' : nove[k])).join(', ')]);
  x.prijato.push(klic);
}

/** Ověření hlavním rozhodčím: všechna družstva mají všechny pokusy, shody rozhodnuté; pak stav ověřeno a e-mail okresu. */
function soZavodOverit_(k, s, req) {
  if (!k.hlavni) return { ok: false, chyba: 'Výsledky ověřuje jen hlavní rozhodčí (jeho odkaz).' };
  if (s.stav !== 'závod') return { ok: false, chyba: 'Soutěž není ve stavu závod.' };
  const jmeno = String(req.jmeno || '').trim();
  const ch = kontrolaTextu_({ 'Jméno': jmeno }, { 'Jméno': 80 });
  if (ch || jmeno.length < 3) return { ok: false, chyba: ch || 'Napište své jméno (hlavní rozhodčí).' };
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    // ruční pořadí při shodě (rozhoduje pořadatel): { ID přihlášky: pořadí v rámci shody }
    if (req.shoda && typeof req.shoda === 'object') {
      const t = soTab_(LIST_DRUZSTVA), c = t.col;
      soRadky_(t).filter(x => String(x.r[c('Akce – ID')]) === s.id && req.shoda[String(x.r[c('ID')])] !== undefined).forEach(x => {
        const n = Number(req.shoda[String(x.r[c('ID')])]);
        x.r[c('Pořadí při shodě')] = n >= 1 && n <= 99 ? n : '';
        t.sh.getRange(x.n, 1, 1, t.h.length).setValues([x.r]);
      });
    }
    const druzstva = soDruzstva_(s.id, false), vysledky = soVysledky_(s.id), poradi = soPoradi_(s, druzstva, vysledky);
    const chybi = [], nerozh = [];
    poradi.forEach(c => c.rows.forEach(r => {
      if (r.stav === 'DIS') return;
      if (r.stav === 'rozpracováno') return chybi.push(c.kat + ' – ' + r.druzstvo + ' (' + r.chybi.join(', ') + ')'); // ZHVB: chybí start, cíl nebo stanoviště
      const bez = r.pokusy.map((p, i) => p ? 0 : i + 1).filter(Boolean);
      if (bez.length) chybi.push(c.kat + ' – ' + r.druzstvo + (s.druh === 'ZHVB' ? ' (bez zápisu)' : ' (' + bez.join('. a ') + '. pokus)'));
      if (r.nerozhodnuto) nerozh.push(c.kat + ' – ' + r.druzstvo);
    }));
    if (chybi.length) return { ok: false, chyba: 'Chybí výsledky: ' + chybi.slice(0, 8).join('; ') + (chybi.length > 8 ? ' a další' : '') + '. Nenastoupené družstvo označte „nenastoupil“.' };
    if (nerozh.length) return { ok: false, chyba: 'Shoda časů – určete pořadí: ' + nerozh.join('; ') + '.', shoda: true };
    const ted = new Date();
    k.r[k.t.col('Stav')] = 'ověřeno'; k.r[k.t.col('Ověřil')] = bezVzorce_(jmeno); k.r[k.t.col('Ověřeno')] = ted; k.r[k.t.col('Upraveno')] = ted; k.r[k.t.col('Upravil')] = 'hlavní rozhodčí';
    k.t.sh.getRange(k.n, 1, 1, k.t.h.length).setValues([k.r]);
    soStavVysledku_(s.id, 'ověřeno');
    zaznamZmeny_('hlavní rozhodčí – ' + jmeno, LIST_SOUTEZE, s.id, 'schváleno', 'závod', 'ověřeno');
    try {
      if (s.poradatelSkupina) soPostaPoradateli_(s, 'Výsledky ke zveřejnění: ' + s.nazev, 'Hlavní rozhodčí ' + jmeno + ' ověřil výsledky soutěže ' + s.nazev + '. Zkontrolujte je a zveřejněte v portálu sboru (Soutěže → Spravovat).');
      else soPostaOkresu_(s, 'Výsledky ke zveřejnění: ' + s.nazev, 'Hlavní rozhodčí ' + jmeno + ' ověřil výsledky soutěže ' + s.nazev + '. Zkontrolujte je a zveřejněte v aplikaci (Akce → Soutěže).');
    } catch (e) { console.error(e); }
    s.stav = 'ověřeno'; s.overil = jmeno; s.overeno = ted.toISOString();
  } finally { lock.releaseLock(); }
  return soZavodData_(k, s);
}

/** E-mail lidem s rolí Soutěže pro danou skupinu (bez nich správcům). */
function soPostaOkresu_(s, predmet, text) {
  const komu = radkyRychle_('Uživatelé').filter(u => ano_(u['Aktivní']) && ['všechny', 'ANO', s.pro].indexOf(String(u['Soutěže'] || '').trim()) >= 0).map(u => normEmail_(u['E-mail'])).filter(Boolean);
  const web = String(nastaveniWeb_('WEB_URL') || '').replace(/\/+$/, '');
  posta_((komu.length ? komu : ['spravci@' + (nastaveniWeb_('DOMENA') || 'oshpz.cz')]).join(','), predmet, text,
    sablona_(predmet, text, [['Soutěž', s.nazev], ['Datum', s.od ? fDen_(new Date(s.od)) : '']], ['Otevřít v aplikaci', web + '/Aplikace%20OSH.dc.html#okres/souteze/' + s.id]));
}

/** E-mail pořádajícímu sboru (skupina sdh-…@). */
function soPostaPoradateli_(s, predmet, text) {
  const web = String(nastaveniWeb_('WEB_URL') || '').replace(/\/+$/, '');
  posta_(s.poradatelSkupina + '@' + (nastaveniWeb_('DOMENA') || 'oshpz.cz'), predmet, text,
    sablona_(predmet, text, [['Soutěž', s.nazev], ['Datum', s.od ? fDen_(new Date(s.od)) : '']], ['Otevřít portál sboru', web + '/Aplikace%20OSH.dc.html#sbor/' + s.poradatelSkupina + '/prihlasky']));
}

/** Sborová soutěž: při schválení žádosti o pořádání soutěže (Zadosti.gs) vznikne soutěž (koncept), kterou pak spravuje pořádající sbor. */
function soZeZadosti_(akceId, zadostId, sborNazev, o) {
  if (soNajit_(akceId)) return;
  const t = soTab_(LIST_SOUTEZE), sb = radkyRychle_('Sbory').find(x => String(x['Sbor']) === String(sborNazev)), ted = new Date();
  const r = t.h.map(() => ''), set = (k, v) => { if (t.col(k) >= 0) r[t.col(k)] = v; };
  set('Akce – ID', akceId); set('Druh', 'požární útok'); set('Pro', 'MH'); set('Pokusy', 2); set('Shoda časů', 'pravidla SH ČMS'); set('Stav', 'koncept');
  set('Žádost – ID', zadostId); set('Pořadatel – skupina', sb ? String(sb['Skupina'] || '').split('@')[0].toLowerCase() : '');
  set('Vytvořeno', ted); set('Vytvořil', o.email); set('Upraveno', ted); set('Upravil', o.email);
  t.sh.appendRow(r);
  zaznamZmeny_(o.email, LIST_SOUTEZE, akceId, 'vytvořeno', '', 'sborová soutěž ze žádosti ' + zadostId + (sb ? ' – spravuje SDH ' + sb['Sbor'] : ''));
}

/* ---------- zveřejnění ---------- */

/** Zveřejní ověřené výsledky: stav, pořadí do listu Výsledky, PDF výsledková listina (kdokoli s odkazem), web. zrusit = zpět na ověřeno. */
function soZverejnit_(o, req) {
  const id = String(req.id || '');
  if (req.zrusit) return soZmenitStav_(o, { id: id, stav: 'ověřeno' });
  const s = soNacistJednu_(id);
  if (!s) return { ok: false, chyba: 'Soutěž nenalezena.' };
  if (!soMuze_(o, s)) return { ok: false, chyba: 'Tuto soutěž nespravujete.' };
  if (s.stav !== 'ověřeno') return { ok: false, chyba: 'Zveřejnit jde jen výsledky ověřené hlavním rozhodčím.' };
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    const druzstva = soDruzstva_(id, false), vysledky = soVysledky_(id), poradi = soPoradi_(s, druzstva, vysledky);
    const kde = {}; poradi.forEach(c => c.rows.forEach(r => { kde[r.id] = r.poradi; }));
    const tv = soTab_(LIST_VYSLEDKY), cv = tv.col;
    soRadky_(tv).filter(x => String(x.r[cv('Akce – ID')]) === id).forEach(x => {
      x.r[cv('Stav')] = 'zveřejněno'; x.r[cv('Pořadí')] = kde[String(x.r[cv('Přihláška – ID')])] || '';
      tv.sh.getRange(x.n, 1, 1, tv.h.length).setValues([x.r]);
    });
    let pdf = '', pdfChyba = '';
    try { pdf = soPdf_(s, poradi); } catch (e) { console.error(e); pdfChyba = e.message; }
    const x = soNajit_(id), t = x.t, c = t.col, ted = new Date();
    x.r[c('Stav')] = 'zveřejněno'; x.r[c('Zveřejnil')] = o.email; x.r[c('Zveřejněno')] = ted; if (pdf) x.r[c('Výsledky – PDF')] = pdf;
    x.r[c('Upraveno')] = ted; x.r[c('Upravil')] = o.email;
    t.sh.getRange(x.n, 1, 1, t.h.length).setValues([x.r]);
    zaznamZmeny_(o.email, LIST_SOUTEZE, id, 'schváleno', 'ověřeno', 'zveřejněno' + (pdf ? ' + PDF' : ''));
    if (o.soPoradatel) { try { soPostaOkresu_(s, 'Sborová soutěž zveřejnila výsledky: ' + s.nazev, 'SDH ' + (o.soPoradatelNazev || '') + ' zveřejnil výsledky soutěže ' + s.nazev + ' na webu okresu. Když je s nimi něco v nepořádku, zveřejnění zrušíte v aplikaci (Akce → Soutěže → soutěž → Zrušit zveřejnění).'); } catch (e) { console.error(e); } }
    vycistitCache_();
    return Object.assign(soDetail_(o, id), pdfChyba ? { varovani: 'Výsledky jsou na webu, ale PDF se nepodařilo vytvořit: ' + pdfChyba } : {});
  } finally { lock.releaseLock(); }
}

function soSdiletPdf_(url, verejne) {
  const m = String(url || '').match(/[-\w]{25,}/);
  if (!m) return;
  try { DriveApp.getFileById(m[0]).setSharing(verejne ? DriveApp.Access.ANYONE_WITH_LINK : DriveApp.Access.PRIVATE, verejne ? DriveApp.Permission.VIEW : DriveApp.Permission.NONE); } catch (e) { console.error(e); }
}

/** Výsledková listina do PDF (HTML → PDF) ve složce Soutěže/<rok> na sdíleném disku. Vrací odkaz. */
function soPdf_(s, poradi) {
  const rok = String(s.od || '').slice(0, 4) || String(new Date().getFullYear());
  const disk = DriveApp.getFolderById(nastaveniWeb_('DISK_ID'));
  const it = disk.getFoldersByName('Soutěže'), koren = it.hasNext() ? it.next() : disk.createFolder('Soutěže');
  const it2 = koren.getFoldersByName(rok), slozka = it2.hasNext() ? it2.next() : koren.createFolder(rok);
  const cas = x => x == null ? '' : String(Number(x).toFixed(2)).replace('.', ',');
  const uzl = s.druh === 'uzlová štafeta', jedn = kat => /jednotliv/i.test(kat);
  const pok = p => !p ? '–' : p.platnost === 'platný' ? cas(p.cas) + (uzl && !p.trestne ? '' : ' <span class="t">(' + (uzl ? cas(p.casL) + ' + ' + p.trestne + ' s' : 'L ' + cas(p.casL) + ' / P ' + cas(p.casP)) + ')</span>') : esc_(p.platnost);
  // ZHVB: start, cíl, trať, čekání, trestné body po stanovištích, výsledný čas (jako dosavadní výsledkové listiny okresu)
  const zhvbTab = c => { const st = soZhvb_(c.kat, {}).stanoviste, den = x => x == null ? '' : soHms_(x);
    return '<table class="z"><tr><th>Pořadí</th><th>Hlídka</th><th>Start</th><th>Cíl</th><th>Trať</th><th>Čekání</th>' + st.map(k => '<th>' + k + '</th>').join('') + '<th>TB</th><th>Výsledek</th></tr>' +
      c.rows.map(r => { const z = r.pokusy[0] && r.pokusy[0].zhvb, ok = z && r.stav !== 'nenastoupil';
        return '<tr><td>' + (r.poradi ? r.poradi + '.' : '') + '</td><td>' + esc_(r.druzstvo) + (r.stav !== 'platný' && r.pokusy[0] && r.pokusy[0].poznamka ? '<div class="t">' + esc_(r.pokusy[0].poznamka) + '</div>' : '') + '</td>' +
          '<td>' + (ok ? den(z.start) : '') + '</td><td>' + (ok ? den(z.cil) : '') + '</td><td>' + (ok ? den(z.trat) : '') + '</td><td>' + (ok && z.cek ? soMs_(z.cek) : '') + '</td>' +
          st.map(k => '<td>' + (ok ? z.tb[k] : '') + '</td>').join('') + '<td>' + (ok ? z.body : '') + '</td><td><b>' + esc_(r.vysledek) + '</b></td></tr>'; }).join('') + '</table>'; };
  // Hra Plamen: celkové pořadí kola (umístění v disciplínách, body) a pod ním výsledky každé disciplíny
  const plamenTab = c => { const dis = c.discipliny || [], poka = (p, d) => !p ? '–' : p.platnost !== 'platný' ? esc_(p.platnost) : cas(p.cas) +
      (d === 'požární útok' ? ' <span class="t">(L ' + cas(p.casL) + ' / P ' + cas(p.casP) + ')</span>' : p.trestne ? ' <span class="t">(' + cas(p.casL) + ' + ' + p.trestne + ' s)</span>' : '');
    return '<table class="z"><tr><th>Pořadí</th><th>Družstvo</th>' + dis.map(x => '<th>' + esc_(SO_PLAMEN_ZKR[x.d]) + '</th>').join('') + '<th>Body</th></tr>' +
      c.rows.map(r => '<tr><td>' + (r.poradi ? r.poradi + '.' : '') + '</td><td>' + esc_(r.druzstvo) + '</td>' + dis.map(x => '<td>' + (r.mista[x.d] ? r.mista[x.d] + '.' : '–') + '</td>').join('') + '<td><b>' + esc_(r.vysledek) + '</b></td></tr>').join('') + '</table>' +
      dis.map(x => '<h3>' + esc_(x.d) + '</h3><table class="z"><tr><th>Pořadí</th><th>Družstvo</th>' + (x.pokusy === 2 ? '<th>' + (/štafeta/.test(x.d) ? '1. štafeta</th><th>2. štafeta' : '1. pokus</th><th>2. pokus') + '</th>' : '<th>Pokus</th>') + '<th>Výsledek</th></tr>' +
        x.rows.map(r => '<tr><td>' + (r.poradi ? r.poradi + '.' : '') + '</td><td>' + esc_(r.druzstvo) + '</td>' + r.pokusy.map(q => '<td>' + poka(q, x.d) + '</td>').join('') + '<td><b>' + esc_(r.vysledek) + '</b></td></tr>').join('') + '</table>').join(''); };
  const html = '<html><head><meta charset="utf-8"><style>body{font-family:Arial,Helvetica,sans-serif;color:#201e1d;font-size:11pt}h1{font-size:18pt;margin:0 0 4pt}h2{font-size:13pt;margin:16pt 0 4pt;border-bottom:2px solid #201e1d}' +
    'table{border-collapse:collapse;width:100%}td,th{padding:3pt 6pt;border-bottom:1px solid #bbb;text-align:left;vertical-align:top}th{font-size:9pt;color:#5c5958}.t{font-size:8.5pt;color:#5c5958}.p{color:#5c5958;font-size:10pt}' +
    'table.z td,table.z th{padding:2pt 3pt;font-size:9pt}h3{font-size:11pt;margin:10pt 0 2pt}</style></head><body>' +
    '<h1>' + esc_(s.nazev) + ' – výsledková listina</h1><div class="p">' + esc_([s.od ? fDen_(new Date(s.od)) : '', s.misto, s.poradatel ? 'pořádá ' + s.poradatel : ''].filter(Boolean).join(' · ')) + '</div>' +
    '<div class="p">' + esc_(s.druh === 'Hra Plamen' ? 'Hra Plamen: o pořadí rozhoduje součet umístění v disciplínách (nižší vyhrává), při shodě lepší umístění v požárním útoku, štafetě 4 × 60 m, útoku CTIF, štafetě CTIF a štafetě dvojic; v disciplíně platí lepší pokus (štafeta), výsledek = čas + trestné sekundy, u požárního útoku delší z terčů L a P; NP = neplatný pokus' : s.druh === 'ZHVB' ? 'ZHVB: výsledný čas = čas na trati − čekací čas + trestné body (1 bod = 1 minuta); při shodě rozhoduje nižší počet trestných bodů, pak body na stanovištích K5, K7, K6, K4, K3, K2, K1; NP = neplatný výsledek'
      : s.druh + ', ' + (s.pokusy === 2 ? 'dva pokusy, platí lepší' : 'jeden pokus') + '; ' + (uzl ? 'výsledný čas = naměřený čas + trestné sekundy (chybný uzel 30 s, pomoc 30 s, předčasný start 10 s)' : 'výsledný čas pokusu = delší z terčů L a P') + '; NP = neplatný pokus') + '</div>' +
    poradi.map(c => s.druh === 'Hra Plamen' ? '<h2>' + esc_(c.kat) + '</h2>' + plamenTab(c) : s.druh === 'ZHVB' ? '<h2>' + esc_(c.kat) + '</h2>' + zhvbTab(c) : '<h2>' + esc_(c.kat) + '</h2><table><tr><th>Pořadí</th><th>' + (jedn(c.kat) ? 'Závodník</th><th>Sbor' : 'Družstvo') + '</th>' + (s.pokusy === 2 ? '<th>1. pokus</th><th>2. pokus</th>' : '<th>Pokus</th>') + '<th>Výsledek</th></tr>' +
      c.rows.map(r => '<tr><td>' + (r.poradi ? r.poradi + '.' : '') + '</td><td>' + esc_(r.druzstvo) + '</td>' + (jedn(c.kat) ? '<td>' + esc_(String(r.sbor || '').replace(/^SDH\s+/i, '')) + '</td>' : '') + r.pokusy.map(p => '<td>' + pok(p) + '</td>').join('') + '<td><b>' + esc_(r.vysledek) + '</b></td></tr>').join('') + '</table>').join('') +
    '<p class="p" style="margin-top:18pt">Výsledky ověřil hlavní rozhodčí ' + esc_(s.overil || s.hlavniRozhodci || '') + (s.overeno ? ' dne ' + fDen_(new Date(s.overeno)) : '') + '. Zveřejnilo OSH Praha-západ.</p></body></html>';
  const nazev = s.nazev.replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 120) + ' – výsledky.pdf';
  const stary = slozka.getFilesByName(nazev); while (stary.hasNext()) stary.next().setTrashed(true);
  const f = slozka.createFile(Utilities.newBlob(html, 'text/html', 'vysledky.html').getAs('application/pdf').setName(nazev));
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return f.getUrl();
}

/* ---------- pohár ---------- */

function soPoharUlozit_(o, req) {
  const d = req.data || {}, id = String(req.id || '');
  const ch = kontrolaTextu_({ 'Název': d.nazev, 'Kategorie': d.kategorie, 'Body': d.body, 'Popis': d.popis, 'Družstev v poháru': d.druzstev }, { 'Název': 200, 'Kategorie': 400, 'Body': 200, 'Popis': 2000, 'Družstev v poháru': 300 }) ||
    (d.druzstev && String(d.druzstev).split(/[,;\n]+/).some(x => x.trim() && !/^(.+?)\s*[=:]?\s*\d{1,3}$/.test(x.trim())) ? 'Družstev v poháru: kategorie a počet, např. „mladší 10, starší 8“.' : null) || kontrolaVolby_(d.pro, ['MH', 'dospělí'], 'Pro') || kontrolaVolby_(d.stav, ['koncept', 'zveřejněno', 'zrušeno'], 'Stav') ||
    (!String(d.nazev || '').trim() ? 'Chybí název poháru.' : null) || (!(Number(d.rocnik) >= 2020 && Number(d.rocnik) <= 2100) ? 'Ročník: rok, např. ' + new Date().getFullYear() + '.' : null) ||
    kontrolaVolby_(d.typ, ['pohár', 'Hra Plamen'], 'Typ') ||
    (d.typ !== 'Hra Plamen' && !/počet/i.test(d.body || '') && !/^\s*\d+(\s*[,;\s]\s*\d+)*\s*$/.test(String(d.body || '')) ? 'Body: čísla za 1., 2., 3. … místo oddělená čárkou (např. 10,8,6,5,4,3,2,1), nebo „počet družstev“.' : null) ||
    ([d.bodyNP, d.zapocitat, d.minKol].some(x => x !== '' && x != null && !(Number(x) >= 0 && Number(x) <= 100)) ? 'Body za NP, Započítat kol a Min. kol: čísla 0–100.' : null);
  if (ch) return { ok: false, chyba: ch };
  if (!smiSouteze_(o, d.pro || 'MH')) return { ok: false, chyba: 'Poháry pro ' + (d.pro || 'MH') + ' nespravujete.' };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const t = soTab_(LIST_POHARY), c = t.col, ted = new Date(), x = id ? soRadky_(t).find(y => String(y.r[c('ID')]) === id) : null;
    if (id && !x) return { ok: false, chyba: 'Pohár nenalezen.' };
    if (d.typ === 'Hra Plamen' && c('Typ') < 0) return { ok: false, chyba: 'V listu Poháry chybí sloupec Typ – spusťte v tabulce OSH data → Založit / doplnit strukturu.' };
    const r = x ? x.r : t.h.map(() => ''), set = (k, v) => { if (c(k) >= 0) r[c(k)] = v; };
    if (!x) { set('ID', soNoveId_('PH')); set('Vytvořeno', ted); set('Vytvořil', o.email); }
    set('Název', bezVzorce_(String(d.nazev).trim())); set('Ročník', Number(d.rocnik)); set('Pro', d.pro || 'MH'); set('Kategorie', bezVzorce_(soKategorie_(d.kategorie).join(', ')));
    set('Body', bezVzorce_(String(d.body || '').trim())); set('Body za NP', d.bodyNP === '' || d.bodyNP == null ? '' : Number(d.bodyNP));
    set('Započítat kol', d.zapocitat === '' || d.zapocitat == null ? '' : Number(d.zapocitat)); set('Min. kol', d.minKol === '' || d.minKol == null ? '' : Number(d.minKol));
    set('Typ', d.typ === 'Hra Plamen' ? 'Hra Plamen' : 'pohár'); set('Stav', d.stav || 'koncept'); set('Popis', bezVzorce_(String(d.popis || ''))); set('Družstev v poháru', bezVzorce_(String(d.druzstev || '').trim())); set('Upraveno', ted); set('Upravil', o.email);
    if (x) t.sh.getRange(x.n, 1, 1, t.h.length).setValues([r]); else t.sh.appendRow(r);
    zaznamZmeny_(o.email, LIST_POHARY, String(r[c('ID')]), x ? 'upraveno' : 'vytvořeno', '', String(d.nazev) + ' · ' + (d.stav || 'koncept'));
    vycistitCache_();
    const p = soPoharJson_(soObj_(t.h, r));
    return { ok: true, pohar: p, poradi: soPoharVypocet_(p).poradi };
  } finally { lock.releaseLock(); }
}

/** Kola poháru (zveřejněné soutěže) a celkové pořadí. */
function soPoharVypocet_(p, souteze, druzstva) {
  souteze = souteze || soSouteze_(); druzstva = druzstva || soDruzstva_(null, false);
  const vys = radky_(LIST_VYSLEDKY).filter(r => r['ID'] && r['Přihláška – ID']).map(r => Object.assign(soVysledekJson_(r), { soutez: String(r['Akce – ID']) }));
  const kola = souteze.filter(s => s.pohar === p.id && s.stav === 'zveřejněno').sort((a, b) => (a.kolo || 99) - (b.kolo || 99) || String(a.od).localeCompare(String(b.od)))
    .map(s => ({ sou: s, poradi: soPoradi_(s, druzstva.filter(d => d.soutez === s.id), vys.filter(v => v.soutez === s.id)) }));
  return { kola: kola, poradi: soPoharPoradi_(p, kola) };
}

/* ---------- veřejný web (?co=web) – stejný formát jako data/souteze-RRRR.js ---------- */

/** [{ rocnik, souteze: [...] }] – plánované (přihlášky…ověřeno) bez výsledků, zveřejněné s výsledky, zveřejněné poháry. */
function soutezeVerejne_() {
  const souteze = soSouteze_(), druzstva = soDruzstva_(null, false), roky = {};
  const vys = radky_(LIST_VYSLEDKY).filter(r => r['ID'] && r['Přihláška – ID'] && r['Stav'] === 'zveřejněno').map(r => Object.assign(soVysledekJson_(r), { soutez: String(r['Akce – ID']) }));
  const dm = iso => { const d = new Date(iso); return d.getDate() + '. ' + (d.getMonth() + 1) + '.'; };
  const pridat = (rok, x) => (roky[rok] = roky[rok] || []).push(x);
  souteze.filter(s => SO_PRO_SBORY.indexOf(s.stav) >= 0 && s.stavAkce !== 'zrušeno' && s.od).forEach(s => {
    const d = druzstva.filter(x => x.soutez === s.id && x.stav !== 'odhlášeno');
    const poradi = s.stav === 'zveřejněno' ? soPoradi_(s, d, vys.filter(v => v.soutez === s.id)) : [];
    const terminy = [{ d: soDen_(new Date(s.od)), misto: s.misto || '' }];
    if (s.do && soDen_(new Date(s.do)) !== terminy[0].d) terminy.push({ d: soDen_(new Date(s.do)), misto: s.misto || '' });
    pridat(Number(terminy[0].d.slice(0, 4)), {
      id: s.id, nazev: s.nazev, podtitul: s.druh + (s.kolo ? ' · ' + s.kolo + (s.druh === 'Hra Plamen' ? '. kolo' : '. kolo poháru') : ''), terminy: terminy, poradatel: s.poradatel || 'OSH Praha-západ',
      kategorie: s.kategorie, dospeli: s.pro === 'dospělí', uzaverka: s.stav === 'přihlášky' && s.uzaverka ? s.uzaverka : undefined,
      info: [['Disciplína', s.druh === 'Hra Plamen' ? 'Hra Plamen – ' + s.discipliny.map(x => x.d + ' (' + x.pokusy + (/štafeta/.test(x.d) ? (x.pokusy === 1 ? ' štafeta' : ' štafety') : x.pokusy === 1 ? ' pokus' : ' pokusy') + ')').join(', ') + '; o pořadí rozhoduje součet umístění v disciplínách' : s.druh === 'ZHVB' ? 'Závod hasičské všestrannosti a brannosti – stanoviště K1–K7 (dorost i K8); výsledný čas = čas na trati − čekací čas + trestné body (1 bod = 1 minuta)'
          : s.druh + ', ' + (s.pokusy === 2 ? 'dva pokusy, platí ' + (s.druh === 'uzlová štafeta' ? 'rychlejší' : 'lepší') : 'jeden pokus') + '; ' + (s.druh === 'uzlová štafeta' ? 'trestné sekundy: chybný uzel 30 s, pomoc 30 s, předčasný start 10 s' : 'výsledný čas = delší z terčů L a P')],
        ['Přihlášky', s.stav === 'přihlášky' ? 'v portálu sborů' + (s.uzaverka ? ' do ' + Number(s.uzaverka.slice(8)) + '. ' + Number(s.uzaverka.slice(5, 7)) + '. ' + s.uzaverka.slice(0, 4) : '') : 'uzavřeny – přihlášeno ' + d.length + (s.kategorie.some(k => /jednotliv/i.test(k)) ? ' družstev a závodníků' : ' družstev')],
        ['Zahájení', ((s.oz.harmonogram || []).find(h => /zahájení/i.test(h[0])) || [])[1] || ''], ['Startovné', soStartovneText_(s.oz)],
        ['Náčelník štábu', s.oz.stab.nacelnik], ['Hlavní rozhodčí', s.hlavniRozhodci]].filter(x => x[1]),
      dokumenty: [s.ozPdf ? ['Organizační zabezpečení (PDF)', s.ozPdf] : null, s.propozice ? ['Propozice', s.propozice] : null, s.stav === 'zveřejněno' && s.pdf ? ['Výsledková listina (PDF)', s.pdf] : null].filter(Boolean),
      vysledky: poradi.map(c => s.druh === 'Hra Plamen' // Plamen: tabulka umístění po disciplínách (sloupce), jako pohár po kolech
        ? { kat: c.kat, typ: 'druzstva', sloupce: (c.discipliny || []).map(x => SO_PLAMEN_ZKR[x.d]), rows: c.rows.map(r => [r.poradi || '–', r.druzstvo, r.vysledek, (c.discipliny || []).map(x => r.mista[x.d] || '–'), (c.discipliny || []).map(() => true)]) }
        : /jednotliv/i.test(c.kat) // jednotlivci: na webu jen sbor závodníka, jako dosavadní ročníky (data webu jdou i do veřejného repozitáře); jména jsou ve výsledkové listině PDF
        ? { kat: c.kat, typ: 'jednotlivci', rows: c.rows.map(r => [r.poradi || '–', r.sbor, r.vysledek]) }
        : { kat: c.kat, typ: 'druzstva', rows: c.rows.map(r => [r.poradi || '–', r.druzstvo, r.vysledek]) })
    });
  });
  soPohary_().filter(p => p.stav === 'zveřejněno').forEach(p => {
    const v = soPoharVypocet_(p, souteze, druzstva);
    const kola = v.kola.map(k => k.sou);
    pridat(p.rocnik || new Date().getFullYear(), {
      id: p.id, nazev: p.nazev, podtitul: kola.length + ' ' + (kola.length === 1 ? 'kolo' : kola.length < 5 ? 'kola' : 'kol') + (p.pro === 'dospělí' ? '' : ''), dospeli: p.pro === 'dospělí',
      terminy: kola.length ? kola.map((s, i) => ({ d: soDen_(new Date(s.od)), misto: s.misto || '', pozn: (s.kolo || i + 1) + '. kolo' + (s.poradatel ? ' – pořádá ' + s.poradatel : '') })) : [{ d: p.rocnik + '-12-31', misto: '' }],
      poradatel: 'OSH Praha-západ', kategorie: v.poradi.map(c => c.kat),
      info: p.typ === 'Hra Plamen' ? [['Hodnocení', 'součet umístění ve všech disciplínách zveřejněných kol, nižší vyhrává; při shodě lepší umístění v požárním útoku, štafetě 4 × 60 m, útoku CTIF, štafetě CTIF a štafetě dvojic'],
        ['Hodnocení družstva', 'jen družstvo, které absolvovalo všechny disciplíny'], p.popis ? ['Poznámka', p.popis] : null].filter(Boolean) : [['Bodování', /počet/i.test(p.body) ? 'vítěz kola získá tolik bodů, kolik je v kategorii přihlášených družstev do poháru, druhý o bod méně' : 'body za 1., 2., 3. … místo: ' + p.body],
        ['Neplatný pokus', p.bodyNP != null ? p.bodyNP + ' b.' : 'body podle umístění'], ['Shoda bodů', 'větší počet lepších umístění, pak lepší čas v ročníku'], ['Započítává se', p.zapocitat ? p.zapocitat + ' nejlepších kol' : 'všechna kola'], p.minKol ? ['Hodnocení', 'družstvo musí absolvovat aspoň ' + p.minKol + ' kol'] : null,
        p.popis ? ['Poznámka', p.popis] : null].filter(Boolean),
      dokumenty: kola.filter(s => s.pdf).map(s => ['Výsledky ' + (s.kolo || '') + '. kolo', s.pdf]),
      kola: kola.map(s => (s.misto || '').split(',')[0] + ' ' + dm(s.od)),
      vysledky: v.poradi.map(c => Object.assign({ kat: c.kat, typ: 'druzstva', rows: c.rows.map(r => [r.poradi || '–', r.druzstvo, p.typ === 'Hra Plamen' && !r.hodnocen ? 'nehodnoceno' : r.celkem + ' b.', r.body.map(b => b == null ? '–' : b), r.pocita]) }, c.sloupce ? { sloupce: c.sloupce } : {}))
    });
  });
  return Object.keys(roky).map(Number).sort((a, b) => b - a).map(r => ({ rocnik: r, souteze: roky[r] }));
}

/* ---------- testy ---------- */

/**
 * Vloží testovací soutěž v požárním útoku (zítra, 2 kategorie × 3 družstva, 2 pokusy) s výsledky včetně NP a shody časů,
 * testovací pohár s touto soutěží jako 1. kolem a vypíše odkazy pro rozhodčí. Spustit z editoru (vlozitTestySoutezi) – i opakovaně.
 * Úklid: menu OSH data → Úklid testů (název obsahuje TEST).
 */
function vlozitTestySoutezi() {
  const o = { email: Session.getActiveUser().getEmail() || 'test', role: { 'Správce': true } };
  const zitra = new Date(Date.now() + 864e5), den = soDen_(zitra);
  const sbory = radkyRychle_('Sbory').filter(r => r['Sbor'] && String(r['Aktivní']).toUpperCase() !== 'NE').slice(0, 6);
  if (sbory.length < 3) throw new Error('V listu Sbory jsou méně než 3 sbory.');
  const p = soPoharUlozit_(o, { data: { nazev: 'TEST pohár v požárním útoku', rocnik: zitra.getFullYear(), pro: 'dospělí', kategorie: 'muži, ženy', body: '10,8,6,5,4,3,2,1', bodyNP: 1, zapocitat: '', minKol: '', stav: 'koncept' } });
  if (!p.ok) throw new Error(p.chyba);
  const s = soUlozit_(o, { data: { nazev: 'TEST soutěž v požárním útoku', od: den + 'T09:00:00', do: den + 'T15:00:00', misto: 'Testovací hřiště', poradatel: 'OSH Praha-západ',
    druh: 'požární útok', pro: 'dospělí', kategorie: 'muži, ženy', pokusy: 2, shoda: 'pravidla SH ČMS', uzaverka: soDen_(new Date()), pohar: p.pohar.id, kolo: 1, hlavniRozhodci: 'TEST Hlavní Rozhodčí' } });
  if (!s.ok) throw new Error(s.chyba);
  const id = s.data.id, sou = s.data;
  const sb = i => sbory[i % sbory.length], nazev = i => String(sb(i)['Sbor']).replace(/^SDH\s+/i, '');
  const tymy = [['muži', 0, ' A'], ['muži', 1, ''], ['muži', 2, ''], ['ženy', 3, ''], ['ženy', 4, ''], ['ženy', 0, ' B']];
  const ids = tymy.map(([kat, i, suf]) => {
    const v = soZapsatDruzstvo_(o, sou, { sbor: String(sb(i)['Sbor']), skupina: String(sb(i)['Skupina'] || '').split('@')[0], kat: kat, druzstvo: 'TEST ' + nazev(i) + suf, kontakt: o.email });
    if (!v.ok) throw new Error(v.chyba); return v.id;
  });
  soZmenitStav_(o, { id: id, stav: 'přihlášky' }); soZmenitStav_(o, { id: id, stav: 'uzavřeno' });
  const z = soZmenitStav_(o, { id: id, stav: 'závod' });
  if (!z.ok) throw new Error(z.chyba);
  // výsledky: muži – shoda nejlepšího času 18,20 (rozhodne součet pokusů) a NP v obou pokusech; ženy – NP + platný, 1 pokus chybí (doplní rozhodčí v panelu)
  const kod = z.kody.rozhodci.split('#k=')[1], k = soPodleKodu_(kod), sNyni = soNacistJednu_(id);
  const zap = (i, pokus, L, P, plat, pozn) => ({ klic: 'test-' + ids[i] + '-' + pokus, prihlaska: ids[i], pokus: pokus, casL: L, casP: P, platnost: plat || 'platný', poznamka: pozn || '', rozhodci: 'TEST rozhodčí', zapsano: new Date().toISOString() });
  const w = soZavodZapis_(k, sNyni, { zapisy: [
    zap(0, 1, 18.05, 18.2), zap(0, 2, 19.1, 19.45),
    zap(1, 1, 18.2, 17.9), zap(1, 2, 18.6, 18.75),
    zap(2, 1, null, null, 'NP', 'rozpojené savice'), zap(2, 2, null, null, 'NP', 'překročená čára nástřiku'),
    zap(3, 1, 21.4, 22.05), zap(3, 2, 20.9, 21.12),
    zap(4, 1, null, null, 'NP', 'nesražený terč do 120 s'), zap(4, 2, 23.5, 23.31),
    zap(5, 1, 24.8, 25.02)
  ] });
  if (!w.ok) throw new Error(w.chyba);
  const det = soDetail_(o, id);
  const u = soTestUzlovka_(o, den, sbory);
  const text = 'Soutěž ' + id + ' (zítra ' + den + ') – stav závod. Pořadí: ' + det.poradi.map(c => c.kat + ': ' + c.rows.map(r => (r.poradi || '–') + '. ' + r.druzstvo + ' ' + r.vysledek).join(', ')).join(' | ') +
    '\nOdkaz pro rozhodčí: ' + z.kody.rozhodci + '\nOdkaz pro hlavního rozhodčího: ' + z.kody.hlavni + '\n(platí do konce soutěže; nové vytvoří okres v aplikaci: Akce → Soutěže → detail → Nové odkazy)' +
    '\n\n' + u;
  console.log(text);
  try { SpreadsheetApp.getActive().toast('Testovací soutěž vložena – odkazy pro rozhodčí jsou v protokolu provedení.', 'Soutěže', 10); } catch (e) {}
  return text;
}

/** Testovací uzlová štafeta (část vlozitTestySoutezi): družstva i jednotlivci, trestné sekundy, NP nad limitem; 2. pokusy doplní rozhodčí v panelu. */
function soTestUzlovka_(o, den, sbory) {
  const s = soUlozit_(o, { data: { nazev: 'TEST uzlová štafeta', od: den + 'T09:00:00', do: den + 'T13:00:00', misto: 'Testovací tělocvična', poradatel: 'OSH Praha-západ',
    druh: 'uzlová štafeta', pro: 'MH', kategorie: 'mladší – družstva, mladší – jednotlivci, přípravka – jednotlivci', pokusy: 2, shoda: 'horší pokus', uzaverka: soDen_(new Date()), hlavniRozhodci: 'TEST Hlavní Rozhodčí' } });
  if (!s.ok) throw new Error(s.chyba);
  const id = s.data.id, sb = i => sbory[i % sbory.length], nazev = i => String(sb(i)['Sbor']).replace(/^SDH\s+/i, '');
  const tymy = [['mladší – družstva', 0, ''], ['mladší – družstva', 1, ''], ['mladší – družstva', 2, ''], ['mladší – jednotlivci', 0, '', 'Jan Testovací'], ['mladší – jednotlivci', 1, '', 'Eva Testovací'], ['mladší – jednotlivci', 0, '', 'Petr Testovací'], ['přípravka – jednotlivci', 2, '', 'Ema Testovací'], ['přípravka – jednotlivci', 3, '', 'Adam Testovací']];
  const ids = tymy.map(([kat, i, suf, jmeno]) => {
    const v = soZapsatDruzstvo_(o, s.data, { sbor: String(sb(i)['Sbor']), skupina: String(sb(i)['Skupina'] || '').split('@')[0], kat: kat, druzstvo: jmeno ? 'TEST ' + jmeno : 'TEST ' + nazev(i) + suf, kontakt: o.email });
    if (!v.ok) throw new Error(v.chyba); return v.id;
  });
  soZmenitStav_(o, { id: id, stav: 'přihlášky' }); soZmenitStav_(o, { id: id, stav: 'uzavřeno' });
  const z = soZmenitStav_(o, { id: id, stav: 'závod' });
  if (!z.ok) throw new Error(z.chyba);
  const k = soPodleKodu_(z.kody.rozhodci.split('#k=')[1]);
  const zap = (i, cas, uzly, pomoc, starty, plat, pozn) => ({ klic: 'test-' + ids[i] + '-1', prihlaska: ids[i], pokus: 1, casL: cas, casP: null, uzly: uzly, pomoc: pomoc, starty: starty,
    platnost: plat || 'platný', poznamka: pozn || '', rozhodci: 'TEST rozhodčí', zapsano: new Date().toISOString() });
  const w = soZavodZapis_(k, soNacistJednu_(id), { zapisy: [
    zap(0, 45.2, 1, 0, 2), zap(1, 52.8, 0, 0, 0), zap(2, 58.4, 3, 0, 0),
    zap(3, 32.35, 0, 0, 0), zap(4, 30.9, 1, 0, 0), zap(5, 64.0, 0, 0, 0),
    zap(6, 21.5, 0, 1, 0), zap(7, null, 0, 0, 0, 'NP', 'vynechaný uzel')
  ] });
  if (!w.ok) throw new Error(w.chyba);
  const det = soDetail_(o, id);
  return 'Uzlová štafeta ' + id + ' – stav závod. Pořadí: ' + det.poradi.map(c => c.kat + ': ' + c.rows.map(r => (r.poradi || '–') + '. ' + r.druzstvo + ' ' + r.vysledek).join(', ')).join(' | ') +
    '\nOdkaz pro rozhodčí: ' + z.kody.rozhodci + '\nOdkaz pro hlavního rozhodčího: ' + z.kody.hlavni;
}

/** Automatický test výpočtu pořadí a bodů poháru (nic nezapisuje). Výsledek v protokolu provedení. */
function testPoradiSoutezi() {
  const d = (id, kat, start, shoda) => ({ id: id, kat: kat, druzstvo: id, sbor: '', start: start, shoda: shoda || null, stav: 'přihlášeno' });
  const v = (p, pokus, L, P, plat) => ({ prihlaska: p, pokus: pokus, casL: L, casP: P, cas: plat && plat !== 'platný' ? null : Math.max(L, P), platnost: plat || 'platný' });
  const druzstva = [d('A', 'm', 1), d('B', 'm', 2), d('C', 'm', 3), d('D', 'm', 4), d('E', 'm', 5), d('F', 'm', 6)];
  const vys = [v('A', 1, 18.05, 18.2), v('A', 2, 19.1, 19.45), v('B', 1, 18.2, 17.9), v('B', 2, 18.6, 18.75), v('C', 1, 0, 0, 'NP'), v('C', 2, 0, 0, 'NP'),
    v('D', 1, 0, 0, 'NP'), v('D', 2, 0, 0, 'nenastoupil'), v('E', 1, 17, 17.5), v('E', 2, 0, 0, 'DIS'), v('F', 1, 16, 16.4), v('F', 2, 16.5, 16.3)];
  const vysl = [];
  const ok = (podm, text) => vysl.push((podm ? 'OK   ' : 'CHYBA ') + text);
  let r = soPoradi_({ kategorie: ['m'], pokusy: 2, shoda: 'pravidla SH ČMS' }, druzstva, vys)[0].rows;
  const por = id => r.find(x => x.id === id);
  ok(por('F').poradi === 1 && por('F').vysledek === '16,40 s', 'F 1. (16,40 – delší terč z lepšího pokusu)');
  ok(por('B').poradi === 2 && por('A').poradi === 3, 'shoda 18,20: B před A podle součtu pokusů (36,95 < 37,65)');
  ok(por('C').poradi === 4 && por('D').poradi === 5, 'NP za platnými; C (NP+NP) před D (NP+nenastoupil)');
  ok(por('E').stav === 'DIS' && por('E').poradi === null && r[r.length - 1].id === 'E', 'DIS bez pořadí na konci');
  r = soPoradi_({ kategorie: ['m'], pokusy: 2, shoda: 'rozhoduje pořadatel' }, druzstva, vys)[0].rows;
  ok(por('A').poradi === por('B').poradi && por('A').nerozhodnuto, 'ruční shoda bez rozhodnutí = dělené místo a nerozhodnuto');
  const d2 = druzstva.map(x => x.id === 'A' ? Object.assign({}, x, { shoda: 1 }) : x.id === 'B' ? Object.assign({}, x, { shoda: 2 }) : x);
  r = soPoradi_({ kategorie: ['m'], pokusy: 2, shoda: 'rozhoduje pořadatel' }, d2, vys)[0].rows;
  ok(por('A').poradi === 2 && por('B').poradi === 3 && !por('A').nerozhodnuto, 'ruční shoda rozhodnutá (A před B)');
  r = soPoradi_({ kategorie: ['m'], pokusy: 2, shoda: 'horší pokus' }, druzstva, vys)[0].rows;
  ok(por('B').poradi === 2 && por('A').poradi === 3, 'horší pokus: B (horší 18,75) před A (horší 19,45)');
  r = soPoradi_({ kategorie: ['m'], pokusy: 1, shoda: 'pravidla SH ČMS' }, druzstva, vys.filter(x => x.pokus === 1))[0].rows;
  ok(por('E').poradi === 2 && por('A').poradi === 3 && por('B').poradi === 3 && por('C').poradi === 5 && por('D').poradi === 5, '1 pokus: shoda 18,20 = dělené 3. místo, NP sdílí 5. místo');
  const kolo = rows => ({ poradi: [{ kat: 'm', rows: rows.map(x => Object.assign({ nejlepsi: x.cas || null }, x)) }] });
  let pp = soPoharPoradi_({ kategorie: ['m'], body: '10,8,6', bodyNP: 1, zapocitat: 1, minKol: 0, druzstev: '' },
    [kolo([{ druzstvo: 'X', stav: 'platný', poradi: 1, cas: 18 }, { druzstvo: 'Y', stav: 'NP', poradi: 2 }]), kolo([{ druzstvo: 'Y', stav: 'platný', poradi: 1, cas: 17 }, { druzstvo: 'X', stav: 'platný', poradi: 2, cas: 18 }])])[0].rows;
  ok(pp[0].celkem === 10 && pp[1].celkem === 10 && pp[0].poradi === 1 && pp[1].poradi === 2 && pp[0].druzstvo === 'Y', 'pohár: shoda bodů a 1. míst → lepší čas v ročníku (Y 17,00)');
  pp = soPoharPoradi_({ kategorie: ['m'], body: 'počet družstev', bodyNP: null, zapocitat: null, minKol: 2, druzstev: 'm 10' },
    [kolo([{ druzstvo: 'X', stav: 'platný', poradi: 1, cas: 18 }, { druzstvo: 'Y', stav: 'NP', poradi: 2 }]), kolo([{ druzstvo: 'X', stav: 'platný', poradi: 1, cas: 19 }])])[0].rows;
  ok(pp[0].druzstvo === 'X' && pp[0].celkem === 20 && pp[1].druzstvo === 'Y' && pp[1].body[0] === 9 && pp[1].poradi === null, 'pohár: 10 družstev v poháru → vítěz 10 b. i když jich přijelo méně, NP podle umístění, málo kol = nehodnocen');
  ok(soBodyZa_('počet družstev', 1, 7) === 7 && soBodyZa_('počet družstev', 7, 7) === 1, 'pohár: vítěz = počet družstev');
  // ZHVB: výsledný čas = trať − čekání + 60 s × body; shoda → body, pak K5, K7, K6…; K8 3 razítka = NP; chybějící stanoviště = rozpracováno
  const zp = (start, trat, tb, cek, extra) => { const p = { start: start, cil: start + trat }; ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7'].forEach((k, i) => { p[k] = tb[i] || 0; }); if (cek) p.c3 = cek; return Object.assign(p, extra || {}); };
  const zv = (id, pole, plat) => ({ prihlaska: id, pokus: 1, platnost: 'platný', rozpis: { pole: Object.assign(pole, plat ? { plat: plat } : {}) } });
  const zd = ['P', 'Q', 'R', 'S', 'T', 'U', 'W'].map((id, i) => d(id, 'mladší', i + 1));
  const z0 = 9 * 3600;
  r = soPoradi_({ druh: 'ZHVB', kategorie: ['mladší'], pokusy: 1 }, zd, [
    zv('P', zp(z0, 1800, [2, 1, 0, 0, 0, 0, 0], 120)), // 30:00 − 2:00 + 3 min = 31:00
    zv('Q', zp(z0 + 300, 1560, [3, 0, 0, 0, 0, 0, 0])), // 26:00 + 3 = 29:00
    zv('R', zp(z0 + 600, 1500, [0, 0, 0, 0, 2, 0, 2])), // 25:00 + 4 = 29:00 → víc bodů než Q
    zv('S', zp(z0 + 900, 1620, [0, 0, 0, 0, 1, 0, 1])), // 27:00 + 2 = 29:00 → méně bodů, 1.
    zv('T', zp(z0 + 1200, 1500, [1, 0, 0, 0, 0, 0, 0]), 'NP'),
    zv('U', { start: z0 + 1500, K1: 0 })
  ]).find(c => c.kat === 'mladší').rows;
  ok(por('S').poradi === 1 && por('Q').poradi === 2 && por('R').poradi === 3 && por('P').poradi === 4 && por('P').vysledek === '0:31:00', 'ZHVB: shoda 29:00 → méně trestných bodů (S 2 b. před Q 3 b. před R 4 b.); čekání se odečítá (P 0:31:00)');
  ok(por('T').stav === 'NP' && por('T').poradi === null && por('U').stav === 'rozpracováno' && por('W').stav === 'bez výsledku', 'ZHVB: NP bez pořadí, chybí cíl a stanoviště = rozpracováno, bez zápisu = bez výsledku');
  r = soPoradi_({ druh: 'ZHVB', kategorie: ['mladší'], pokusy: 1 }, zd.slice(0, 2), [zv('P', zp(z0, 1560, [1, 0, 0, 0, 2, 0, 0])), zv('Q', zp(z0, 1560, [0, 0, 0, 0, 0, 2, 1]))])[0].rows;
  ok(por('Q').poradi === 1 && por('P').poradi === 2, 'ZHVB: shoda času i bodů → méně bodů na K5 (požární ochrana) vyhrává');
  r = soPoradi_({ druh: 'ZHVB', kategorie: ['dorost'], pokusy: 1 }, [d('X', 'dorost', 1), d('Y', 'dorost', 2)], [zv('X', zp(z0, 1500, [], 0, { K8: 1 })), zv('Y', zp(z0, 1500, [], 0, { K8: 3 }))])[0].rows;
  ok(por('X').vysledek === '0:30:00' && por('Y').stav === 'NP', 'ZHVB dorost: 1 chybějící razítko = 5 b., 3 = neplatný výsledek');
  // Hra Plamen: umístění v disciplínách → body, shoda bodů → lepší umístění v pořadí PÚ, 4 × 60, PÚ CTIF, štafeta CTIF, dvojice
  const pv = (id, dis, pokus, cas, tb, plat) => ({ prihlaska: id, disciplina: dis, pokus: pokus, casL: cas, casP: null, cas: plat ? null : cas + (tb || 0), trestne: tb || 0, platnost: plat || 'platný' });
  const pd = ['A', 'B', 'C', 'D'].map((id, i) => d(id, 'mladší', i + 1));
  const kolo1 = { druh: 'Hra Plamen', kategorie: ['mladší'], discipliny: [{ d: 'štafeta 4 × 60 m', pokusy: 2 }, { d: 'štafeta CTIF', pokusy: 2 }] };
  const v1 = [pv('A', 'štafeta 4 × 60 m', 1, 60), pv('A', 'štafeta 4 × 60 m', 2, 0, 0, 'NP'), pv('A', 'štafeta CTIF', 1, 80, 10), pv('A', 'štafeta CTIF', 2, 95),
    pv('B', 'štafeta 4 × 60 m', 1, 62), pv('B', 'štafeta 4 × 60 m', 2, 63), pv('B', 'štafeta CTIF', 1, 85), pv('B', 'štafeta CTIF', 2, 99),
    pv('C', 'štafeta 4 × 60 m', 1, 61), pv('C', 'štafeta 4 × 60 m', 2, 64), pv('C', 'štafeta CTIF', 1, 90), pv('C', 'štafeta CTIF', 2, 85, 10),
    pv('D', 'štafeta 4 × 60 m', 1, 0, 0, 'nenastoupil'), pv('D', 'štafeta 4 × 60 m', 2, 0, 0, 'nenastoupil'), pv('D', 'štafeta CTIF', 1, 80), pv('D', 'štafeta CTIF', 2, 81)];
  const pk = soPoradi_(kolo1, pd, v1)[0];
  const dis = (x, id) => pk.discipliny.find(y => y.d === x).rows.find(r => r.id === id).poradi;
  ok(dis('štafeta CTIF', 'D') === 1 && dis('štafeta CTIF', 'B') === 2 && dis('štafeta CTIF', 'C') === 3 && dis('štafeta CTIF', 'A') === 4, 'Plamen disciplína: A i C nejlépe 90 s a součet 185 s → C (bez trestných sekund u lepšího času) před A (80 + 10)');
  r = pk.rows;
  ok([por('A').body, por('B').body, por('C').body].join() === '5,5,5' && por('A').poradi === 1 && por('C').poradi === 2 && por('B').poradi === 3, 'Plamen kolo: body = součet umístění, shoda 5 b. → lepší umístění ve 4 × 60 m (A 1., C 2., B 3.)');
  ok(por('D').stav === 'nehodnoceno' && por('D').poradi === null, 'Plamen kolo: nenastoupil v disciplíně = nehodnoceno');
  r = soPoradi_(Object.assign({}, kolo1, { discipliny: [{ d: 'štafeta 4 × 60 m', pokusy: 1 }, { d: 'štafeta CTIF', pokusy: 1 }] }), pd.slice(0, 2),
    [pv('A', 'štafeta 4 × 60 m', 1, 61), pv('B', 'štafeta 4 × 60 m', 1, 60), pv('A', 'štafeta CTIF', 1, 80), pv('B', 'štafeta CTIF', 1, 81)])[0].rows;
  ok(por('B').poradi === 1 && por('A').poradi === 2 && por('A').body === por('B').body, 'Plamen kolo: shoda bodů → lepší umístění ve štafetě 4 × 60 m');
  r = soPoradi_(kolo1, pd.slice(0, 1), [pv('A', 'štafeta 4 × 60 m', 1, 60)])[0].rows;
  ok(por('A').stav === 'rozpracováno' && por('A').chybi.join(',') === '4 × 60 m 2.,štafeta CTIF 1.,štafeta CTIF 2.', 'Plamen kolo: chybějící pokusy = rozpracováno (brání ověření)');
  const pkolo = (n, kats, dis, rows) => ({ sou: { kolo: n }, poradi: kats.map(k => ({ kat: k, rows: rows.filter(x => x.kat === k), discipliny: dis.map(dd => ({ d: dd, rows: rows.filter(x => x.kat === k).map(x => ({ druzstvo: x.n, stav: 'platný', poradi: x.m[dd] })) })) })) });
  const roc = soPlamenRocnik_({ kategorie: [], typ: 'Hra Plamen' }, [
    pkolo(1, ['mladší'], ['štafeta 4 × 60 m'], [{ kat: 'mladší', n: 'Sloup', druzstvo: 'Sloup', m: { 'štafeta 4 × 60 m': 2 } }, { kat: 'mladší', n: 'Psáry', druzstvo: 'Psáry', m: { 'štafeta 4 × 60 m': 1 } }]),
    pkolo(2, ['přípravka', 'mladší'], ['požární útok'], [{ kat: 'mladší', n: 'Sloup', druzstvo: 'Sloup', m: { 'požární útok': 1 } }, { kat: 'mladší', n: 'Psáry', druzstvo: 'Psáry', m: { 'požární útok': 2 } }, { kat: 'přípravka', n: 'Zahořany', druzstvo: 'Zahořany', m: { 'požární útok': 1 } }])]);
  const ml = roc.find(c => c.kat === 'mladší'), pr = roc.find(c => c.kat === 'přípravka');
  ok(ml.rows[0].druzstvo === 'Sloup' && ml.rows[0].celkem === 3 && ml.rows[1].poradi === 2 && ml.sloupce.join('|') === '1. kolo · 4 × 60 m|2. kolo · PÚ', 'Plamen ročník: součet přes kola, shoda 3 b. → lepší v požárním útoku (Sloup)');
  ok(pr.sloupce.length === 1 && pr.rows[0].poradi === 1, 'Plamen ročník: přípravka jen z kola, kde soutěžila');
  const text = vysl.join('\n');
  console.log(text);
  if (vysl.some(x => x.indexOf('CHYBA') === 0)) throw new Error('Test pořadí neprošel:\n' + text);
  return text;
}
