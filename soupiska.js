/* Soupiska družstva do soutěže (B17) – aplikace (portál sboru i správa okresu).
 * - rozsah(soutez, kategorie): pravidla kategorie – rok konce ročníku, nejstarší / nejmladší ročník narození, pohlaví, počet členů
 * - posoudit(clen, R): důvod, proč člen do kategorie nesmí ('' = smí)
 *   Kopie cleRozsah_ / clePosoudit_ z apps-script/Clenove.gs (server kontroluje znovu) – měnit obě.
 * - dokumenty(soutez, moje): které přihlášky k tisku sbor potřebuje (uzlová štafeta jedna za sbor, jinak jedna za družstvo
 *   a jedna za kategorii jednotlivců) – podle vzorů OORM (Drive: Okresní odborná rada mládeže / soutěže, ročník 2026)
 * - pdf(dokument, vedouci): přihláška jako PDF ve tvaru vzoru – jmenný seznam (Plamen, ZHVB, dorost, 60 m: jméno, datum narození,
 *   člen SDH, bydliště – obec, vedoucí s adresou, prohlášení, potvrzení SDH) nebo přihláška uzlové štafety (jednotlivci po kategoriích,
 *   družstvo ANO/NE). pdf-lib + písmo s diakritikou přes prihlaska.js. Jen prohlížeč – údaje vedoucího se nikam neposílají. */
