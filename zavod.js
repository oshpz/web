/* Závodní panel rozhodčích (B8) – zavod.html#k=<kód>. Bez přihlášení: kód z odkazu platí jen pro jednu soutěž a do jejího konce.
 * Bez signálu: soutěž, startovka a výsledky se drží v telefonu (localStorage), zápisy čekají ve frontě a odešlou se po připojení.
 * Každý zápis má vlastní klíč – server ho při opakovaném odeslání nezapíše dvakrát; při souběhu dvou rozhodčích platí novější zápis.
 * Pořadí počítá souteze.js (kopie výpočtu ze serveru). Hlavní rozhodčí (vlastní odkaz) výsledky ověří, okres je pak zveřejní.
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
    jmeno: jmenoUlozene(), kat: nacti('-kat', ''), rezim: 'zapis', odesila: false, nacita: false, chyba: '', neplatny: false,
    dialog: null, hr: { jmeno: jmenoUlozene(), shoda: {}, chyba: '', odesila: false }
  };
  const ulozitVse = () => { uloz('-data', st.data); uloz('-fronta', st.fronta); uloz('-hlaseni', st.hlaseni.slice(-20)); uloz('-cas', st.posledni); uloz('-kat', st.kat); };

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
    const m = {};
    (st.data ? st.data.vysledky : []).forEach(v => { m[v.prihlaska + '|' + v.pokus] = v; });
    st.fronta.forEach(z => { m[z.prihlaska + '|' + z.pokus] = { prihlaska: z.prihlaska, pokus: z.pokus, casL: z.casL, casP: z.casP, cas: z.platnost === 'platný' ? Math.max(z.casL, z.casP) : null, platnost: z.platnost, poznamka: z.poznamka, ceka: true }; });
    return Object.keys(m).map(k => m[k]);
  }
  function druzstva() { return (st.data ? st.data.druzstva : []).map(d => Object.assign({}, d, st.hr.shoda[d.id] ? { shoda: st.hr.shoda[d.id] } : {})); }
  function poradi() { const s = st.data.soutez; return P.poradi({ kategorie: s.kategorie, pokusy: s.pokusy, shoda: s.shoda }, druzstva(), vysledky()); }
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
    $('z-sub').textContent = [fDatum(s.od), s.misto, s.druh + ', ' + (s.pokusy === 2 ? '2 pokusy, platí lepší' : '1 pokus'), hlavni ? 'hlavní rozhodčí' : 'rozhodčí'].filter(Boolean).join(' · ');
    const h = [];
    if (st.chyba) h.push('<p class="chyba">' + esc(st.chyba) + '</p>');
    if (s.stav === 'ověřeno' || s.stav === 'zveřejněno') h.push('<p class="info"><b>Výsledky ověřil ' + esc(s.overil || 'hlavní rozhodčí') + (s.overeno ? ' ' + fDatum(s.overeno) + ' v ' + fCas(s.overeno) : '') + '.</b> Zápis je uzavřený, opravu povolí okres.</p>');
    else if (s.stav !== 'závod') h.push('<p class="info">Soutěž není ve stavu závod – zapisovat zatím nejde.</p>');
    const hl = st.hlaseni.filter(x => !x.skryto);
    if (hl.length) h.push('<div class="info"><b>Hlášení serveru</b><ul style="margin:6px 0 6px 18px;padding:0;">' + hl.slice(-6).map(x => '<li>' + esc(x.text) + '</li>').join('') + '</ul><button type="button" class="btn btn-ghost" id="z-hl-zavrit">Skrýt</button></div>');
    h.push('<div class="field" style="margin:0 0 12px;max-width:360px;"><label for="z-jmeno">Vaše jméno (rozhodčí)</label><input class="input" id="z-jmeno" maxlength="60" autocomplete="name" value="' + esc(st.jmeno) + '"></div>');
    const rezimy = [['zapis', 'Zápis'], ['poradi', 'Pořadí']].concat(hlavni ? [['overeni', 'Ověření']] : []);
    h.push('<div class="seg2" role="group" aria-label="Zobrazení">' + rezimy.map(r => '<button type="button" data-rezim="' + r[0] + '" aria-pressed="' + (st.rezim === r[0]) + '">' + r[1] + '</button>').join('') + '</div>');
    const por = poradi();
    if (st.rezim !== 'overeni') {
      const kats = por.map(c => c.kat);
      h.push('<div class="seg2" role="group" aria-label="Kategorie">' + kats.map(k => '<button type="button" data-kat="' + esc(k) + '" aria-pressed="' + (st.kat === k) + '">' + esc(k) + ' (' + por.find(c => c.kat === k).rows.length + ')</button>').join('') + '</div>');
    }
    const c = por.find(x => x.kat === st.kat) || por[0];
    if (st.rezim === 'zapis') h.push(htmlZapis(c, s));
    else if (st.rezim === 'poradi') h.push(htmlPoradi(c, s));
    else h.push(htmlOvereni(por, s));
    o.innerHTML = h.join('');
    // události
    const j = $('z-jmeno'); if (j) j.oninput = e => { st.jmeno = e.target.value.slice(0, 60); try { localStorage.setItem('oshpz-zavod-jmeno', st.jmeno); } catch (x) {} };
    o.querySelectorAll('[data-rezim]').forEach(b => { b.onclick = () => { st.rezim = b.dataset.rezim; render(); }; });
    o.querySelectorAll('[data-kat]').forEach(b => { b.onclick = () => { st.kat = b.dataset.kat; uloz('-kat', st.kat); render(); }; });
    o.querySelectorAll('[data-tym]').forEach(b => { b.onclick = () => otevritZapis(b.dataset.tym); });
    const hz = $('z-hl-zavrit'); if (hz) hz.onclick = () => { st.hlaseni.forEach(x => { x.skryto = true; }); ulozitVse(); render(); };
    navazatOvereni();
    if (afId && $(afId)) { $(afId).focus(); try { $(afId).setSelectionRange(sel[0], sel[1]); } catch (e) {} }
    if (st.dialog && !st.data.druzstva.some(x => x.id === st.dialog.id)) { st.dialog = null; renderDialog(); } // otevřený zápis se nepřekresluje
  }

  const ceka = (id, pokus) => st.fronta.some(z => z.prihlaska === id && z.pokus === pokus);
  function pokusText(v, i, id) {
    const t = !v ? '–' : v.platnost === 'platný' ? P.casText(v.cas) : v.platnost;
    return i + '. ' + t + (ceka(id, i) ? ' <span class="ceka" title="čeká na odeslání">●</span>' : '');
  }
  function htmlZapis(c, s) {
    if (!c || !c.rows.length) return '<p class="prazdne">V kategorii nejsou žádná družstva.</p>';
    const rows = c.rows.slice().sort((a, b) => (a.start || 999) - (b.start || 999) || String(a.druzstvo).localeCompare(b.druzstvo, 'cs'));
    return '<p class="nizko" style="margin:0 0 6px;">Klepněte na družstvo a zapište časy z terčů. Startovní pořadí, ● = čeká na odeslání.</p><div>' + rows.map(r =>
      '<button type="button" class="tym" data-tym="' + esc(r.id) + '"' + (lzeZapisovat() ? '' : ' disabled') + '><span class="c">' + (r.start || '') + '</span><span><span class="n">' + esc(r.druzstvo) + '</span><span class="p" style="display:block;">' +
      r.pokusy.map((v, i) => pokusText(v, i + 1, r.id)).join(' · ') + '</span></span><span class="r">' + esc(r.vysledek) + '</span></button>').join('') + '</div>';
  }
  function htmlPoradi(c, s) {
    if (!c || !c.rows.length) return '<p class="prazdne">V kategorii nejsou žádná družstva.</p>';
    return '<table class="por"><thead><tr><th>Místo</th><th>Družstvo</th><th>Pokusy</th><th>Výsledek</th></tr></thead><tbody>' + c.rows.map(r =>
      '<tr><td class="m">' + (r.poradi ? r.poradi + '.' : '') + '</td><td><b>' + esc(r.druzstvo) + '</b>' + (r.shoda ? '<div class="nizko">shoda času' + (r.nerozhodnuto ? ' – pořadí určí hlavní rozhodčí' : '') + '</div>' : '') + '</td><td class="nizko">' +
      r.pokusy.map((v, i) => pokusText(v, i + 1, r.id) + (v && v.platnost === 'platný' ? ' (L ' + P.casText(v.casL) + ' / P ' + P.casText(v.casP) + ')' : '')).join('<br>') + '</td><td><b>' + esc(r.vysledek) + '</b></td></tr>').join('') +
      '</tbody></table><p class="nizko">' + (s.shoda === 'rozhoduje pořadatel' ? 'Shoda času: pořadí určí hlavní rozhodčí.' : 'Shoda času: rozhoduje součet obou pokusů (pravidla SH ČMS), pak dělené místo.') + ' NP je vždy za platnými pokusy.</p>';
  }
  function htmlOvereni(por, s) {
    const chybi = [], shody = [];
    por.forEach(c => {
      c.rows.forEach(r => { if (r.stav !== 'DIS') { const bez = r.pokusy.map((p, i) => p ? 0 : i + 1).filter(Boolean); if (bez.length) chybi.push(c.kat + ' – ' + r.druzstvo + ' (' + bez.join('. a ') + '. pokus)'); } });
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
  function otevritZapis(id) {
    if (!lzeZapisovat()) return;
    if (st.dialog) return;
    const v = vysledky().filter(x => x.prihlaska === id), pokusy = st.data.soutez.pokusy;
    let pokus = 1; while (pokus < pokusy && v.some(x => x.pokus === pokus)) pokus++;
    st.dialog = { id: id, pokus: pokus, L: '', P: '', poznamka: '', chyba: '' };
    predvyplnit(); renderDialog();
    setTimeout(() => { const i = $('z-L'); if (i) i.focus(); }, 50);
  }
  function predvyplnit() {
    const dl = st.dialog, v = vysledky().find(x => x.prihlaska === dl.id && x.pokus === dl.pokus);
    dl.puvodni = v || null;
    dl.L = v && v.casL != null ? P.casText(v.casL) : ''; dl.P = v && v.casP != null ? P.casText(v.casP) : ''; dl.poznamka = v ? v.poznamka || '' : '';
  }
  function renderDialog() {
    const box = $('z-dialog'), dl = st.dialog;
    if (!dl || !st.data) { box.innerHTML = ''; return; }
    const d = st.data.druzstva.find(x => x.id === dl.id);
    if (!d) { st.dialog = null; box.innerHTML = ''; return; }
    const pokusy = st.data.soutez.pokusy, pv = dl.puvodni;
    box.innerHTML = '<div class="dialog-pozadi" id="z-pozadi"><div class="zapis" role="dialog" aria-modal="true" aria-labelledby="z-d-nadpis">' +
      '<div class="mala">' + esc(d.kat) + (d.start ? ' · start ' + d.start : '') + '</div><h2 id="z-d-nadpis">' + esc(d.druzstvo) + '</h2>' +
      (pokusy === 2 ? '<div class="seg2" role="group" aria-label="Pokus" style="margin:8px 0 0;">' + [1, 2].map(i => '<button type="button" data-pokus="' + i + '" aria-pressed="' + (dl.pokus === i) + '">' + i + '. pokus</button>').join('') + '</div>' : '') +
      (pv ? '<p class="info" style="margin:8px 0 0;">Pokus už má zápis: <b>' + esc(pv.platnost === 'platný' ? P.casText(pv.cas) + ' s' : pv.platnost) + '</b>. Uložením ho přepíšete.</p>' : '') +
      '<div class="casy"><div><label for="z-L">Terč L (s)</label><input id="z-L" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' + esc(dl.L) + '"></div>' +
      '<div><label for="z-P">Terč P (s)</label><input id="z-P" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' + esc(dl.P) + '"></div></div>' +
      '<p class="vysl" id="z-vysl"></p>' +
      '<div class="field" style="margin:0 0 8px;"><label for="z-pozn">Poznámka (nepovinné, např. důvod NP)</label><input class="input" id="z-pozn" maxlength="300" value="' + esc(dl.poznamka) + '"></div>' +
      (dl.chyba ? '<p class="chyba">' + esc(dl.chyba) + '</p>' : '') +
      '<div class="tlacitka"><button type="button" class="btn btn-primary" data-ulozit="platný">Uložit čas</button>' +
      '<button type="button" class="btn btn-secondary" data-ulozit="NP">NP – neplatný pokus</button></div>' +
      '<div class="tlacitka"><button type="button" class="btn btn-secondary" data-ulozit="nenastoupil">Nenastoupil</button>' +
      '<button type="button" class="btn btn-secondary" data-ulozit="DIS">Diskvalifikace</button>' +
      '<button type="button" class="btn btn-ghost" id="z-zrusit">Zavřít</button></div></div></div>';
    const prepocet = () => {
      const L = P.casZTextu(dl.L), Pc = P.casZTextu(dl.P), el = $('z-vysl');
      el.innerHTML = L > 0 && Pc > 0 ? 'Výsledný čas pokusu (delší z terčů): <b>' + P.casText(Math.max(L, Pc)) + ' s</b>' : (Number.isNaN(L) || Number.isNaN(Pc)) ? '<span class="ceka">Čas zapište v sekundách, např. 17,84.</span>' : 'Výsledný čas = delší z obou terčů.';
    };
    prepocet();
    $('z-L').oninput = e => { dl.L = e.target.value; prepocet(); };
    $('z-P').oninput = e => { dl.P = e.target.value; prepocet(); };
    $('z-pozn').oninput = e => { dl.poznamka = e.target.value; };
    $('z-zrusit').onclick = () => { st.dialog = null; renderDialog(); };
    $('z-pozadi').onclick = e => { if (e.target.id === 'z-pozadi') { st.dialog = null; renderDialog(); } };
    box.querySelectorAll('[data-pokus]').forEach(b => { b.onclick = () => { dl.pokus = Number(b.dataset.pokus); dl.chyba = ''; predvyplnit(); renderDialog(); }; });
    box.querySelectorAll('[data-ulozit]').forEach(b => { b.onclick = () => ulozitPokus(b.dataset.ulozit); });
  }
  function ulozitPokus(platnost) {
    const dl = st.dialog, L = P.casZTextu(dl.L), Pc = P.casZTextu(dl.P);
    if (!String(st.jmeno || '').trim()) { dl.chyba = 'Nahoře v panelu vyplňte své jméno (kdo zapisuje).'; renderDialog(); return; }
    if (platnost === 'platný' && !(L > 0 && Pc > 0)) { dl.chyba = 'Zapište oba časy z terčů L a P v sekundách (např. 17,84), nebo zvolte NP.'; renderDialog(); return; }
    if ((L != null && !(L > 0 && L < 1000)) || (Pc != null && !(Pc > 0 && Pc < 1000))) { dl.chyba = 'Čas má být 0,01–999,99 s.'; renderDialog(); return; }
    const z = { klic: novyKlic(), prihlaska: dl.id, pokus: dl.pokus, casL: platnost === 'nenastoupil' ? null : (L > 0 ? L : null), casP: platnost === 'nenastoupil' ? null : (Pc > 0 ? Pc : null),
      platnost: platnost, poznamka: String(dl.poznamka || '').trim().slice(0, 300), rozhodci: String(st.jmeno).trim().slice(0, 60), zapsano: new Date().toISOString() };
    st.fronta = st.fronta.filter(x => !(x.prihlaska === z.prihlaska && x.pokus === z.pokus)).concat(z);
    st.dialog = null; renderDialog(); ulozitVse(); render();
    odeslat();
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
