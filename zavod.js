/* Závodní panel rozhodčích (B8) – zavod.html#k=<kód>. Bez přihlášení: kód z odkazu platí jen pro jednu soutěž a do jejího konce.
 * Bez signálu: soutěž, startovka a výsledky se drží v telefonu (localStorage), zápisy čekají ve frontě a odešlou se po připojení.
 * Každý zápis má vlastní klíč – server ho při opakovaném odeslání nezapíše dvakrát; při souběhu dvou rozhodčích platí novější zápis.
 * Pořadí počítá souteze.js (kopie výpočtu ze serveru). Hlavní rozhodčí (vlastní odkaz) výsledky ověří, okres je pak zveřejní.
 * ZHVB: hlavní je přepis startovní karty sčítací komisí po doběhnutí hlídky (pořadí a úkoly jako na kartě). Nepovinně zápis na stanovišti
 * (start, cíl, K1–K8) – každý zápis nese jen svá pole a server je slučuje.
 * Hra Plamen: rozhodčí si zvolí disciplínu kola; požární útok = terče L a P, štafeta 4 × 60 m = čas, ostatní = čas + trestné sekundy.
 * Server: akce „zavod“ (krok data | zapis | overit) v apps-script/Souteze.gs. */
(function () {
  'use strict';
  const CFG = window.OSH_CONFIG || {}, API = CFG.apiUrl || '', P = window.OSH_PORADI;
  const $ = id => document.getElementById(id);
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const kod = ((location.hash || '').match(/k=([a-f0-9]{32})/) || [])[1] || '';
  const KLIC = 'oshpz-zavod-' + kod.slice(0, 12);
  const uloz = (k, v) => { try { localStorage.setItem(KLIC + k, JSON.stringify(v)); } catch (e) {} };
  const nacti = (k, z) => { try { const x = localStorage.getItem(KLIC + k); return x ? JSON.parse(x) : z; } catch (e) { return z; } };
  const jmenoUlozene = () => { try { return localStorage.getItem('oshpz-zavod-jmeno') || ''; } catch (e) { return ''; } };
  const novyKlic = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12));
  const fDatum = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + d.getFullYear(); };
  const fCas = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const zapisu = n => n === 1 ? 'zápis' : n >= 2 && n <= 4 ? 'zápisy' : 'zápisů';

  const st = {
    data: nacti('-data', null), fronta: nacti('-fronta', []), hlaseni: nacti('-hlaseni', []), posledni: nacti('-cas', null),
    jmeno: jmenoUlozene(), kat: nacti('-kat', ''), stojan: nacti('-stojan', 0), stan: nacti('-stan', ''), disc: nacti('-disc', ''), rezim: 'zapis', odesila: false, nacita: false, chyba: '', neplatny: false,
    dialog: null, hr: { jmeno: jmenoUlozene(), shoda: {}, chyba: '', odesila: false }
  };
  const ulozitVse = () => { uloz('-data', st.data); uloz('-fronta', st.fronta); uloz('-hlaseni', st.hlaseni.slice(-20)); uloz('-cas', st.posledni); uloz('-kat', st.kat); uloz('-stojan', st.stojan); uloz('-stan', st.stan); uloz('-disc', st.disc); };

  /* ---------- server ---------- */
  function post(telo) {
    if (!API) return Promise.reject(new Error('Chybí adresa serveru (config.js).'));
    const ac = window.AbortController ? new AbortController() : null, t = ac && setTimeout(() => ac.abort(), 25000);
    return fetch(API, Object.assign({ method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(telo) }, ac ? { signal: ac.signal } : {}))
      .then(r => r.json()).then(j => {
        clearTimeout(t);
        if (!j || (j.ok && !j.soutez)) throw new Error('výpadek'); // Google občas doručí POST jako GET → „ping“
        return j;
      }, e => { clearTimeout(t); throw e; });
  }
  function prevzit(j) {
    st.data = { role: j.role, soutez: j.soutez, druzstva: j.druzstva || [], vysledky: j.vysledky || [] };
    st.posledni = new Date().toISOString(); st.chyba = ''; st.neplatny = false;
    if (!st.kat || !st.data.soutez.kategorie.concat(st.data.druzstva.map(d => d.kat)).includes(st.kat)) st.kat = (st.data.soutez.kategorie[0] || '');
    if (st.stojan > stojanu()) st.stojan = 0;
    const dis = st.data.soutez.discipliny || []; if (dis.length && !dis.some(x => x.d === st.disc)) st.disc = dis[0].d;
    ulozitVse();
  }
  function nacistData() {
    if (!kod || st.nacita || st.odesila) return Promise.resolve();
    st.nacita = true;
    return post({ akce: 'zavod', krok: 'data', kod: kod }).then(j => {
      if (j.ok) prevzit(j);
      else { st.chyba = j.chyba || 'Soutěž se nepodařilo načíst.'; st.neplatny = !!j.neplatny; }
    }).catch(() => {}).then(() => { st.nacita = false; render(); });
  }
  function odeslat() {
    if (!kod || st.odesila || !st.fronta.length || navigator.onLine === false) { render(); return; }
    st.odesila = true; renderStav();
    const davka = st.fronta.slice(0, 50);
    let dalsi = false;
    post({ akce: 'zavod', krok: 'zapis', kod: kod, zapisy: davka }).then(j => {
      if (!j.ok) { st.chyba = j.chyba || 'Zápis se nepodařilo uložit.'; st.neplatny = !!j.neplatny; return; }
      const prijato = j.prijato || [], chyby = j.chyby || [], kdy = new Date().toISOString();
      const odmitnute = chyby.filter(c => !c.info).map(c => c.klic);
      st.fronta = st.fronta.filter(z => prijato.indexOf(z.klic) < 0 && odmitnute.indexOf(z.klic) < 0);
      chyby.forEach(c => st.hlaseni.push({ kdy: kdy, text: c.chyba, info: !!c.info }));
      prevzit(j);
      dalsi = st.fronta.length > 0 && prijato.length > 0;
    }).catch(() => {}).then(() => { st.odesila = false; ulozitVse(); render(); if (dalsi) setTimeout(odeslat, 300); });
  }

  /* ---------- výsledky v telefonu = server + čekající zápisy (novější přepíše) ---------- */
  function vysledky() {
    if (jeZhvb()) return vysledkyZhvb();
    const m = {};
    const pl = jePlamen(), kl = x => x.prihlaska + '|' + (pl ? x.disciplina + '|' : '') + x.pokus; // Plamen: výsledek = družstvo + disciplína + pokus
    (st.data ? st.data.vysledky : []).forEach(v => { m[kl(v)] = v; });
    st.fronta.forEach(z => {
      /* uzlová štafeta: výsledný čas a NP podle limitu / uzlů spočítá stejně jako server (souteze.js) */
      const d = jeUzlovka() ? (st.data.druzstva || []).find(x => x.id === z.prihlaska) : null, u = d ? P.uzlovka(d.kat, z.casL, z.uzly, z.pomoc, z.starty) : null;
      const plat = u && z.platnost === 'platný' && u.np ? 'NP' : z.platnost;
      const lp = !pl || z.disciplina === 'požární útok';
      m[kl(z)] = { prihlaska: z.prihlaska, pokus: z.pokus, disciplina: z.disciplina, casL: z.casL, casP: z.casP, platnost: plat, poznamka: z.poznamka, ceka: true,
        cas: plat !== 'platný' ? null : u ? u.vysledny : lp ? Math.max(z.casL, z.casP) : Math.round(((z.casL || 0) + (z.trestne || 0)) * 100) / 100, trestne: u ? u.trestne : z.trestne || 0, rozpis: u ? { uzly: u.uzly, pomoc: u.pomoc, starty: u.starty } : null };
    });
    return Object.keys(m).map(k => m[k]);
  }
  /* ZHVB: čekající zápisy jsou jen pole jednoho stanoviště – sloučí se do pole ze serveru, u každého platí novější (jako na serveru) */
  function vysledkyZhvb() {
    const m = {};
    (st.data ? st.data.vysledky : []).forEach(v => { const rz = v.rozpis || {};
      m[v.prihlaska] = Object.assign({}, v, { rozpis: { pole: Object.assign({}, rz.pole || {}), kdy: Object.assign({}, rz.kdy || {}) } }); });
    st.fronta.forEach(z => {
      const x = m[z.prihlaska] = m[z.prihlaska] || { prihlaska: z.prihlaska, pokus: 1, platnost: 'platný', poznamka: '', rozpis: { pole: {}, kdy: {} } };
      const nove = Object.assign({}, z.zhvb || {});
      if (z.platnost) nove.plat = z.platnost;
      if (z.poznamka !== undefined) nove.pozn = z.poznamka;
      Object.keys(nove).forEach(k => { if (x.rozpis.kdy[k] && x.rozpis.kdy[k] > z.zapsano) return; if (nove[k] === null) delete x.rozpis.pole[k]; else x.rozpis.pole[k] = nove[k]; x.rozpis.kdy[k] = z.zapsano; });
      x.ceka = true;
    });
    return Object.keys(m).map(k => m[k]);
  }
  /* uzlová štafeta se stojany: rozhodčí si vybere svůj stojan a vidí frontu podle rozběhů (rozpis z aplikace okresu) */
  const stojanu = () => (st.data && st.data.soutez.stojany || []).length;
  const maRozpis = () => stojanu() > 0 && st.data.druzstva.some(d => (d.rozpis || []).length);
  function htmlStojan(s) {
    const v = vysledky(), polozky = [], bez = [];
    st.data.druzstva.forEach(d => { const rz = (d.rozpis || []).filter(z => z.pokus <= s.pokusy); if (!rz.length) bez.push(d); rz.filter(z => z.stojan === st.stojan).forEach(z => polozky.push({ d: d, z: z })); });
    polozky.sort((a, b) => a.z.rozbeh - b.z.rozbeh);
    const vys = (id, pokus) => v.find(x => x.prihlaska === id && x.pokus === pokus);
    const dalsi = polozky.find(x => !vys(x.d.id, x.z.pokus));
    const radek = (d, pokus, nadpis) => { const x = vys(d.id, pokus);
      return '<button type="button" class="tym" data-tym="' + esc(d.id) + '" data-tym-pokus="' + pokus + '"' + (lzeZapisovat() ? '' : ' disabled') + (dalsi && dalsi.d === d && dalsi.z.pokus === pokus ? ' style="background:var(--color-surface);"' : '') + '><span class="c" style="font-size:17px;">' + esc(nadpis) + '</span><span><span class="n">' + esc(d.druzstvo) +
        ' <span class="p">· ' + esc(String(d.sbor || '').replace(/^SDH\s+/i, '')) + '</span></span><span class="p" style="display:block;">' + esc(d.kat) + ' · ' + pokus + '. pokus' + (x && x.ceka ? ' <span class="ceka" title="čeká na odeslání">●</span>' : '') + '</span></span><span class="r">' +
        (x ? esc(x.platnost === 'platný' ? P.casText(x.cas) : x.platnost) : '–') + '</span></button>'; };
    const h = ['<p class="nizko" style="margin:0 0 8px;">Stojan ' + st.stojan + (s.stojany[st.stojan - 1] ? ' · ' + esc(s.stojany[st.stojan - 1]) : '') + ' – závodníci podle rozběhů. ' + (dalsi ? 'Další na řadě je zvýrazněný (rozběh R' + dalsi.z.rozbeh + ').' : 'Všichni u stojanu mají zápis.') + '</p>'];
    h.push(polozky.length ? '<div>' + polozky.map(x => radek(x.d, x.z.pokus, 'R' + x.z.rozbeh)).join('') + '</div>' : '<p class="prazdne">U tohoto stojanu nikdo není.</p>');
    if (bez.length) h.push('<h3 style="font-size:16px;margin:16px 0 4px;">Bez stojanu (pozdní přihlášky)</h3><p class="nizko" style="margin:0 0 6px;">Zapíše kterýkoli rozhodčí, okres je může rozřadit znovu.</p><div>' +
      bez.map(d => { const v1 = vys(d.id, 1); return radek(d, v1 && s.pokusy === 2 ? 2 : 1, '–'); }).join('') + '</div>');
    return h.join('');
  }
  function jeUzlovka() { return !!(st.data && st.data.soutez && st.data.soutez.druh === 'uzlová štafeta'); }
  function jeZhvb() { return !!(st.data && st.data.soutez && st.data.soutez.druh === 'ZHVB'); }
  function jePlamen() { return !!(st.data && st.data.soutez && st.data.soutez.druh === 'Hra Plamen'); }
  /** Hra Plamen: zvolená disciplína kola { d, pokusy } */
  function plDisc() { const a = jePlamen() ? st.data.soutez.discipliny || [] : []; return a.find(x => x.d === st.disc) || a[0] || null; }
  const STAFETA = d => /štafeta/.test(d || '');
  function druzstva() { return (st.data ? st.data.druzstva : []).map(d => Object.assign({}, d, st.hr.shoda[d.id] ? { shoda: st.hr.shoda[d.id] } : {})); }
  function poradi() { const s = st.data.soutez; return P.poradi({ druh: s.druh, kategorie: s.kategorie, pokusy: s.pokusy, shoda: s.shoda, discipliny: s.discipliny || [] }, druzstva(), vysledky()); }
  const lzeZapisovat = () => st.data && st.data.soutez.stav === 'závod' && !st.neplatny;

  /* ---------- vykreslení ---------- */
  function renderStav() {
    const el = $('z-stav'), t = $('z-stav-text'), n = st.fronta.length, online = navigator.onLine !== false;
    el.classList.toggle('vypadek', !online || n > 0 || !!st.chyba);
    let html;
    if (!kod) html = '<b>Chybí kód v odkazu.</b> Otevřete odkaz pro rozhodčí, který jste dostali od okresu.';
    else if (st.odesila) html = 'Odesílám ' + n + ' ' + zapisu(n) + '…';
    else if (n) html = '<b>Neodesláno: ' + n + ' ' + zapisu(n) + '.</b> ' + (online ? 'Odešlou se za chvíli.' : 'Odešlou se, až bude signál – panel nezavírejte, zápisy zůstanou v telefonu.') +
      (online ? ' <button type="button" class="btn btn-secondary" id="z-odeslat" style="min-height:40px;">Odeslat teď</button>' : '');
    else if (!online) html = '<b>Bez signálu.</b> Zapisovat můžete dál, zápisy se uloží v telefonu.';
    else html = 'Online · vše odesláno' + (st.posledni ? ' · aktualizováno ' + fCas(st.posledni) : '');
    t.innerHTML = html;
    const b = $('z-odeslat'); if (b) b.onclick = () => odeslat();
  }

  function render() {
    renderStav();
    // překreslení (nová data ze serveru) nesmí vzít kurzor z rozepsaného pole
    const ae = document.activeElement, afId = ae && ae.id && /^z-(jmeno|hr-jmeno)$/.test(ae.id) ? ae.id : '', sel = afId ? [ae.selectionStart, ae.selectionEnd] : null;
    const o = $('z-obsah'), d = st.data;
    if (!kod) { o.innerHTML = ''; return; }
    if (!d) {
      $('z-sub').textContent = st.chyba ? '' : 'Načítám soutěž…';
      o.innerHTML = st.chyba ? '<p class="chyba">' + esc(st.chyba) + '</p>' : (navigator.onLine === false ? '<p class="info">Bez signálu a soutěž ještě není v telefonu. Otevřete odkaz jednou se signálem – pak už panel funguje i bez něj.</p>' : '<p class="prazdne">Načítám…</p>');
      return;
    }
    const s = d.soutez, hlavni = d.role === 'hlavni';
    $('z-nazev').textContent = s.nazev;
    $('z-sub').textContent = [fDatum(s.od), s.misto, s.druh === 'ZHVB' || s.druh === 'Hra Plamen' ? s.druh : s.druh + ', ' + (s.pokusy === 2 ? '2 pokusy, platí lepší' : '1 pokus'), hlavni ? 'hlavní rozhodčí' : 'rozhodčí'].filter(Boolean).join(' · ');
    const h = [];
    if (st.chyba) h.push('<p class="chyba">' + esc(st.chyba) + '</p>');
    if (s.stav === 'ověřeno' || s.stav === 'zveřejněno') h.push('<p class="info"><b>Výsledky ověřil ' + esc(s.overil || 'hlavní rozhodčí') + (s.overeno ? ' ' + fDatum(s.overeno) + ' v ' + fCas(s.overeno) : '') + '.</b> Zápis je uzavřený, opravu povolí okres.</p>');
    else if (s.stav !== 'závod') h.push('<p class="info">Soutěž není ve stavu závod – zapisovat zatím nejde.</p>');
    const hl = st.hlaseni.filter(x => !x.skryto);
    if (hl.length) h.push('<div class="info"><b>Hlášení serveru</b><ul style="margin:6px 0 6px 18px;padding:0;">' + hl.slice(-6).map(x => '<li>' + esc(x.text) + '</li>').join('') + '</ul><button type="button" class="btn btn-ghost" id="z-hl-zavrit">Skrýt</button></div>');
    h.push('<div class="field" style="margin:0 0 12px;max-width:360px;"><label for="z-jmeno">Vaše jméno (rozhodčí)</label><input class="input" id="z-jmeno" maxlength="60" autocomplete="name" value="' + esc(st.jmeno) + '"></div>');
    const rezimy = [['zapis', 'Zápis'], ['poradi', 'Pořadí']].concat(hlavni ? [['overeni', 'Ověření']] : []);
    h.push('<div class="seg2" role="group" aria-label="Zobrazení">' + rezimy.map(r => '<button type="button" data-rezim="' + r[0] + '" aria-pressed="' + (st.rezim === r[0]) + '">' + r[1] + '</button>').join('') + '</div>');
    const por = poradi(), poStojanu = st.rezim === 'zapis' && maRozpis() && st.stojan > 0;
    if (st.rezim === 'zapis' && jeZhvb()) {
      h.push('<div class="seg2" role="group" aria-label="Způsob zápisu"><button type="button" data-stan="" aria-pressed="' + !st.stan + '">Přepis karty</button><button type="button" data-stan="start" aria-pressed="' + !!st.stan + '">Zápis na stanovišti (nepovinné)</button></div>');
      if (st.stan) h.push('<div class="seg2" role="group" aria-label="Vaše stanoviště">' + stanovisteZhvb().map(x => '<button type="button" data-stan="' + x[0] + '" aria-pressed="' + (st.stan === x[0]) + '">' + x[1] + '</button>').join('') + '</div>');
    }
    if (st.rezim !== 'overeni' && jePlamen() && (s.discipliny || []).length) h.push('<div class="seg2" role="group" aria-label="Disciplína">' + s.discipliny.map(x => '<button type="button" data-disc="' + esc(x.d) + '" aria-pressed="' + (plDisc().d === x.d) + '">' + esc(P.PLAMEN_ZKR[x.d]) + '</button>').join('') + '</div>');
    if (st.rezim === 'zapis' && maRozpis()) h.push('<div class="seg2" role="group" aria-label="Váš stojan"><button type="button" data-stojan="0" aria-pressed="' + (!st.stojan) + '">Podle kategorií</button>' +
      s.stojany.map((n, i) => '<button type="button" data-stojan="' + (i + 1) + '" aria-pressed="' + (st.stojan === i + 1) + '">Stojan ' + (i + 1) + '</button>').join('') + '</div>');
    if (st.rezim !== 'overeni' && !poStojanu) {
      const kats = por.map(c => c.kat);
      h.push('<div class="seg2" role="group" aria-label="Kategorie">' + kats.map(k => '<button type="button" data-kat="' + esc(k) + '" aria-pressed="' + (st.kat === k) + '">' + esc(k) + ' (' + por.find(c => c.kat === k).rows.length + ')</button>').join('') + '</div>');
    }
    const c = por.find(x => x.kat === st.kat) || por[0];
    if (poStojanu) h.push(htmlStojan(s));
    else if (st.rezim === 'zapis') h.push(jeZhvb() ? htmlZapisZhvb(c, s) : jePlamen() ? htmlZapisPlamen(c, s) : htmlZapis(c, s));
    else if (st.rezim === 'poradi') h.push(jePlamen() ? htmlPoradiPlamen(c, s) : htmlPoradi(c, s));
    else h.push(htmlOvereni(por, s));
    o.innerHTML = h.join('');
    // události
    const j = $('z-jmeno'); if (j) j.oninput = e => { st.jmeno = e.target.value.slice(0, 60); try { localStorage.setItem('oshpz-zavod-jmeno', st.jmeno); } catch (x) {} };
    o.querySelectorAll('[data-rezim]').forEach(b => { b.onclick = () => { st.rezim = b.dataset.rezim; render(); }; });
    o.querySelectorAll('[data-stan]').forEach(b => { b.onclick = () => { st.stan = b.dataset.stan; uloz('-stan', st.stan); render(); }; });
    o.querySelectorAll('[data-disc]').forEach(b => { b.onclick = () => { st.disc = b.dataset.disc; uloz('-disc', st.disc); render(); }; });
    o.querySelectorAll('[data-kat]').forEach(b => { b.onclick = () => { st.kat = b.dataset.kat; uloz('-kat', st.kat); render(); }; });
    o.querySelectorAll('[data-tym]').forEach(b => { b.onclick = () => otevritZapis(b.dataset.tym, Number(b.dataset.tymPokus) || 0); });
    o.querySelectorAll('[data-stojan]').forEach(b => { b.onclick = () => {
      st.stojan = Number(b.dataset.stojan) || 0; uloz('-stojan', st.stojan);
      const rozh = st.stojan ? (st.data.soutez.stojany || [])[st.stojan - 1] : ''; // jméno rozhodčího u stojanu z nastavení soutěže
      if (rozh && !String(st.jmeno || '').trim()) { st.jmeno = rozh; try { localStorage.setItem('oshpz-zavod-jmeno', st.jmeno); } catch (x) {} }
      render(); }; });
    const hz = $('z-hl-zavrit'); if (hz) hz.onclick = () => { st.hlaseni.forEach(x => { x.skryto = true; }); ulozitVse(); render(); };
    navazatOvereni();
    if (afId && $(afId)) { $(afId).focus(); try { $(afId).setSelectionRange(sel[0], sel[1]); } catch (e) {} }
    if (st.dialog && !st.data.druzstva.some(x => x.id === st.dialog.id)) { st.dialog = null; renderDialog(); } // otevřený zápis se nepřekresluje
  }

  const ceka = (id, pokus) => st.fronta.some(z => z.prihlaska === id && z.pokus === pokus && (!jePlamen() || z.disciplina === plDisc().d));
  function pokusText(v, i, id) {
    const t = !v ? '–' : v.platnost === 'platný' ? P.casText(v.cas) : v.platnost;
    return i + '. ' + t + (ceka(id, i) ? ' <span class="ceka" title="čeká na odeslání">●</span>' : '');
  }
  function htmlZapis(c, s, napoveda) {
    if (!c || !c.rows.length) return '<p class="prazdne">V kategorii nejsou žádná družstva.</p>';
    const rows = c.rows.slice().sort((a, b) => (a.start || 999) - (b.start || 999) || String(a.druzstvo).localeCompare(b.druzstvo, 'cs'));
    return '<p class="nizko" style="margin:0 0 6px;">' + (napoveda || 'Klepněte na družstvo a zapište časy z terčů.') + ' Startovní pořadí, ● = čeká na odeslání.</p><div>' + rows.map(r =>
      '<button type="button" class="tym" data-tym="' + esc(r.id) + '"' + (lzeZapisovat() ? '' : ' disabled') + '><span class="c">' + (r.start || '') + '</span><span><span class="n">' + esc(r.druzstvo) + (/jednotliv/i.test(c.kat) && r.sbor ? ' <span class="p">· ' + esc(String(r.sbor).replace(/^SDH\s+/i, '')) + '</span>' : '') + '</span><span class="p" style="display:block;">' +
      r.pokusy.map((v, i) => pokusText(v, i + 1, r.id)).join(' · ') + '</span></span><span class="r">' + esc(r.vysledek) + '</span></button>').join('') + '</div>';
  }
  /* ---------- Hra Plamen ---------- */
  function htmlZapisPlamen(c, s) {
    const x = plDisc(), cd = c && x && (c.discipliny || []).find(y => y.d === x.d);
    if (!cd) return '<p class="prazdne">Kolo nemá disciplíny – okres je doplní v aplikaci (Upravit soutěž).</p>';
    const hz = htmlHarmonogram(c, x);
    if (hz) return '<h2 style="font-size:19px;margin:4px 0 6px;">' + esc(x.d) + '</h2>' + hz;
    return '<h2 style="font-size:19px;margin:4px 0 6px;">' + esc(x.d) + '</h2>' + htmlZapis({ kat: c.kat, rows: cd.rows }, s, x.d === 'požární útok' ? 'Klepněte na družstvo a zapište časy z terčů L a P.' :
      x.d === 'štafeta 4 × 60 m' ? 'Klepněte na družstvo a zapište čas štafety (' + (x.pokusy === 2 ? '2 štafety, platí lepší' : '1 štafeta') + ').' : 'Klepněte na družstvo a zapište čas a trestné sekundy.');
  }
  /** Harmonogram kola (vylosovaný v aplikaci): fronta disciplíny v kategorii podle času, posun podle skutečnosti (souteze.js harmOdhad). */
  function harmPanel() {
    const h = st.data.soutez.harmonogram; if (!h || !h.rozpis || !h.rozpis.length) return null;
    const n = new Date(), dnes = fDatum(st.data.soutez.od) === fDatum(n.toISOString());
    return P.harmOdhad(h, h.nast, vysledky(), dnes ? n.getHours() * 60 + n.getMinutes() : null);
  }
  function htmlHarmonogram(c, x) {
    const ho = harmPanel(); if (!ho) return '';
    const pol = ho.polozky.filter(e => e.d === x.d && e.kat === c.kat).sort((a, b) => a.t - b.t || a.dr - b.dr);
    if (!pol.length) return '';
    const dz = {}; st.data.druzstva.forEach(d => { dz[d.id] = d; });
    const v = vysledky(), vys = (id, p) => v.find(y => y.prihlaska === id && y.disciplina === x.d && y.pokus === p);
    const dalsi = pol.find(e => !e.hotovo), zp = ho.zpozdeni[x.d] || 0, slovo = STAFETA(x.d) ? 'štafeta' : 'pokus';
    const bez = c.discipliny.find(y => y.d === x.d).rows.filter(r => !pol.some(e => e.id === r.id));
    return '<p class="nizko" style="margin:0 0 6px;">Podle harmonogramu' + (zp ? ' – <b class="ceka">zpoždění +' + zp + ' min</b>, časy jsou posunuté' : ', zatím bez zpoždění') + '. Další na řadě je zvýrazněný, ● = čeká na odeslání.</p><div>' +
      pol.map(e => { const d = dz[e.id] || { druzstvo: '?' }, pp = e.p || 1, q = vys(e.id, pp), q2 = e.p === 0 && x.pokusy === 2 ? vys(e.id, 2) : null;
        const txt = q => !q ? '–' : q.platnost === 'platný' ? P.casText(q.cas) : q.platnost;
        return '<button type="button" class="tym" data-tym="' + esc(e.id) + '" data-tym-pokus="' + pp + '"' + (lzeZapisovat() ? '' : ' disabled') + (dalsi === e ? ' style="background:var(--color-surface);"' : '') + '>' +
          '<span class="c" style="font-size:17px;">' + P.hodMin(e.odhad) + (e.odhad !== e.t ? '<span class="p" style="display:block;font-size:12px;font-weight:400;">plán ' + P.hodMin(e.t) + '</span>' : '') + '</span>' +
          '<span><span class="n">' + esc(d.druzstvo) + '</span><span class="p" style="display:block;">dráha ' + e.dr + ' · ' + (e.p ? e.p + '. ' + slovo : x.pokusy === 2 ? 'obě ' + (slovo === 'štafeta' ? 'štafety' : 'pokusy') : slovo) +
          (q || q2 ? ' · ' + txt(q) + (q2 ? ' / ' + txt(q2) : '') : '') + (ceka(e.id, pp) ? ' <span class="ceka" title="čeká na odeslání">●</span>' : '') + '</span></span>' +
          '<span class="r" style="font-size:14px;">' + (e.hotovo ? 'hotovo' : '') + '</span></button>'; }).join('') + '</div>' +
      (bez.length ? '<h3 style="font-size:16px;margin:16px 0 4px;">Bez harmonogramu (pozdní přihlášky)</h3>' + htmlZapis({ kat: c.kat, rows: bez }, null, 'Okres je může zařadit novým losem.') : '');
  }
  function htmlPoradiPlamen(c, s) {
    if (!c || !c.rows.length) return '<p class="prazdne">V kategorii nejsou žádná družstva.</p>';
    const x = plDisc(), cd = x && (c.discipliny || []).find(y => y.d === x.d);
    const pz = (q, d) => !q ? '–' : q.platnost !== 'platný' ? q.platnost : P.casText(q.cas) + (d === 'požární útok' ? ' (L ' + P.casText(q.casL) + ' / P ' + P.casText(q.casP) + ')' : q.trestne ? ' (' + P.casText(q.casL) + ' + ' + q.trestne + ' s)' : '');
    return '<h2 style="font-size:19px;margin:4px 0 6px;">Celkové pořadí kola</h2><table class="por"><thead><tr><th>Místo</th><th>Družstvo</th><th>Disciplíny</th><th>Body</th></tr></thead><tbody>' + c.rows.map(r =>
      '<tr><td class="m">' + (r.poradi ? r.poradi + '.' : '') + '</td><td><b>' + esc(r.druzstvo) + '</b>' + (r.shoda ? '<div class="nizko">shoda bodů – rozhodlo umístění v disciplínách</div>' : '') + '</td><td class="nizko">' + esc(r.detail) + '</td><td><b>' + esc(r.stav === 'rozpracováno' ? '…' : r.vysledek) + '</b></td></tr>').join('') +
      '</tbody></table><p class="nizko">Body = součet umístění v disciplínách (nižší vyhrává), při shodě rozhoduje lepší umístění v pořadí PÚ, 4 × 60 m, PÚ CTIF, štafeta CTIF, dvojice. Hodnoceno jen družstvo, které absolvovalo všechny disciplíny.</p>' +
      (cd ? '<h2 style="font-size:19px;margin:16px 0 6px;">' + esc(x.d) + '</h2><table class="por"><thead><tr><th>Místo</th><th>Družstvo</th><th>' + (STAFETA(x.d) ? 'Štafety' : 'Pokusy') + '</th><th>Výsledek</th></tr></thead><tbody>' + cd.rows.map(r =>
        '<tr><td class="m">' + (r.poradi ? r.poradi + '.' : '') + '</td><td><b>' + esc(r.druzstvo) + '</b></td><td class="nizko">' + r.pokusy.map((q, i) => (i + 1) + '. ' + esc(pz(q, x.d))).join('<br>') + '</td><td><b>' + esc(r.vysledek) + '</b></td></tr>').join('') +
        '</tbody></table><p class="nizko">Platí lepší ' + (STAFETA(x.d) ? 'štafeta' : 'pokus') + '. Shoda: součet obou (NP 998 s, nenastoupil 999 s), pak trestné sekundy u lepšího času.</p>' : '');
  }
  /* ---------- ZHVB ---------- */
  function stanovisteZhvb() {
    const k8 = (st.data.soutez.kategorie || []).concat(st.data.druzstva.map(d => d.kat)).some(k => P.zhvb(k, {}).stanoviste.indexOf('K8') >= 0);
    return [['start', 'Start'], ['cil', 'Cíl']].concat(P.ZHVB_STAN.filter(k => k !== 'K8' || k8).map(k => [k, k]));
  }
  const ZHVB_NAZVY = { K1: 'hod na cíl / střelba', K2: 'orientace v přírodě', K3: 'uzlování', K4: 'brannost', K5: 'požární ochrana', K6: 'první pomoc', K7: 'ochrana obyvatelstva', K8: 'orientace v terénu' };
  function poleZhvb(id) { const x = vysledky().find(y => y.prihlaska === id); return x && x.rozpis ? x.rozpis.pole : {}; }
  function hodnotaZhvb(p, k) {
    if (k === 'start' || k === 'cil') return p[k] != null ? P.hms(p[k]) : '';
    return p[k] != null ? (k === 'K8' ? (p[k] >= 3 ? '3 razítka chybí' : p[k] * 5 + ' b.') : p[k] + ' b.') + (p['c' + k.slice(1)] ? ' · čekání ' + P.ms(p['c' + k.slice(1)]) : '') : '';
  }
  function htmlZapisZhvb(c, s) {
    if (!c || !c.rows.length) return '<p class="prazdne">V kategorii nejsou žádné hlídky.</p>';
    const k = st.stan, maK8 = P.zhvb(c.kat, {}).stanoviste.indexOf('K8') >= 0;
    if (k === 'K8' && !maK8) return '<p class="prazdne">Na K8 (orientace v terénu) běží jen dorost – vyberte kategorii dorostu.</p>';
    const rows = c.rows.slice().sort((a, b) => (a.start || 999) - (b.start || 999) || String(a.druzstvo).localeCompare(b.druzstvo, 'cs'));
    const napoveda = k === 'start' ? 'Start: klepněte na hlídku a zapište čas startu (tlačítko Teď).' : k === 'cil' ? 'Cíl: klepněte na hlídku, až proběhne cílem poslední člen, a stiskněte Teď.'
      : k ? k + ' – ' + ZHVB_NAZVY[k] + ': zapište trestné body a čekací čas hlídky na stanovišti.' : 'Přepis startovní karty: po doběhnutí klepněte na hlídku a opište čas startu, čas v cíli a u každého stanoviště trestné body a čekací čas. Aplikace spočítá čas trati, čekání, body a výsledný čas – porovnejte je s kartou.';
    return '<p class="nizko" style="margin:0 0 6px;">' + esc(napoveda) + ' Startovní pořadí, ● = čeká na odeslání.</p><div>' + rows.map(r => {
      const p = poleZhvb(r.id), ceka = st.fronta.some(z => z.prihlaska === r.id), hod = k ? hodnotaZhvb(p, k) : '';
      const sub = k ? (hod || 'nezapsáno') : r.stav === 'platný' ? r.detail : r.stav === 'rozpracováno' ? 'chybí ' + r.chybi.join(', ') : r.stav === 'bez výsledku' ? 'bez zápisu' : r.stav + (r.pokusy[0] && r.pokusy[0].poznamka ? ' – ' + r.pokusy[0].poznamka : '');
      const vpravo = k ? (hod ? hod.split(' · ')[0] : '–') : r.stav === 'rozpracováno' ? '…' : r.vysledek;
      return '<button type="button" class="tym" data-tym="' + esc(r.id) + '"' + (lzeZapisovat() ? '' : ' disabled') + '><span class="c">' + (r.start || '') + '</span><span><span class="n">' + esc(r.druzstvo) + '</span><span class="p" style="display:block;">' +
        esc(sub) + (ceka ? ' <span class="ceka" title="čeká na odeslání">●</span>' : '') + '</span></span><span class="r">' + esc(vpravo) + '</span></button>'; }).join('') + '</div>';
  }
  function htmlPoradi(c, s) {
    if (!c || !c.rows.length) return '<p class="prazdne">V kategorii nejsou žádná družstva.</p>';
    if (jeZhvb()) return '<table class="por"><thead><tr><th>Místo</th><th>Hlídka</th><th>Rozpis</th><th>Výsledek</th></tr></thead><tbody>' + c.rows.map(r => { const pz = r.pokusy[0] && r.pokusy[0].poznamka;
      return '<tr><td class="m">' + (r.poradi ? r.poradi + '.' : '') + '</td><td><b>' + esc(r.druzstvo) + '</b>' + (r.shoda ? '<div class="nizko">shoda výsledného času</div>' : '') + '</td><td class="nizko">' +
        esc(r.stav === 'rozpracováno' ? 'chybí ' + r.chybi.join(', ') : r.detail) + (pz && r.stav !== 'platný' ? (r.detail ? '<br>' : '') + esc(pz) : '') + '</td><td><b>' + esc(r.stav === 'rozpracováno' ? '…' : r.vysledek) + '</b></td></tr>'; }).join('') +
      '</tbody></table><p class="nizko">Výsledný čas = čas na trati − čekací čas + trestné body (1 bod = 1 minuta). Při shodě rozhoduje nižší počet trestných bodů, pak body na stanovištích K5, K7, K6, K4, K3, K2, K1. Neplatný výsledek je bez pořadí.</p>';
    return '<table class="por"><thead><tr><th>Místo</th><th>' + (/jednotliv/i.test(c.kat) ? 'Závodník' : 'Družstvo') + '</th><th>Pokusy</th><th>Výsledek</th></tr></thead><tbody>' + c.rows.map(r =>
      '<tr><td class="m">' + (r.poradi ? r.poradi + '.' : '') + '</td><td><b>' + esc(r.druzstvo) + '</b>' + (/jednotliv/i.test(c.kat) && r.sbor ? '<div class="nizko">' + esc(String(r.sbor).replace(/^SDH\s+/i, '')) + '</div>' : '') + (r.shoda ? '<div class="nizko">shoda času' + (r.nerozhodnuto ? ' – pořadí určí hlavní rozhodčí' : '') + '</div>' : '') + '</td><td class="nizko">' +
      r.pokusy.map((v, i) => pokusText(v, i + 1, r.id) + (v && v.platnost === 'platný' ? (jeUzlovka() ? (v.trestne ? ' (' + P.casText(v.casL) + ' + ' + v.trestne + ' s)' : '') : ' (L ' + P.casText(v.casL) + ' / P ' + P.casText(v.casP) + ')') : '')).join('<br>') + '</td><td><b>' + esc(r.vysledek) + '</b></td></tr>').join('') +
      '</tbody></table><p class="nizko">' + (s.shoda === 'rozhoduje pořadatel' ? 'Shoda času: pořadí určí hlavní rozhodčí.' : s.shoda === 'horší pokus' ? 'Shoda času: rozhoduje čas horšího pokusu, pak dělené místo.' : 'Shoda času: rozhoduje součet obou pokusů (pravidla SH ČMS), pak dělené místo.') + ' NP je vždy za platnými pokusy.</p>';
  }
  function htmlOvereni(por, s) {
    const chybi = [], shody = [];
    por.forEach(c => {
      c.rows.forEach(r => { if (r.stav === 'rozpracováno') chybi.push(c.kat + ' – ' + r.druzstvo + ' (' + r.chybi.join(', ') + ')');
        else if (r.stav !== 'DIS') { const bez = r.pokusy.map((p, i) => p ? 0 : i + 1).filter(Boolean); if (bez.length) chybi.push(c.kat + ' – ' + r.druzstvo + (jeZhvb() ? ' (bez zápisu)' : ' (' + bez.join('. a ') + '. pokus)')); } });
      if (s.shoda === 'rozhoduje pořadatel') {
        const skup = {};
        c.rows.filter(r => r.shoda).forEach(r => { (skup[r.nejlepsi] = skup[r.nejlepsi] || []).push(r); });
        Object.keys(skup).forEach(k => shody.push({ kat: c.kat, cas: Number(k), rows: skup[k] }));
      }
    });
    const n = st.fronta.length, overeno = s.stav !== 'závod';
    const h = ['<div class="karta"><h2>Ověření výsledků</h2>'];
    if (overeno) { h.push('<p style="margin:0;">Výsledky jsou ověřené. Okres je zkontroluje a zveřejní na webu.</p></div>'); return h.join(''); }
    h.push('<p style="margin:0 0 8px;">Za soutěž odpovídáte vy. Po ověření už rozhodčí nic nezapíší a okres dostane e-mail, že může výsledky zveřejnit.</p>');
    h.push(chybi.length ? '<p class="chyba">Chybí výsledky (' + chybi.length + '): ' + esc(chybi.slice(0, 10).join('; ')) + (chybi.length > 10 ? ' a další' : '') + '. Nenastoupené družstvo označte „Nenastoupil“.</p>' : '<p class="info">Všechna družstva mají všechny pokusy.</p>');
    if (n) h.push('<p class="chyba">V telefonu čeká ' + n + ' ' + zapisu(n) + ' na odeslání – nejdřív je odešlete (potřebujete signál).</p>');
    if (shody.length) {
      h.push('<h3 style="font-size:16px;margin:12px 0 4px;">Shoda času – určete pořadí</h3>');
      shody.forEach(g => h.push('<div class="info"><b>' + esc(g.kat) + ' · ' + P.casText(g.cas) + ' s</b>' + g.rows.map(r =>
        '<div style="display:flex;gap:10px;align-items:center;margin-top:6px;"><select class="input" style="width:auto;min-height:44px;" data-shoda="' + esc(r.id) + '">' +
        '<option value="">–</option>' + g.rows.map((x, i) => '<option value="' + (i + 1) + '"' + (Number(st.hr.shoda[r.id] || r.shodaRucne) === i + 1 ? ' selected' : '') + '>' + (i + 1) + '.</option>').join('') +
        '</select><span>' + esc(r.druzstvo) + '</span></div>').join('') + '</div>'));
    }
    h.push('<div class="field" style="margin:12px 0;max-width:360px;"><label for="z-hr-jmeno">Hlavní rozhodčí – jméno a příjmení</label><input class="input" id="z-hr-jmeno" maxlength="80" autocomplete="name" value="' + esc(st.hr.jmeno || s.hlavniRozhodci) + '"></div>');
    if (st.hr.chyba) h.push('<p class="chyba">' + esc(st.hr.chyba) + '</p>');
    h.push('<button type="button" class="btn btn-primary" id="z-overit"' + (chybi.length || n || st.hr.odesila || navigator.onLine === false ? ' disabled' : '') + '>' + (st.hr.odesila ? 'Ověřuji…' : 'Ověřit výsledky') + '</button></div>');
    return h.join('');
  }
  function navazatOvereni() {
    document.querySelectorAll('[data-shoda]').forEach(sel => { sel.onchange = () => { st.hr.shoda[sel.dataset.shoda] = Number(sel.value) || null; render(); }; });
    const j = $('z-hr-jmeno'); if (j) j.oninput = e => { st.hr.jmeno = e.target.value; };
    const b = $('z-overit'); if (!b) return;
    b.onclick = () => {
      const jmeno = String(st.hr.jmeno || (st.data.soutez.hlavniRozhodci || '')).trim();
      if (jmeno.length < 3) { st.hr.chyba = 'Napište své jméno a příjmení.'; render(); return; }
      st.hr.odesila = true; st.hr.chyba = ''; render();
      const shoda = {}; Object.keys(st.hr.shoda).forEach(k => { if (st.hr.shoda[k]) shoda[k] = st.hr.shoda[k]; });
      post({ akce: 'zavod', krok: 'overit', kod: kod, jmeno: jmeno, shoda: shoda }).then(x => {
        if (x.ok) { prevzit(x); st.hr.chyba = ''; } else st.hr.chyba = x.chyba || 'Ověření se nepodařilo.';
      }).catch(() => { st.hr.chyba = 'Server neodpovídá. Zkuste to znovu, až bude signál.'; }).then(() => { st.hr.odesila = false; render(); });
    };
  }

  /* ---------- zápis pokusu ---------- */
  function otevritZapis(id, pokusPevny) {
    if (!lzeZapisovat()) return;
    if (st.dialog) return;
    if (jeZhvb()) {
      const dz = st.data.druzstva.find(x => x.id === id);
      if (!dz || (st.stan === 'K8' && P.zhvb(dz.kat, {}).stanoviste.indexOf('K8') < 0)) return;
      st.dialog = { id: id, pokus: 1, zhvb: true, karta: !st.stan, chyba: '' };
      if (st.dialog.karta) predvyplnitKarta(st.dialog); else predvyplnitZhvb(st.dialog);
      renderDialog();
      setTimeout(() => { const i = st.stan ? $('z-f-' + st.stan) : $('z-dialog').querySelector('[data-pole="start"]'); if (i) i.focus(); }, 50);
      return;
    }
    const ds = plDisc(), v = vysledky().filter(x => x.prihlaska === id && (!ds || x.disciplina === ds.d)), pokusy = ds ? ds.pokusy : st.data.soutez.pokusy;
    let pokus = 1; while (pokus < pokusy && v.some(x => x.pokus === pokus)) pokus++;
    if (pokusPevny >= 1 && pokusPevny <= pokusy) pokus = pokusPevny; // fronta stojanu: pokus podle rozpisu
    st.dialog = { id: id, pokus: pokus, disciplina: ds ? ds.d : '', L: '', P: '', tb: 0, poznamka: '', chyba: '' };
    predvyplnit(); renderDialog();
    setTimeout(() => { const i = $('z-L'); if (i) i.focus(); }, 50);
  }
  function predvyplnit() {
    const dl = st.dialog, v = vysledky().find(x => x.prihlaska === dl.id && x.pokus === dl.pokus && (!dl.disciplina || x.disciplina === dl.disciplina));
    dl.puvodni = v || null; dl.tb = v && v.trestne || 0;
    dl.L = v && v.casL != null ? P.casText(v.casL) : ''; dl.P = v && v.casP != null ? P.casText(v.casP) : ''; dl.poznamka = v ? v.poznamka || '' : '';
    const rz = v && v.rozpis || {}; dl.uzly = rz.uzly || 0; dl.pomoc = rz.pomoc || 0; dl.starty = rz.starty || 0;
  }
  function renderDialog() {
    const box = $('z-dialog'), dl = st.dialog;
    if (!dl || !st.data) { box.innerHTML = ''; return; }
    const d = st.data.druzstva.find(x => x.id === dl.id);
    if (!d) { st.dialog = null; box.innerHTML = ''; return; }
    if (dl.zhvb) return dl.karta ? renderKarta(box, dl, d) : renderDialogZhvb(box, dl, d);
    const ds = dl.disciplina ? plDisc() : null, pokusy = ds ? ds.pokusy : st.data.soutez.pokusy, pv = dl.puvodni, uz = jeUzlovka(), u0 = P.uzlovka(d.kat, 0, 0, 0, 0);
    const jeden = !!ds && ds.d !== 'požární útok', sTb = !!ds && jeden && ds.d !== 'štafeta 4 × 60 m', slovo = ds && STAFETA(ds.d) ? 'štafeta' : 'pokus'; // Plamen: jeden čas (+ trestné sekundy)
    box.innerHTML = '<div class="dialog-pozadi" id="z-pozadi"><div class="zapis" role="dialog" aria-modal="true" aria-labelledby="z-d-nadpis">' +
      '<div class="mala">' + esc(d.kat) + (d.start ? ' · start ' + d.start : '') + (ds ? ' · ' + esc(ds.d) : '') + '</div><h2 id="z-d-nadpis">' + esc(d.druzstvo) + '</h2>' +
      (pokusy === 2 ? '<div class="seg2" role="group" aria-label="' + (slovo === 'štafeta' ? 'Štafeta' : 'Pokus') + '" style="margin:8px 0 0;">' + [1, 2].map(i => '<button type="button" data-pokus="' + i + '" aria-pressed="' + (dl.pokus === i) + '">' + i + '. ' + (slovo === 'štafeta' ? 'štafeta' : 'pokus') + '</button>').join('') + '</div>' : '') +
      (pv ? '<p class="info" style="margin:8px 0 0;">Pokus už má zápis: <b>' + esc(pv.platnost === 'platný' ? P.casText(pv.cas) + ' s' : pv.platnost) + '</b>. Uložením ho přepíšete.</p>' : '') +
      (uz ? '<div class="casy jeden"><div><label for="z-L">Naměřený čas (s)</label><input id="z-L" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' + esc(dl.L) + '"></div></div>' +
        [['uzly', 'Chybně uvázané uzly', '+30 s za každý'], ['pomoc', 'Pomoc (i slovní)', '+30 s za každou']].concat(u0.druzstva ? [['starty', 'Předčasné starty', '+10 s za každý']] : []).map(x =>
          '<div class="pocet"><span><b>' + x[1] + '</b><span class="nizko" style="display:block;">' + x[2] + '</span></span>' +
          '<button type="button" class="btn btn-secondary" data-pocet="' + x[0] + '" data-o="-1" aria-label="' + x[1] + ' méně">−</button><output id="z-n-' + x[0] + '">' + dl[x[0]] + '</output>' +
          '<button type="button" class="btn btn-secondary" data-pocet="' + x[0] + '" data-o="1" aria-label="' + x[1] + ' více">+</button></div>').join('')
      : jeden ? '<div class="casy jeden"><div><label for="z-L">Čas ' + (slovo === 'štafeta' ? 'štafety' : 'pokusu') + ' (s)</label><input id="z-L" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' + esc(dl.L) + '"></div></div>' +
        (sTb ? '<div class="pocet"><span><b>Trestné sekundy</b><span class="nizko" style="display:block;">' + (ds.d === 'požární útok CTIF' ? 'podle směrnice 5, 10 nebo 20 s za chybu' : '10 s za chybu, proudnice přes cíl 20 s') + '</span></span>' +
          '<button type="button" class="btn btn-secondary" data-tb="-5" aria-label="O 5 s méně">−</button><output id="z-n-tb">' + dl.tb + '</output><button type="button" class="btn btn-secondary" data-tb="5" aria-label="O 5 s víc">+</button></div>' +
          '<div class="tlacitka" style="margin:0 0 8px;"><button type="button" class="btn btn-secondary" data-tb="10">+10 s</button><button type="button" class="btn btn-secondary" data-tb="20">+20 s</button><button type="button" class="btn btn-ghost" data-tb="0">Bez trestných</button></div>' : '')
      : '<div class="casy"><div><label for="z-L">Terč L (s)</label><input id="z-L" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' + esc(dl.L) + '"></div>' +
      '<div><label for="z-P">Terč P (s)</label><input id="z-P" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' + esc(dl.P) + '"></div></div>') +
      '<p class="vysl" id="z-vysl"></p>' +
      '<div class="field" style="margin:0 0 8px;"><label for="z-pozn">Poznámka (nepovinné, např. důvod NP)</label><input class="input" id="z-pozn" maxlength="300" value="' + esc(dl.poznamka) + '"></div>' +
      (dl.chyba ? '<p class="chyba">' + esc(dl.chyba) + '</p>' : '') +
      '<div class="tlacitka"><button type="button" class="btn btn-primary" data-ulozit="platný">Uložit čas</button>' +
      '<button type="button" class="btn btn-secondary" data-ulozit="NP">NP – neplatn' + (slovo === 'štafeta' ? 'á štafeta' : 'ý pokus') + '</button></div>' +
      '<div class="tlacitka"><button type="button" class="btn btn-secondary" data-ulozit="nenastoupil">Nenastoupil</button>' +
      '<button type="button" class="btn btn-secondary" data-ulozit="DIS">Diskvalifikace</button>' +
      '<button type="button" class="btn btn-ghost" id="z-zrusit">Zavřít</button></div></div></div>';
    const prepocet = () => {
      if (uz) {
        const L = P.casZTextu(dl.L), el = $('z-vysl'), u = P.uzlovka(d.kat, L, dl.uzly, dl.pomoc, dl.starty);
        el.innerHTML = Number.isNaN(L) ? '<span class="ceka">Čas zapište v sekundách, např. 45,20.</span>' : !(L > 0) ? 'Výsledný čas = naměřený + ' + u.trestne + ' s trestných. Limit ' + u.limit + ' s.'
          : u.np ? '<span class="ceka">Bude NP: ' + esc(u.np) + '.</span>' : 'Výsledný čas: <b>' + P.casText(u.vysledny) + ' s</b>' + (u.trestne ? ' (' + P.casText(L) + ' + ' + u.trestne + ' s)' : '');
        return;
      }
      if (jeden) {
        const L = P.casZTextu(dl.L), el = $('z-vysl');
        el.innerHTML = Number.isNaN(L) ? '<span class="ceka">Čas zapište v sekundách, např. 62,35.</span>' : L > 0 ? 'Výsledek: <b>' + P.casText(L + dl.tb) + ' s</b>' + (dl.tb ? ' (' + P.casText(L) + ' + ' + dl.tb + ' s)' : '') : sTb ? 'Výsledek = čas + trestné sekundy.' : 'Výsledek = čas štafety.';
        return;
      }
      const L = P.casZTextu(dl.L), Pc = P.casZTextu(dl.P), el = $('z-vysl');
      el.innerHTML = L > 0 && Pc > 0 ? 'Výsledný čas pokusu (delší z terčů): <b>' + P.casText(Math.max(L, Pc)) + ' s</b>' : (Number.isNaN(L) || Number.isNaN(Pc)) ? '<span class="ceka">Čas zapište v sekundách, např. 17,84.</span>' : 'Výsledný čas = delší z obou terčů.';
    };
    prepocet();
    $('z-L').oninput = e => { dl.L = e.target.value; prepocet(); };
    if (!uz && !jeden) $('z-P').oninput = e => { dl.P = e.target.value; prepocet(); };
    box.querySelectorAll('[data-tb]').forEach(b => { b.onclick = () => { const o = Number(b.dataset.tb); dl.tb = o === 0 ? 0 : Math.max(0, Math.min(300, dl.tb + o)); $('z-n-tb').textContent = dl.tb; prepocet(); }; });
    box.querySelectorAll('[data-pocet]').forEach(b => { b.onclick = () => {
      const k = b.dataset.pocet, max = k === 'uzly' ? u0.pocetUzlu : k === 'starty' ? 4 : 10;
      dl[k] = Math.max(0, Math.min(max, (dl[k] || 0) + Number(b.dataset.o))); $('z-n-' + k).textContent = dl[k]; prepocet();
    }; });
    $('z-pozn').oninput = e => { dl.poznamka = e.target.value; };
    $('z-zrusit').onclick = () => { st.dialog = null; renderDialog(); };
    $('z-pozadi').onclick = e => { if (e.target.id === 'z-pozadi') { st.dialog = null; renderDialog(); } };
    box.querySelectorAll('[data-pokus]').forEach(b => { b.onclick = () => { dl.pokus = Number(b.dataset.pokus); dl.chyba = ''; predvyplnit(); renderDialog(); }; });
    box.querySelectorAll('[data-ulozit]').forEach(b => { b.onclick = () => ulozitPokus(b.dataset.ulozit); });
  }
  function ulozitPokus(platnost) {
    const dl = st.dialog, jeden = !!dl.disciplina && dl.disciplina !== 'požární útok', uz = jeUzlovka() || jeden, L = P.casZTextu(dl.L), Pc = uz ? null : P.casZTextu(dl.P); // uz = jeden čas
    if (!String(st.jmeno || '').trim()) { dl.chyba = 'Nahoře v panelu vyplňte své jméno (kdo zapisuje).'; renderDialog(); return; }
    if (uz && platnost === 'platný' && !(L > 0)) { dl.chyba = 'Zapište ' + (jeden ? 'čas' : 'naměřený čas') + ' v sekundách (např. 45,20), nebo zvolte NP.'; renderDialog(); return; }
    if (!uz && platnost === 'platný' && !(L > 0 && Pc > 0)) { dl.chyba = 'Zapište oba časy z terčů L a P v sekundách (např. 17,84), nebo zvolte NP.'; renderDialog(); return; }
    if ((L != null && !(L > 0 && L < 1000)) || (Pc != null && !(Pc > 0 && Pc < 1000))) { dl.chyba = 'Čas má být 0,01–999,99 s.'; renderDialog(); return; }
    const z = { klic: novyKlic(), prihlaska: dl.id, pokus: dl.pokus, casL: platnost === 'nenastoupil' ? null : (L > 0 ? L : null), casP: platnost === 'nenastoupil' ? null : (Pc > 0 ? Pc : null),
      platnost: platnost, poznamka: String(dl.poznamka || '').trim().slice(0, 300), rozhodci: String(st.jmeno).trim().slice(0, 60), zapsano: new Date().toISOString() };
    if (jeUzlovka()) Object.assign(z, platnost === 'nenastoupil' ? { uzly: 0, pomoc: 0, starty: 0 } : { uzly: dl.uzly || 0, pomoc: dl.pomoc || 0, starty: dl.starty || 0 });
    if (dl.disciplina) Object.assign(z, { disciplina: dl.disciplina, trestne: platnost === 'platný' && dl.disciplina !== 'štafeta 4 × 60 m' ? dl.tb || 0 : 0 });
    st.fronta = st.fronta.filter(x => !(x.prihlaska === z.prihlaska && x.pokus === z.pokus && (x.disciplina || '') === (z.disciplina || ''))).concat(z);
    st.dialog = null; renderDialog(); ulozitVse(); render();
    odeslat();
  }

  /* ---------- zápis ZHVB: jen pole zvoleného stanoviště (celá hlídka = všechna), odesílají se jen změněná ---------- */
  function predvyplnitZhvb(dl) {
    const p = poleZhvb(dl.id), d = st.data.druzstva.find(x => x.id === dl.id);
    dl.stanoviste = P.zhvb(d.kat, {}).stanoviste; dl.p0 = {}; dl.f = {};
    ['start', 'cil'].forEach(k => { dl.p0[k] = p[k] != null ? p[k] : null; dl.f[k] = p[k] != null ? P.hms(p[k]) : ''; });
    dl.stanoviste.forEach(k => { const c = 'c' + k.slice(1);
      dl.p0[k] = p[k] != null ? p[k] : null; dl.f[k] = p[k] != null ? p[k] : st.stan === k ? 0 : null; // na stanovišti začíná na 0 (rozhodčí hodnotí teď)
      dl.p0[c] = p[c] != null ? p[c] : null; dl.f[c] = p[c] ? P.ms(p[c]) : ''; });
    dl.poznamka0 = p.pozn || ''; dl.poznamka = dl.poznamka0; dl.plat = p.plat || 'platný';
  }
  const tedCas = () => { const d = new Date(); return P.hms(d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds()); };
  function renderDialogZhvb(box, dl, d) {
    const k = st.stan, cela = !k, casy = cela ? ['start', 'cil'] : k === 'start' || k === 'cil' ? [k] : [], kroky = cela ? dl.stanoviste : casy.length ? [] : [k];
    const casPole = x => '<div><label for="z-f-' + x + '">' + (x === 'start' ? 'Start' : 'Cíl') + ' – čas (h:mm:ss)</label><div style="display:flex;gap:8px;">' +
      '<input id="z-f-' + x + '" inputmode="decimal" autocomplete="off" placeholder="9:05:00" value="' + esc(dl.f[x]) + '" style="flex:1;min-width:0;">' +
      '<button type="button" class="btn btn-secondary" data-ted="' + x + '" style="min-height:56px;font-size:17px;">Teď</button></div></div>';
    const krok = x => { const c = 'c' + x.slice(1), v = dl.f[x];
      return '<div class="pocet" style="grid-template-columns:minmax(0,1fr) 52px 48px 52px' + (cela ? ' 72px' : '') + ';"><span><b>' + x + ' ' + esc(ZHVB_NAZVY[x]) + '</b><span class="nizko" style="display:block;">' +
        (x === 'K8' ? 'chybějící razítka (1 = 5 b., 2 = 10 b., 3 = neplatný)' : 'trestné body 0–15') + '</span></span>' +
        '<button type="button" class="btn btn-secondary" data-krok="' + x + '" data-o="-1" aria-label="' + x + ' méně">−</button><output id="z-n-' + x + '">' + (v == null ? '–' : v) + '</output>' +
        '<button type="button" class="btn btn-secondary" data-krok="' + x + '" data-o="1" aria-label="' + x + ' více">+</button>' +
        (cela ? '<input class="input" data-cek="' + c + '" inputmode="decimal" autocomplete="off" aria-label="' + x + ' – čekací čas (min:s)" placeholder="čekání" value="' + esc(dl.f[c]) + '" style="min-height:48px;padding:6px;">' : '') + '</div>' +
        (cela ? '' : '<div class="field" style="margin:8px 0 0;max-width:240px;"><label for="z-f-cek">Čekací čas hlídky na stanovišti (min:s)</label><input class="input" id="z-f-cek" data-cek="' + c + '" inputmode="decimal" autocomplete="off" placeholder="0:00" value="' + esc(dl.f[c]) + '"></div>'); };
    box.innerHTML = '<div class="dialog-pozadi" id="z-pozadi"><div class="zapis" role="dialog" aria-modal="true" aria-labelledby="z-d-nadpis">' +
      '<div class="mala">' + esc(d.kat) + (d.start ? ' · start ' + d.start : '') + ' · ' + esc(cela ? 'celá hlídka' : k === 'start' ? 'start' : k === 'cil' ? 'cíl' : k + ' ' + ZHVB_NAZVY[k]) + '</div><h2 id="z-d-nadpis">' + esc(d.druzstvo) + '</h2>' +
      (dl.plat !== 'platný' ? '<p class="info" style="margin:8px 0 0;">Hlídka má zapsáno: <b>' + esc(dl.plat) + '</b>.</p>' : '') +
      (casy.length ? '<div class="casy jeden">' + casy.map(casPole).join('') + '</div>' : '') + (kroky.length ? '<div style="margin:12px 0;">' + kroky.map(krok).join('') + '</div>' : '') +
      (cela || k === 'cil' ? '<p class="vysl" id="z-vysl"></p>' : '') +
      '<div class="field" style="margin:0 0 8px;"><label for="z-pozn">Poznámka (nepovinné, např. důvod NP)</label><input class="input" id="z-pozn" maxlength="300" value="' + esc(dl.poznamka) + '"></div>' +
      (dl.chyba ? '<p class="chyba">' + esc(dl.chyba) + '</p>' : '') +
      '<div class="tlacitka"><button type="button" class="btn btn-primary" data-ulozit="">Uložit</button>' + (cela ? '<button type="button" class="btn btn-secondary" id="z-nuly">Prázdná stanoviště = 0</button>' : '') + '</div>' +
      '<div class="tlacitka"><button type="button" class="btn btn-secondary" data-ulozit="NP">NP – neplatný výsledek</button><button type="button" class="btn btn-secondary" data-ulozit="nenastoupil">Nenastoupil</button>' +
      '<button type="button" class="btn btn-secondary" data-ulozit="DIS">Diskvalifikace</button>' + (dl.plat !== 'platný' ? '<button type="button" class="btn btn-secondary" data-ulozit="zpet">Výsledek platí</button>' : '') +
      '<button type="button" class="btn btn-ghost" id="z-zrusit">Zavřít</button></div></div></div>';
    const nahled = () => {
      const el = $('z-vysl'); if (!el) return;
      const p = Object.assign({}, poleZhvb(dl.id));
      casy.forEach(x => { const v = P.casDneZTextu(dl.f[x]); if (v === null) delete p[x]; else if (!Number.isNaN(v)) p[x] = v; });
      kroky.forEach(x => { const c = 'c' + x.slice(1), cv = P.cekaniZTextu(dl.f[c]); if (dl.f[x] == null) delete p[x]; else p[x] = dl.f[x]; if (cv === null) delete p[c]; else if (!Number.isNaN(cv)) p[c] = cv; });
      const z = P.zhvb(d.kat, p);
      el.innerHTML = z.np ? '<span class="ceka">Bude neplatný výsledek: ' + esc(z.np) + '.</span>' : z.vysledny != null ? 'Výsledný čas: <b>' + P.hms(z.vysledny) + '</b> <span class="nizko">(' + esc(P.zhvbText(z)) + ')</span>'
        : 'Výsledný čas až bude vše zapsané. Chybí: ' + esc(z.chybi.join(', ')) + '.';
    };
    nahled();
    casy.forEach(x => { $('z-f-' + x).oninput = e => { dl.f[x] = e.target.value; nahled(); }; });
    box.querySelectorAll('[data-ted]').forEach(b => { b.onclick = () => { const x = b.dataset.ted; dl.f[x] = tedCas(); $('z-f-' + x).value = dl.f[x]; nahled(); }; });
    box.querySelectorAll('[data-krok]').forEach(b => { b.onclick = () => {
      const x = b.dataset.krok, max = x === 'K8' ? 3 : 15, o = Number(b.dataset.o);
      dl.f[x] = dl.f[x] == null ? (o > 0 ? 1 : 0) : Math.max(0, Math.min(max, dl.f[x] + o)); $('z-n-' + x).textContent = dl.f[x]; nahled(); }; });
    box.querySelectorAll('[data-cek]').forEach(i => { i.oninput = e => { dl.f[i.dataset.cek] = e.target.value; nahled(); }; });
    const nuly = $('z-nuly'); if (nuly) nuly.onclick = () => { dl.stanoviste.forEach(x => { if (dl.f[x] == null) { dl.f[x] = 0; $('z-n-' + x).textContent = 0; } }); nahled(); };
    $('z-pozn').oninput = e => { dl.poznamka = e.target.value; };
    $('z-zrusit').onclick = () => { st.dialog = null; renderDialog(); };
    $('z-pozadi').onclick = e => { if (e.target.id === 'z-pozadi') { st.dialog = null; renderDialog(); } };
    box.querySelectorAll('[data-ulozit]').forEach(b => { b.onclick = () => ulozitZhvb(b.dataset.ulozit); });
  }
  /* ---------- přepis startovní karty ZHVB (příloha 2 rámcového OZ): stanoviště a úkoly v pořadí karty ---------- */
  function kartaZhvb(kat) {
    const prip = /přípravk/i.test(kat), dor = /doros/i.test(kat), skoly = /ZŠ|SŠ/i.test(kat), u = (k, n, max, jen5) => ({ k: k, n: n, max: max, jen5: !!jen5 });
    return [
      { k: 'K1', n: prip || skoly ? 'hod na cíl' : 'střelba', u: [u('K1', '', 15)] },
      { k: 'K2', n: 'orientace v přírodě', u: [u('K2a', '1. značky', 10), u('K2b', '2. stopy, stromy, rostliny', 5)] },
      { k: 'K3', n: 'uzlování', u: [u('K3', '', 15)] },
      { k: 'K4', n: 'brannost', u: dor ? [u('K4a', 'příkop', 5), u('K4b', 'lano', 10)] : [u('K4', prip || skoly ? 'příkop' : 'lano', 15)] },
      { k: 'K5', n: 'požární ochrana', u: [u('K5a', '1. ' + (prip || /mladší|ZŠ1/i.test(kat) ? 'rizika v domácnosti' : 'chování při MU'), 5), u('K5b', '2. trojúhelník hoření', 5, true), u('K5c', '3. značky PO', 5)] },
      { k: 'K6', n: 'první pomoc', u: [u('K6', '', 15)] },
      { k: 'K7', n: 'ochrana obyvatelstva', u: [u('K7a', '1. záchranářská ulička', 5, true), u('K7b', '2. tísňová volání', 5), u('K7c', '3. evakuační zavazadlo', 5)] }
    ].concat(P.zhvb(kat, {}).stanoviste.indexOf('K8') >= 0 ? [{ k: 'K8', n: 'orientace v terénu', u: [u('K8', 'chybějící razítka (zadní strana)', 3)] }] : []);
  }
  function predvyplnitKarta(dl) {
    const p = poleZhvb(dl.id), d = st.data.druzstva.find(x => x.id === dl.id);
    dl.radky = kartaZhvb(d.kat); dl.p0 = Object.assign({}, p); dl.f = {}; dl.jenCelkem = {};
    ['start', 'cil'].forEach(k => { dl.f[k] = p[k] != null ? P.hms(p[k]) : ''; });
    dl.radky.forEach(r => {
      r.u.forEach(x => { dl.f[x.k] = p[x.k] != null ? String(p[x.k]) : ''; });
      if (r.u.length > 1 && r.u.every(x => p[x.k] == null) && p[r.k] != null) dl.jenCelkem[r.k] = p[r.k]; // zapsané jen celkem (na stanovišti) – úkoly prázdné
      const c = 'c' + r.k.slice(1); dl.f[c] = p[c] ? P.ms(p[c]) : '';
    });
    dl.poznamka0 = p.pozn || ''; dl.poznamka = dl.poznamka0; dl.plat = p.plat || 'platný';
  }
  /** Z vyplněné karty: { pole, chyba } – body za stanoviště jsou součet úkolů, prázdná karta stanoviště nic nemění. */
  function kartaPole(dl) {
    const out = {}, cislo = t => { const s = String(t == null ? '' : t).trim(); return s === '' ? null : /^\d{1,2}$/.test(s) ? Number(s) : NaN; };
    for (const x of ['start', 'cil']) { const v = P.casDneZTextu(dl.f[x]); if (Number.isNaN(v)) return { chyba: (x === 'start' ? 'Čas startu' : 'Čas v cíli') + ': zapište jako 9:05:30.' }; out[x] = v; }
    for (const r of dl.radky) {
      const c = 'c' + r.k.slice(1), cv = P.cekaniZTextu(dl.f[c]);
      if (Number.isNaN(cv)) return { chyba: r.k + ' – čekací čas: zapište jako 2:30 (minuty:sekundy) nebo jen minuty.' };
      out[c] = cv;
      const hod = r.u.map(x => ({ x: x, v: cislo(dl.f[x.k]) }));
      const vadny = hod.find(h => Number.isNaN(h.v) || (h.v != null && (h.v > h.x.max || (h.x.jen5 && h.v !== 0 && h.v !== 5))));
      if (vadny) return { chyba: r.k + (vadny.x.n ? ' – ' + vadny.x.n : '') + ': ' + (vadny.x.jen5 ? '0 nebo 5 bodů.' : r.k === 'K8' ? 'počet chybějících razítek 0–3.' : 'trestné body 0–' + vadny.x.max + '.') };
      if (r.u.length === 1) { out[r.k] = hod[0].v; continue; }
      if (hod.every(h => h.v == null)) { if (r.u.some(x => dl.p0[x.k] != null)) { r.u.forEach(x => { out[x.k] = null; }); out[r.k] = null; } continue; } // úkoly smazané → stanoviště nezapsané
      hod.forEach(h => { out[h.x.k] = h.v || 0; });
      out[r.k] = hod.reduce((a, h) => a + (h.v || 0), 0);
    }
    return { pole: out };
  }
  function renderKarta(box, dl, d) {
    const vstup = (k, aria, ph, cls) => '<input class="' + (cls || 'mini') + '" data-pole="' + k + '" inputmode="' + (/^(start|cil|c\d)$/.test(k) ? 'decimal' : 'numeric') + '" autocomplete="off" aria-label="' + esc(aria) + '" placeholder="' + esc(ph || '') + '" value="' + esc(dl.f[k]) + '">';
    box.innerHTML = '<div class="dialog-pozadi" id="z-pozadi"><div class="zapis siroky" role="dialog" aria-modal="true" aria-labelledby="z-d-nadpis">' +
      '<div class="mala">' + esc(d.kat) + (d.start ? ' · startovní číslo ' + d.start : '') + ' · přepis startovní karty</div><h2 id="z-d-nadpis">' + esc(d.druzstvo) + '</h2>' +
      (dl.plat !== 'platný' ? '<p class="info" style="margin:8px 0 0;">Hlídka má zapsáno: <b>' + esc(dl.plat) + '</b>.</p>' : '') +
      '<div class="kr-hlava"><label>Čas startu' + vstup('start', 'Čas startu', '9:05:00', 'velky') + '</label><label>Čas v cíli' + vstup('cil', 'Čas v cíli', '9:32:10', 'velky') + '</label></div>' +
      '<div class="kr kr-zahlavi" aria-hidden="true"><span>Stanoviště</span><span>Trestné body</span><span>Celkem</span><span>Čekací čas</span></div>' +
      dl.radky.map(r => '<div class="kr"><div class="kr-n"><b>' + r.k + '</b> ' + esc(r.n) + (dl.jenCelkem[r.k] != null ? '<span class="nizko" style="display:block;">zapsáno na stanovišti celkem ' + dl.jenCelkem[r.k] + ' b.</span>' : '') + '</div>' +
        '<div class="kr-u">' + r.u.map(x => '<label class="kr-ukol">' + (x.n ? '<span>' + esc(x.n) + '</span>' : '') + vstup(x.k, r.k + ' ' + r.n + (x.n ? ' – ' + x.n : '') + ' – trestné body', x.jen5 ? '0 / 5' : r.k === 'K8' ? '0–3' : '') + '</label>').join('') + '</div>' +
        '<div class="kr-s" id="z-s-' + r.k + '">–</div><div class="kr-c">' + vstup('c' + r.k.slice(1), r.k + ' – čekací čas (min:s)', '0:00') + '</div></div>').join('') +
      '<div class="kr-souhrn" id="z-souhrn" aria-live="polite"></div>' +
      '<div class="field" style="margin:8px 0;"><label for="z-pozn">Poznámka (nepovinné, např. důvod NP)</label><input class="input" id="z-pozn" maxlength="300" value="' + esc(dl.poznamka) + '"></div>' +
      (dl.chyba ? '<p class="chyba">' + esc(dl.chyba) + '</p>' : '') +
      '<div class="tlacitka"><button type="button" class="btn btn-primary" data-karta="dalsi">Uložit a další hlídka</button><button type="button" class="btn btn-secondary" data-karta="">Uložit</button>' +
      '<button type="button" class="btn btn-secondary" id="z-nuly">Prázdná pole bodů = 0</button></div>' +
      '<div class="tlacitka"><button type="button" class="btn btn-secondary" data-karta="NP">NP – neplatný výsledek</button><button type="button" class="btn btn-secondary" data-karta="nenastoupil">Nenastoupil</button>' +
      '<button type="button" class="btn btn-secondary" data-karta="DIS">Diskvalifikace</button>' + (dl.plat !== 'platný' ? '<button type="button" class="btn btn-secondary" data-karta="zpet">Výsledek platí</button>' : '') +
      '<button type="button" class="btn btn-ghost" id="z-zrusit">Zavřít</button></div><p class="nizko" style="margin:8px 0 0;">Enter = Uložit a další hlídka.</p></div></div>';
    const souhrn = () => {
      const k = kartaPole(dl), p = Object.assign({}, poleZhvb(dl.id));
      dl.radky.forEach(r => { const el = $('z-s-' + r.k); if (!el) return;
        const v = k.pole ? (k.pole[r.k] !== undefined ? k.pole[r.k] : p[r.k]) : null; el.textContent = v == null ? '–' : r.k === 'K8' ? (v >= 3 ? 'neplatný' : v * 5 + ' b.') : v + ' b.'; });
      const el = $('z-souhrn');
      if (k.chyba) { el.innerHTML = '<span class="ceka">' + esc(k.chyba) + '</span>'; return; }
      Object.keys(k.pole).forEach(x => { if (k.pole[x] == null) delete p[x]; else p[x] = k.pole[x]; });
      const z = P.zhvb(d.kat, p), pol = (n, v) => '<div><span>' + n + '</span><b>' + v + '</b></div>';
      el.innerHTML = '<div class="kr-cisla">' + pol('Čas trati', z.trat != null ? P.hms(z.trat) : '–') + pol('Čekací čas', P.ms(z.cek)) + pol('Trestné body', z.body) +
        pol('Výsledný čas', z.np ? 'neplatný' : z.vysledny != null ? P.hms(z.vysledny) : '–') + '</div>' +
        (z.np ? '<span class="ceka">' + esc(z.np) + '</span>' : z.chybi.length ? '<span class="nizko">Chybí: ' + esc(z.chybi.join(', ')) + '</span>' : '<span class="nizko">Porovnejte s hlavičkou karty.</span>');
    };
    souhrn();
    box.querySelectorAll('[data-pole]').forEach(i => { i.oninput = e => { dl.f[i.dataset.pole] = e.target.value; souhrn(); }; });
    box.querySelector('.zapis').onkeydown = e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); ulozitKartu('dalsi'); } };
    $('z-nuly').onclick = () => { dl.radky.forEach(r => r.u.forEach(x => { if (String(dl.f[x.k] || '').trim() === '' && dl.jenCelkem[r.k] == null) { dl.f[x.k] = '0'; box.querySelector('[data-pole="' + x.k + '"]').value = '0'; } })); souhrn(); };
    $('z-pozn').oninput = e => { dl.poznamka = e.target.value; };
    $('z-zrusit').onclick = () => { st.dialog = null; renderDialog(); };
    $('z-pozadi').onclick = e => { if (e.target.id === 'z-pozadi') { st.dialog = null; renderDialog(); } };
    box.querySelectorAll('[data-karta]').forEach(b => { b.onclick = () => ulozitKartu(b.dataset.karta); });
  }
  /** akce: '' = uložit, dalsi = uložit a otevřít další hlídku kategorie, NP / DIS / nenastoupil, zpet = výsledek zase platí */
  function ulozitKartu(akce) {
    const dl = st.dialog, chyba = t => { dl.chyba = t; renderDialog(); };
    if (!String(st.jmeno || '').trim()) return chyba('Nahoře v panelu vyplňte své jméno (kdo zapisuje).');
    const k = kartaPole(dl);
    if (k.chyba) return chyba(k.chyba);
    const out = {}; Object.keys(k.pole).forEach(x => { if ((k.pole[x] == null ? null : k.pole[x]) !== (dl.p0[x] == null ? null : dl.p0[x])) out[x] = k.pole[x]; });
    const plat = ['NP', 'DIS', 'nenastoupil'].indexOf(akce) >= 0 ? akce : akce === 'zpet' ? 'platný' : '';
    const pozn = String(dl.poznamka || '').trim().slice(0, 300);
    const z = { klic: novyKlic(), prihlaska: dl.id, pokus: 1, zhvb: plat === 'nenastoupil' ? {} : out, rozhodci: String(st.jmeno).trim().slice(0, 60), zapsano: new Date().toISOString() };
    if (plat) z.platnost = plat;
    if (pozn !== dl.poznamka0) z.poznamka = pozn;
    const id = dl.id; st.dialog = null; renderDialog();
    if (Object.keys(z.zhvb).length || z.platnost || z.poznamka !== undefined) { st.fronta = st.fronta.concat(z); ulozitVse(); render(); odeslat(); }
    if (akce === 'dalsi') { // další hlídka téže kategorie podle startovního čísla
      const d = st.data.druzstva.find(x => x.id === id), v = st.data.druzstva.filter(x => x.kat === d.kat).sort((a, b) => (a.start || 999) - (b.start || 999) || String(a.druzstvo).localeCompare(b.druzstvo, 'cs'));
      const dalsi = v[v.findIndex(x => x.id === id) + 1];
      if (dalsi) { otevritZapis(dalsi.id, 0); setTimeout(() => { const i = $('z-dialog').querySelector('[data-pole="start"]'); if (i) i.focus(); }, 60); } else render();
    }
  }
  /** platnost: '' = jen pole, NP / DIS / nenastoupil, zpet = výsledek zase platí */
  function ulozitZhvb(platnost) {
    const dl = st.dialog, k = st.stan, cela = !k, chyba = t => { dl.chyba = t; renderDialog(); };
    if (!String(st.jmeno || '').trim()) return chyba('Nahoře v panelu vyplňte své jméno (kdo zapisuje).');
    const casy = cela ? ['start', 'cil'] : k === 'start' || k === 'cil' ? [k] : [], kroky = cela ? dl.stanoviste : casy.length ? [] : [k], out = {};
    for (const x of casy) {
      const v = P.casDneZTextu(dl.f[x]);
      if (Number.isNaN(v)) return chyba((x === 'start' ? 'Start' : 'Cíl') + ': čas zapište jako 9:05:30 (nebo stiskněte Teď).');
      if (!cela && !platnost && v === null) return chyba('Zapište čas ' + (x === 'start' ? 'startu' : 'v cíli') + ' (tlačítko Teď vloží aktuální čas).');
      if (v !== dl.p0[x]) out[x] = v;
    }
    for (const x of kroky) {
      const c = 'c' + x.slice(1), cv = P.cekaniZTextu(dl.f[c]);
      if (Number.isNaN(cv)) return chyba(x + ': čekací čas zapište jako 2:30 (minuty:sekundy) nebo jen minuty.');
      if (cv !== dl.p0[c]) out[c] = cv;
      if (dl.f[x] !== dl.p0[x] || (!cela && dl.f[x] != null)) out[x] = dl.f[x]; // na stanovišti rozhodčí potvrzuje své body vždy (i 0)
    }
    const pozn = String(dl.poznamka || '').trim().slice(0, 300);
    const z = { klic: novyKlic(), prihlaska: dl.id, pokus: 1, zhvb: platnost === 'nenastoupil' ? {} : out, rozhodci: String(st.jmeno).trim().slice(0, 60), zapsano: new Date().toISOString() };
    if (platnost) z.platnost = platnost === 'zpet' ? 'platný' : platnost;
    if (pozn !== dl.poznamka0) z.poznamka = pozn;
    st.dialog = null; renderDialog();
    if (!Object.keys(z.zhvb).length && !z.platnost && z.poznamka === undefined) return; // beze změny
    st.fronta = st.fronta.concat(z); // ZHVB: nic nepřepisovat – každý zápis nese jen svá pole
    ulozitVse(); render(); odeslat();
  }

  /* ---------- start ---------- */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) { try { navigator.serviceWorker.register('zavod-sw.js', { scope: './zavod' }).catch(() => {}); } catch (e) {} }
  window.addEventListener('online', () => { st.fronta.length ? odeslat() : nacistData(); });
  window.addEventListener('offline', () => renderStav());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { st.fronta.length ? odeslat() : nacistData(); } });
  window.addEventListener('hashchange', () => location.reload());
  setInterval(() => { if (navigator.onLine === false) return; if (st.fronta.length) odeslat(); else if (!st.dialog) nacistData(); }, 20000);
  render();
  if (kod) { if (st.fronta.length) odeslat(); else nacistData(); }
})();