(function (koren) {
  const VELIKOST = { 'ZHVB': [5, 5], 'Hra Plamen': [5, 10], 'uzlová štafeta': [5, 5], 'požární útok': [7, 9] };

  function rozsah(s, kat) {
    const od = new Date(s.od || Date.now()), rokSoutez = od.getFullYear(), E = od.getMonth() >= 8 ? rokSoutez + 1 : rokSoutez;
    const k = String(kat || '').toLowerCase(), oz = ((s.oz || {}).kategorie || {})[kat] || {};
    const jednotlivci = /jednotliv/.test(k);
    const dosp = /muži|ženy|dospěl/.test(k) || (s.pro === 'dospělí' && !/dorost|mladš|starš|příprav/.test(k));
    const pohlavi = /dívk|dorostenk|žen/.test(k) ? 'žena' : /chlap|dorostenc|muž/.test(k) ? 'muž' : '';
    let nejstarsi = null, nejmladsi = null, zOz = false, vek = null;
    const roky = (String(oz.rocniky || '').match(/\b(19|20)\d{2}\b/g) || []).map(Number);
    if (roky.length >= 2) { nejstarsi = Math.min.apply(null, roky); nejmladsi = Math.max.apply(null, roky); zOz = true; }
    else if (roky.length === 1) { if (/starš|dřív|a před/.test(String(oz.rocniky))) nejmladsi = roky[0]; else nejstarsi = roky[0]; zOz = true; }
    else if (dosp) nejmladsi = rokSoutez - 15;
    else if (/příprav/.test(k)) { vek = 6; nejstarsi = E - 6; }
    else if (/mladš/.test(k)) { vek = 11; nejstarsi = E - 11; }
    else if (/starš/.test(k)) { vek = 15; nejstarsi = E - 15; }
    else if (/dorost/.test(k)) { vek = 18; nejstarsi = E - 18; }
    if (!dosp) nejmladsi = jednotlivci && /dorost/.test(k) && !zOz ? E - 15 : zOz && jednotlivci ? nejmladsi : null; // mládež: družstvo smí doplnit mladší; jednotlivec dorostu musí mít aspoň 15 let v roce konce ročníku // mládež: kategorii smí doplnit mladší
    const v = VELIKOST[s.druh] || [5, 10];
    const min = jednotlivci ? 1 : Number(oz.min) || v[0], max = jednotlivci ? 1 : Math.max(Number(oz.max) || v[1], Number(oz.min) || 0);
    return { E, rokSoutez, nejstarsi, nejmladsi, vek, zOz, dosp, pohlavi, smiseny: /smíšen/.test(k), jednotlivci, min: Math.min(min, max), max, jednouVKole: s.druh === 'ZHVB' };
  }
  function posoudit(c, R) {
    const d = String(c.narozen || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return 'chybí datum narození';
    const y = Number(d.slice(0, 4));
    if (R.nejstarsi && y < R.nejstarsi) return R.vek && !R.zOz ? 'starší než ' + R.vek + ' let v roce ' + R.E + ' (ročník ' + y + ', nejstarší povolený ' + R.nejstarsi + ')' : 'ročník ' + y + ' – podle OZ nejstarší ' + R.nejstarsi;
    if (R.nejmladsi && y > R.nejmladsi) return R.zOz ? 'ročník ' + y + ' – podle OZ nejmladší ' + R.nejmladsi : (R.dosp ? 'v roce ' + R.rokSoutez : 'v roce ' + R.E) + ' mu nebude 15 let (ročník ' + y + ')';
    if (R.pohlavi && c.pohlavi && c.pohlavi !== R.pohlavi) return R.pohlavi === 'žena' ? 'kategorie jen pro dívky / ženy' : 'kategorie jen pro chlapce / muže';
    if (R.pohlavi && !c.pohlavi) return 'chybí pohlaví (kategorie ' + (R.pohlavi === 'žena' ? 'dívek / žen' : 'chlapců / mužů') + ')';
    return '';
  }
  /** Jedna věta pro sbor: kdo do kategorie smí. */
  function popis(R) {
    const c = [];
    if (R.nejstarsi) c.push('narození ' + R.nejstarsi + ' a později' + (R.vek && !R.zOz ? ' (věk v roce ' + R.E + ' nejvýš ' + R.vek + ' let)' : R.zOz ? ' (podle OZ soutěže)' : ''));
    if (R.nejmladsi) c.push('narození ' + R.nejmladsi + ' a dříve' + (R.zOz ? ' (podle OZ)' : R.dosp ? ' (15 let v roce soutěže)' : ' (aspoň 15 let v roce ' + R.E + ')'));
    if (R.pohlavi) c.push(R.pohlavi === 'žena' ? 'jen dívky / ženy' : 'jen chlapci / muži');
    if (R.smiseny) c.push('dívky i chlapci');
    c.push(R.jednotlivci ? '1 závodník' : R.min === R.max ? R.max + ' členů' : R.min + '–' + R.max + ' členů');
    return c.join(' · ');
  }

  /* ---------- přihlášky k tisku (vzory OORM) ---------- */
  const TEXT_ZAKLAD = 'Vedoucí družstva stvrzuje svým podpisem, že zdravotní stav členů družstva je odpovídající k absolvování akce, na kterou se prostřednictvím této přihlášky přihlašují a rovněž, že zákonní zástupci členů družstva souhlasili s využití obrazových materiálů oficiálně pořízených pověřenými členy štábu k dalším provozním účelům SH ČMS (plakáty, propagační předměty, tiskoviny apod.).';
  const TEXT_PROSTREDKY = ' Dále stvrzuje, že veškeré technické a věcné prostředky PO použité v soutěži odpovídají ';
  const bezJed = k => String(k || '').replace(/\s*[–-]\s*jednotliv\S*/i, '').trim();
  const jeJed = k => /jednotliv/i.test(String(k || ''));
  /** Dokumenty k tisku pro náš sbor: soutez = detail soutěže, moje = naše přihlášky { id, kat, druzstvo, soupiska }. */
  function dokumenty(s, moje) {
    const M = (moje || []).filter(m => m.stav !== 'odhlášeno');
    if (!M.length) return [];
    if (s.druh === 'uzlová štafeta') return [{ id: 'uzlova', nazev: 'Přihláška sboru (všechny kategorie)', typ: 'uzlova', moje: M }];
    const out = [];
    M.filter(m => !jeJed(m.kat)).forEach(m => out.push({ id: m.id, nazev: m.druzstvo + ' – ' + m.kat, typ: 'druzstvo', kat: m.kat, druzstvo: m.druzstvo, polozky: m.soupiska || [] }));
    const jed = {}; M.filter(m => jeJed(m.kat)).forEach(m => { (jed[m.kat] = jed[m.kat] || []).push(m); });
    Object.keys(jed).forEach(k => out.push({ id: 'jed-' + k, nazev: 'Jednotlivci ' + bezJed(k) + ' (' + jed[k].length + ')', typ: 'jednotlivci', kat: k,
      polozky: jed[k].map(m => (m.soupiska || [])[0] || { jmeno: String(m.druzstvo || '').split(' ').slice(0, -1).join(' '), prijmeni: String(m.druzstvo || '').split(' ').slice(-1)[0] }) }));
    return out;
  }
  /** Rozvržení jmenného seznamu podle vzoru: počet řádků, sloupec navíc, prohlášení. */
  function vzor(s, dok) {
    const dorost = /dorost/i.test(dok.kat) && s.druh !== 'ZHVB', jed = dok.typ === 'jednotlivci', R = rozsah(s, dok.kat); // ZHVB má vlastní vzor i pro dorost (10 řádků, bez 100 m)
    const radku = Math.max(jed ? (dorost ? 10 : 5) : (dorost ? 8 : 10), R.max || 0, (dok.polozky || []).length);
    const navic = dorost ? (jed ? ['kategorie mladší/ střední/ starší', (bezJed(dok.kat).match(/mladš\S*|střední|starš\S*/i) || [''])[0]] : ['100 m ano/ne', '']) : null;
    const smernice = s.druh === 'ZHVB' ? '' : dorost || (s.druh === 'Hra Plamen' && jed) ? 'Směrnici pro činnost dorostu SH ČMS' : s.druh === 'Hra Plamen' ? 'Směrnici hry Plamen' : '';
    return { radku, navic, prohlaseni: TEXT_ZAKLAD + (smernice ? TEXT_PROSTREDKY + smernice + ', jsou řádně přezkoušené, schválené a nejsou nijak upravené.' : ''), nadpis: jed ? 'Jmenný seznam členů' : 'Jmenný seznam členů družstva' };
  }

  /* d = { soutez: { nazev, od, misto, druh, pro, kategorie, oz }, sbor (bez „SDH“), dokument (z dokumenty()), vedouci: { jmeno, narozen, telefon, email, adresa } } */
  async function pdf(d, zaklad) {
    const P = koren.OSH_PRIHLASKA;
    const [PDFLib, fontkit, pismo] = await Promise.all([P.knihovna('PDFLib'), P.knihovna('fontkit'), P.soubor((zaklad || '') + P.PISMO)]);
    const doc = await PDFLib.PDFDocument.create(); doc.registerFontkit(fontkit);
    const f = await doc.embedFont(pismo, { subset: true }), W = 595.28, H = 841.89, M = 44, cerna = PDFLib.rgb(0, 0, 0), seda = PDFLib.rgb(0.4, 0.4, 0.4);
    const s = d.soutez || {}, dok = d.dokument || {}, v = d.vedouci || {}, sbor = String(d.sbor || '').replace(/^SDH\s+/i, '');
    const datum = P.datumCz(String(s.od || '').slice(0, 10)), rok = String(s.od || '').slice(0, 4) || String(new Date().getFullYear());
    let page = doc.addPage([W, H]), y = H - M;
    const sir = (t, vel) => f.widthOfTextAtSize(String(t == null ? '' : t), vel);
    const text = (t, x, yy, vel, barva) => page.drawText(String(t == null ? '' : t), { x, y: yy, size: vel, font: f, color: barva || cerna });
    const stred = (t, yy, vel) => text(t, (W - sir(t, vel)) / 2, yy, vel);
    const orez = (t, max, vel) => { let u = String(t || ''); if (sir(u, vel) <= max) return u; while (u && sir(u + '…', vel) > max) u = u.slice(0, -1); return u + '…'; };
    const cara = (x1, y1, x2, y2, tl, tecky) => page.drawLine(Object.assign({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: tl || 0.6, color: cerna }, tecky ? { dashArray: [1, 2] } : {}));
    const zalom = (t, max, vel) => { const r = []; let a = ''; String(t).split(' ').forEach(w => { if (a && sir(a + ' ' + w, vel) > max) { r.push(a); a = w; } else a = a ? a + ' ' + w : w; }); if (a) r.push(a); return r; };
    const pole = (popis, hodnota, x, sirka, vel) => { text(popis, x, y, 10.5); const x2 = x + sir(popis, 10.5) + 6; text(orez(hodnota, x + sirka - x2 - 4, vel || 11), x2 + 2, y + 1, vel || 11); cara(x2, y - 3, x + sirka, y - 3, 0.6, true); };
    if (dok.typ === 'uzlova') {
      zalom('Přihláška – ' + [s.nazev, datum, s.misto].filter(Boolean).join(', '), W - 2 * M, 14).forEach(r => { stred(r, y, 14); y -= 19; });
      y -= 8; pole('SDH', sbor, M, W - 2 * M, 13); y -= 26;
      const kat = s.kategorie || [], zakl = []; kat.forEach(k => { const b = bezJed(k); if (zakl.indexOf(b) < 0) zakl.push(b); });
      zakl.forEach(b => {
        const kJ = kat.find(k => jeJed(k) && bezJed(k) === b), kD = kat.find(k => !jeJed(k) && k === b);
        const jed = kJ ? dok.moje.filter(m => m.kat === kJ).map(m => (m.soupiska || [])[0] || { jmeno: m.druzstvo, prijmeni: '' }) : [];
        const druz = kD ? dok.moje.filter(m => m.kat === kD).length : 0;
        if (y < M + 160) { page = doc.addPage([W, H]); y = H - M; }
        if (kJ) {
          const radku = Math.max(5, jed.length), sl = [M, M + 22, W - M - 110, W - M];
          const hTop = y + 14;
          page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 20, color: PDFLib.rgb(0.88, 0.9, 0.95) });
          text('Jednotlivci ' + b + ' (jméno a příjmení)', M + 4, y, 10.5); text('Datum narození', sl[2] + 4, y, 10.5); y -= 6; cara(M, y, W - M, y, 1);
          const rTop = y;
          for (let i = 0; i < radku; i++) { const p = jed[i], yy = y - 15; text((i + 1) + '.', M + 4, yy, 10); if (p) { text(orez((p.jmeno + ' ' + p.prijmeni).trim(), sl[2] - sl[1] - 8, 10.5), sl[1] + 4, yy, 10.5); text(P.datumCz(p.narozen), sl[2] + 4, yy, 10.5); } y -= 21; cara(M, y, W - M, y, 0.4); }
          [M, sl[2], W - M].forEach(x => cara(x, y, x, hTop, 0.5)); cara(sl[1], y, sl[1], rTop, 0.4); y -= 14;
        }
        if (kD) { y -= 6; page.drawRectangle({ x: M, y: y - 8, width: W - 2 * M, height: 22, color: PDFLib.rgb(0.96, 0.91, 0.85) }); text('Družstvo ' + b + ': ' + (druz ? 'ANO' + (druz > 1 ? ', počet družstev ' + druz : '') : 'NE'), M + 4, y - 1, 11.5); y -= 22; }
        y -= 18;
      });
      y -= 10; pole('vedoucí:', v.jmeno, M, (W - 2 * M) / 2 - 10); pole('podpis:', '', M + (W - 2 * M) / 2 + 10, (W - 2 * M) / 2 - 10); y -= 46;
      cara(W - M - 200, y, W - M, y, 0.6); text('razítko a podpis SDH', W - M - 200, y - 12, 9, seda);
    } else {
      const V = vzor(s, dok);
      stred('P Ř I H L Á Š K A', y - 4, 22); y -= 30;
      zalom([s.nazev, datum, s.misto].filter(Boolean).join(', '), W - 2 * M, 12.5).forEach(r => { stred(r, y, 12.5); y -= 16; });
      y -= 12; pole('SDH:', sbor, M, W - 2 * M, 12); y -= 22; pole('kategorie:', bezJed(dok.kat).toUpperCase() + (dok.typ === 'jednotlivci' ? ' – JEDNOTLIVCI' : ''), M, W - 2 * M, 12);
      if (dok.typ === 'druzstvo' && dok.druzstvo && dok.druzstvo !== sbor) { y -= 22; pole('družstvo:', dok.druzstvo, M, W - 2 * M, 12); }
      y -= 24; stred(V.nadpis, y, 12); y -= 12;
      const sirky = V.navic ? [30, 142, 76, 78, 92, 89] : [34, 170, 82, 96, 125], xs = [M]; sirky.forEach(w => xs.push(xs[xs.length - 1] + w));
      const hl = ['poř. č.', 'jméno, příjmení', 'datum narození', 'člen SDH', 'bydliště (město, obec)'].concat(V.navic ? [V.navic[0]] : []);
      const hlR = hl.map((h, i) => zalom(h, sirky[i] - 6, 8.5)), vh = 8 + 9.5 * Math.max.apply(null, hlR.map(r => r.length));
      cara(M, y, xs[xs.length - 1], y, 1.4);
      hlR.forEach((r, i) => r.forEach((q, j) => text(q, xs[i] + (sirky[i] - sir(q, 8.5)) / 2, y - 11 - j * 9.5, 8.5)));
      y -= vh; cara(M, y, xs[xs.length - 1], y, 1);
      const radek = 21, horni = y;
      for (let i = 0; i < V.radku; i++) {
        const p = (dok.polozky || [])[i], yy = y - 14;
        text((i + 1) + '.', xs[0] + 10, yy, 10.5);
        if (p) {
          text(orez((p.jmeno + ' ' + p.prijmeni).trim(), sirky[1] - 8, 10.5), xs[1] + 4, yy, 10.5);
          text(P.datumCz(p.narozen), xs[2] + 4, yy, 10.5);
          text(orez(String(p.host || sbor).replace(/^SDH\s+/i, ''), sirky[3] - 8, 9.5), xs[3] + 4, yy, 9.5);
          text(orez(p.obec || '', sirky[4] - 8, 9.5), xs[4] + 4, yy, 9.5);
          if (V.navic && V.navic[1]) text(V.navic[1], xs[5] + 4, yy, 9.5);
        }
        y -= radek; cara(M, y, xs[xs.length - 1], y, i === V.radku - 1 ? 1.4 : 0.5);
      }
      xs.forEach((x, i) => cara(x, y, x, horni + vh, i === 0 || i === xs.length - 1 ? 1.4 : 0.5));
      y -= 26; text('Vedoucí družstva:', M, y, 12); cara(M, y - 2, M + sir('Vedoucí družstva:', 12), y - 2, 0.6); y -= 22;
      [['Jméno, příjmení:', v.jmeno], ['Datum narození:', P.datumCz(v.narozen)], ['Telefon:', v.telefon], ['E-mail:', v.email], ['Adresa:', v.adresa], ['Podpis:', '']].forEach(([k, h]) => {
        text(k, M, y, 10.5); text(orez(h, 300, 10.5), M + 112, y + 1, 10.5); cara(M + 108, y - 3, M + 420, y - 3, 0.6, true); y -= 20; });
      y -= 4; zalom(V.prohlaseni, W - 2 * M, 9).forEach(r => { text(r, M, y, 9); y -= 12; });
      y -= 14; text('POTVRZENÍ SDH:', M, y, 11.5); y -= 16;
      text('Potvrzujeme, že všichni uvedení účastníci jsou řádně registrovaní na OSH a mají zaplaceny členské příspěvky na rok ' + rok + '.', M, y, 9.5);
      y -= 44; cara(W - M - 200, y, W - M, y, 0.6); text('razítko a podpis SDH', W - M - 200 + (200 - sir('razítko a podpis SDH', 9)) / 2, y - 12, 9, seda);
    }
    page.drawText('Vytvořeno ve Spojce (aplikace OSH Praha-západ) ' + P.datumCz(new Date().toISOString().slice(0, 10)) + '.', { x: M, y: 22, size: 7, font: f, color: seda });
    doc.setTitle('Přihláška – ' + (s.nazev || '') + ' – ' + (dok.nazev || ''));
    return doc.save();
  }

  const api = { rozsah, posoudit, popis, dokumenty, vzor, pdf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else koren.OSH_SOUPISKA = api;
})(typeof window !== 'undefined' ? window : globalThis);
