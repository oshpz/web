/* Soupiska družstva do soutěže (B17) – aplikace (portál sboru i správa okresu).
 * - rozsah(soutez, kategorie): pravidla kategorie – rok konce ročníku, nejstarší / nejmladší ročník narození, pohlaví, počet členů
 * - posoudit(clen, R): důvod, proč člen do kategorie nesmí ('' = smí)
 *   Kopie cleRozsah_ / clePosoudit_ z apps-script/Clenove.gs (server kontroluje znovu) – měnit obě.
 * - pdf(d): přihláška / soupiska jako PDF (pdf-lib + písmo s diakritikou přes prihlaska.js). Jen prohlížeč, nikam se neukládá.
 *   Oficiální vzory přihlášek v assets/sablony/souteze/ zatím nejsou – PDF se kreslí podle společné kostry přihlášek (soutěž, SDH,
 *   kategorie, soupiska, razítko a podpis). Rodné číslo ani adresu PDF nemá; když je pořadatel chce, sbor je dopíše ručně. */
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

  /* ---------- PDF ----------
   * d = { soutez: { nazev, od, misto, druh, poradatel }, sbor, kat, druzstvo, kontakt, max, soupiska: [{ jmeno, prijmeni, narozen, ev, mimo, host }] } */
  async function pdf(d, zaklad) {
    const P = koren.OSH_PRIHLASKA;
    const [PDFLib, fontkit, pismo] = await Promise.all([P.knihovna('PDFLib'), P.knihovna('fontkit'), P.soubor((zaklad || '') + P.PISMO)]);
    const doc = await PDFLib.PDFDocument.create(); doc.registerFontkit(fontkit);
    const f = await doc.embedFont(pismo, { subset: true }), page = doc.addPage([595.28, 841.89]), W = 595.28, M = 48, cerna = PDFLib.rgb(0, 0, 0), seda = PDFLib.rgb(0.35, 0.35, 0.35);
    let y = 841.89 - M;
    const text = (t, x, yy, vel, barva) => page.drawText(String(t == null ? '' : t), { x, y: yy, size: vel || 10, font: f, color: barva || cerna });
    const sirka = (t, vel) => f.widthOfTextAtSize(String(t || ''), vel || 10);
    const oriznout = (t, max, vel) => { let s = String(t || ''); while (s && sirka(s, vel) > max) s = s.slice(0, -1); return s === String(t || '') ? s : s.slice(0, -1) + '…'; };
    const cara = (x1, y1, x2, y2, tl) => page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: tl || 0.8, color: cerna });
    const s = d.soutez || {}, den = P.datumCz(String(s.od || '').slice(0, 10));
    text('PŘIHLÁŠKA DO SOUTĚŽE – SOUPISKA', M, y, 16); y -= 22;
    text(oriznout(s.nazev, W - 2 * M, 12), M, y, 12); y -= 16;
    text(oriznout([s.druh, den, s.misto, s.poradatel ? 'pořádá ' + s.poradatel : ''].filter(Boolean).join(' · '), W - 2 * M, 9.5), M, y, 9.5, seda); y -= 26;
    [['Sbor (SDH)', String(d.sbor || '')], ['Kategorie', d.kat], [/jednotliv/i.test(d.kat) ? 'Závodník' : 'Družstvo / hlídka', d.druzstvo], ['Vedoucí – kontakt', d.kontakt]].forEach(([k, v]) => {
      text(k, M, y, 9, seda); text(oriznout(v, W - 2 * M - 120, 11), M + 120, y, 11); cara(M + 118, y - 3, W - M, y - 3, 0.4); y -= 20; });
    y -= 8;
    const sl = [[M, 'Č.', 22], [M + 24, 'Příjmení a jméno', 190], [M + 216, 'Datum narození', 86], [M + 304, 'Evidenční číslo', 86], [M + 392, 'Poznámka', W - M - (M + 392)]];
    const vyskaRadku = 22;
    page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 20, color: PDFLib.rgb(0.92, 0.92, 0.92) });
    sl.forEach(([x, t]) => text(t, x + 3, y, 9)); y -= 6;
    cara(M, y, W - M, y, 1.2);
    const radky = Math.max(d.max || 0, (d.soupiska || []).length, 1);
    for (let i = 0; i < radky; i++) {
      const p = (d.soupiska || [])[i];
      const yy = y - vyskaRadku + 7;
      text(i + 1 + '.', sl[0][0] + 3, yy, 10);
      if (p) {
        text(oriznout(p.prijmeni + ' ' + p.jmeno, sl[1][2] - 6, 10.5), sl[1][0] + 3, yy, 10.5);
        text(P.datumCz(p.narozen), sl[2][0] + 3, yy, 10.5);
        text(oriznout(p.ev || '', sl[3][2] - 6, 10), sl[3][0] + 3, yy, 10);
        text(oriznout(p.mimo ? (p.host ? 'zapůjčen: ' + p.host : 'není v evidenci sboru') : '', sl[4][2] - 6, 8.5), sl[4][0] + 3, yy, 8.5, seda);
      }
      y -= vyskaRadku; cara(M, y, W - M, y, 0.4);
    }
    [M, M + 24, M + 216, M + 304, M + 392, W - M].forEach(x => cara(x, y, x, y + vyskaRadku * radky + 6, 0.4));
    y -= 30;
    const prohlaseni = 'Potvrzujeme, že uvedení soutěžící jsou členy SH ČMS ve sboru uvedeném výše a splňují podmínky soutěže (věk, zdravotní způsobilost, pojištění podle pravidel). Údaje jsou z evidence členů sboru.';
    let radek = '', yy = y;
    prohlaseni.split(' ').forEach(w => { if (sirka(radek + ' ' + w, 9) > W - 2 * M) { text(radek, M, yy, 9); yy -= 13; radek = w; } else radek = radek ? radek + ' ' + w : w; });
    text(radek, M, yy, 9); y = yy - 46;
    cara(M, y, M + 180, y, 0.6); cara(W - M - 200, y, W - M, y, 0.6);
    text('Datum', M, y - 12, 8.5, seda); text('Razítko SDH a podpis statutárního zástupce', W - M - 200, y - 12, 8.5, seda);
    text('Vytvořeno v aplikaci OSH Praha-západ ' + P.datumCz(new Date().toISOString().slice(0, 10)) + '. Soutěžící bez evidenčního čísla zkontroluje okres u prezence.', M, M - 16, 7.5, seda);
    doc.setTitle('Přihláška – ' + (s.nazev || '') + ' – ' + (d.druzstvo || ''));
    return doc.save();
  }

  const api = { rozsah, posoudit, popis, pdf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else koren.OSH_SOUPISKA = api;
})(typeof window !== 'undefined' ? window : globalThis);
