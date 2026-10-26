/* Test kandidáta na školení (B18) – test.html#k=<kód>. Bez přihlášení: kód z QR platí jen pro jedno školení a do konce jeho dne.
 * Kandidát vybere sebe ze seznamu účastníků, ověří se datem narození a píše test; server ho opraví (správné odpovědi ostré sady
 * do prohlížeče nikdy nepřijdou). Nesplní-li, může hned zkusit znovu – nový výběr otázek. Rozpracované odpovědi drží telefon
 * (sessionStorage), obnovení stránky pokus nezahodí.
 * Server: akce „test“ (krok info | start | odevzdat) v apps-script/Testy.gs. */
(function () {
  'use strict';
  const CFG = window.OSH_CONFIG || {}, API = CFG.apiUrl || '';
  const $ = id => document.getElementById(id);
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const kod = ((location.hash || '').match(/k=([a-f0-9]{32})/) || [])[1] || '';
  const KLIC = 'oshpz-test-' + kod.slice(0, 12);
  const uloz = v => { try { sessionStorage.setItem(KLIC, JSON.stringify(v)); } catch (e) {} };
  const nacti = () => { try { return JSON.parse(sessionStorage.getItem(KLIC)) || {}; } catch (e) { return {}; } };
  const chyb = n => n === 1 ? 'chyba' : n >= 2 && n <= 4 ? 'chyby' : 'chyb';

  const pam = nacti(); // { ucastnik, narozen, pokus: { id, klic }, odpovedi: [] }
  const st = { info: null, ucastnik: pam.ucastnik || '', narozen: pam.narozen || '', pokus: null, odpovedi: pam.odpovedi || [], vysledek: null, chyba: '', odesila: false, konec: 0 };
  const ulozit = () => uloz({ ucastnik: st.ucastnik, narozen: st.narozen, pokus: st.pokus ? { id: st.pokus.id } : null, odpovedi: st.odpovedi });

  function post(telo) {
    if (!API) return Promise.reject(new Error('Chybí adresa serveru (config.js).'));
    const ac = window.AbortController ? new AbortController() : null, t = ac && setTimeout(() => ac.abort(), 30000);
    return fetch(API, Object.assign({ method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ akce: 'test', kod: kod }, telo)) }, ac ? { signal: ac.signal } : {}))
      .then(r => r.json()).then(j => {
        clearTimeout(t);
        if (!j || (j.ok && !j.test)) throw new Error('Server neodpověděl správně – zkuste to znovu.'); // Google občas doručí POST jako GET → „ping“
        if (!j.ok) { const e = new Error(j.chyba || 'Chyba serveru'); e.neplatny = !!j.neplatny; throw e; }
        return j;
      }, e => { clearTimeout(t); throw new Error(e.name === 'AbortError' ? 'Server neodpovídá – zkontrolujte signál a zkuste to znovu.' : 'Bez spojení se serverem – zkontrolujte signál a zkuste to znovu.'); });
  }

  /* ---------- obrazovky ---------- */
  function vykreslit() {
    const o = $('t-obsah'), h = [];
    if (st.chyba) h.push('<p class="chyba" role="alert">' + esc(st.chyba) + '</p>');
    if (!kod) { o.innerHTML = '<p class="chyba">Neplatný odkaz. Načtěte znovu QR kód, který ukazuje lektor.</p>'; return; }
    if (!st.info) { o.innerHTML = h.join('') + (st.chyba ? '<div class="tlacitka"><button type="button" class="btn btn-secondary" id="t-znovu">Zkusit znovu</button></div>' : '<p>Načítám…</p>'); vazby(); return; }
    if (st.vysledek) h.push(obrVysledek());
    else if (st.pokus) h.push(obrTest());
    else h.push(obrVyber());
    o.innerHTML = h.join(''); vazby();
  }
  function obrVyber() {
    const h = ['<p>Vyberte své jméno a ověřte se datem narození, jak je uvedené v přihlášce na školení.</p><div class="lide" role="group" aria-label="Účastníci školení">'];
    st.info.ucastnici.forEach(u => h.push('<button type="button" class="clovek" data-u="' + esc(u.id) + '" aria-pressed="' + (u.id === st.ucastnik) + '"><span>' + esc(u.jmeno) + ' <small>' + esc(u.sbor) + '</small></span>' +
      (u.splneno ? '<small>test splněn</small>' : u.id === st.ucastnik ? '<small>vybráno</small>' : '') + '</button>'));
    h.push('</div>');
    if (!st.info.ucastnici.length) h.push('<p class="chyba">Na školení zatím nikdo není přihlášený. Obraťte se na lektora.</p>');
    if (st.ucastnik) {
      const u = st.info.ucastnici.find(x => x.id === st.ucastnik) || {};
      h.push('<div class="pole"><label for="t-nar">Datum narození – ' + esc(u.jmeno || '') + '</label><input id="t-nar" type="date" value="' + esc(st.narozen) + '" autocomplete="bday"></div>' +
        '<p class="mala">' + esc(u.test || '') + '. Nesplníte-li test napoprvé, můžete hned zkusit znovu s jinými otázkami.</p>' +
        '<div class="tlacitka"><button type="button" class="btn btn-primary" id="t-start"' + (st.odesila ? ' disabled' : '') + '>' + (st.odesila ? 'Připravuji test…' : u.splneno ? 'Zobrazit výsledek' : 'Začít test') + '</button></div>');
    }
    return h.join('');
  }
  function obrTest() {
    const p = st.pokus, n = p.otazky.length, hotovo = st.odpovedi.filter(x => x != null).length;
    const h = ['<div class="lista"><span>' + esc(p.nazev) + ' · <b>' + p.cislo + '. pokus</b></span><span><b id="t-hotovo">' + hotovo + '</b> z ' + n + ' zodpovězeno</span>' +
      (p.minut ? '<span>zbývá <b id="t-cas">' + zbyva() + '</b></span>' : '') + '</div>'];
    h.push('<p class="mala">Projde nejvýš ' + p.maxChyb + ' ' + chyb(p.maxChyb) + '. Odpovědi se ukládají v telefonu, obnovení stránky nevadí.</p>');
    p.otazky.forEach((q, i) => {
      h.push('<div class="otazka-obal"><fieldset class="otazka"><legend>' + (i + 1) + '. ' + esc(q.t) + '</legend>');
      q.m.forEach((m, j) => { if (!m) return; const id = 't-q' + i + '-' + j;
        h.push('<label class="moznost" for="' + id + '"><input type="radio" name="q' + i + '" id="' + id + '" value="' + j + '"' + (st.odpovedi[i] === j ? ' checked' : '') + ' data-q="' + i + '"><span>' + esc(m) + '</span></label>'); });
      h.push('</fieldset></div>');
    });
    h.push('<div class="tlacitka"><button type="button" class="btn btn-primary" id="t-odevzdat"' + (st.odesila ? ' disabled' : '') + '>' + (st.odesila ? 'Odevzdávám…' : 'Odevzdat test') + '</button></div>');
    return h.join('');
  }
  function obrVysledek() {
    const v = st.vysledek, h = [];
    h.push('<div class="verdikt' + (v.splneno ? ' ok' : '') + '" role="status"><b>' + (v.splneno ? 'Test splněn' : 'Test zatím nesplněn') + '</b>' +
      (v.otazek ? v.chyb + ' ' + chyb(v.chyb) + ' z ' + v.otazek + ' otázek (projde nejvýš ' + v.maxChyb + ')' : '') + (v.pokus ? ' · ' + v.pokus + '. pokus' : '') + '</div>');
    if (v.casVyprsel) h.push('<p class="chyba">Pokus byl odevzdán po časovém limitu.</p>');
    if (v.splneno) h.push('<p>Výsledek vidí okres. Konečné vyhodnocení školení (a zápis kvalifikace) provede okres, sbor dostane e-mail.</p>');
    else h.push('<p>Můžete hned zkusit znovu – dostanete jiný výběr otázek.</p>');
    if (v.spatne && v.spatne.length) {
      h.push('<h2 style="font-size:19px;margin:16px 0 8px;">Otázky s chybou</h2><ol class="spatne">');
      v.spatne.forEach(x => h.push('<li value="' + x.c + '">' + esc(x.t) + '<br><span class="mala">vaše odpověď: ' + esc(x.vase) + '</span></li>'));
      h.push('</ol><p class="mala">Správné odpovědi se v ostrém testu neukazují – najdete je ve Směrnici hry Plamen a v organizačním zabezpečení ZHVB.</p>');
    }
    if (!v.splneno) h.push('<div class="tlacitka"><button type="button" class="btn btn-primary" id="t-znovu-test"' + (st.odesila ? ' disabled' : '') + '>' + (st.odesila ? 'Připravuji test…' : 'Zkusit znovu') + '</button></div>');
    return h.join('');
  }
  function zbyva() {
    const s = Math.max(0, Math.round((st.konec - Date.now()) / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  /* ---------- akce ---------- */
  function vazby() {
    const z = $('t-znovu'); if (z) z.onclick = nactiInfo;
    document.querySelectorAll('.clovek').forEach(b => { b.onclick = () => { st.ucastnik = b.getAttribute('data-u'); st.chyba = ''; ulozit(); vykreslit(); const n = $('t-nar'); if (n) n.focus(); }; });
    const nar = $('t-nar'); if (nar) nar.onchange = () => { st.narozen = nar.value; ulozit(); };
    const s = $('t-start'); if (s) s.onclick = () => { if (nar) st.narozen = nar.value; start(); };
    const zt = $('t-znovu-test'); if (zt) zt.onclick = () => { st.vysledek = null; start(); };
    document.querySelectorAll('input[type=radio][data-q]').forEach(r => { r.onchange = () => {
      st.odpovedi[Number(r.getAttribute('data-q'))] = Number(r.value); ulozit();
      const h = $('t-hotovo'); if (h) h.textContent = st.odpovedi.filter(x => x != null).length; }; });
    const od = $('t-odevzdat'); if (od) od.onclick = odevzdat;
  }
  function nactiInfo() {
    st.chyba = ''; vykreslit();
    post({ krok: 'info' }).then(j => {
      st.info = j; $('t-nazev').textContent = j.skoleni.nazev; $('t-sub').textContent = 'Test ke školení · ' + j.skoleni.datum;
      if (st.ucastnik && !j.ucastnici.some(u => u.id === st.ucastnik)) st.ucastnik = '';
      vykreslit();
      if (pam.pokus && st.ucastnik && st.narozen) start(true); // obnovení stránky během testu
    }).catch(e => { st.chyba = e.message; $('t-sub').textContent = ''; vykreslit(); });
  }
  function start(obnova) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(st.narozen)) { st.chyba = 'Vyplňte datum narození.'; return vykreslit(); }
    st.odesila = true; st.chyba = ''; vykreslit();
    post({ krok: 'start', ucastnik: st.ucastnik, narozen: st.narozen }).then(j => {
      st.odesila = false;
      if (j.hotovo) { st.vysledek = j.vysledek; st.pokus = null; ulozit(); return vykreslit(); }
      const p = j.pokus;
      if (!(obnova && pam.pokus && pam.pokus.id === p.id) && !(st.pokus && st.pokus.id === p.id)) st.odpovedi = [];
      st.pokus = p; st.konec = p.minut ? new Date(p.zacatek).getTime() + p.minut * 60000 : 0;
      ulozit(); vykreslit(); window.scrollTo(0, 0);
    }).catch(e => { st.odesila = false; st.chyba = e.message; vykreslit(); });
  }
  function odevzdat(auto) {
    const p = st.pokus; if (!p) return;
    const chybi = p.otazky.length - st.odpovedi.filter(x => x != null).length;
    if (chybi && auto !== true && !window.confirm('Nezodpovězeno: ' + chybi + '. Nezodpovězená otázka se počítá jako chyba. Odevzdat?')) return;
    st.odesila = true; st.chyba = ''; vykreslit();
    post({ krok: 'odevzdat', ucastnik: st.ucastnik, narozen: st.narozen, pokus: p.id, klic: p.klic, odpovedi: p.otazky.map((q, i) => st.odpovedi[i] == null ? null : st.odpovedi[i]) }).then(j => {
      st.odesila = false; st.vysledek = j.vysledek; st.pokus = null; st.odpovedi = []; ulozit(); vykreslit(); window.scrollTo(0, 0);
      const u = st.info.ucastnici.find(x => x.id === st.ucastnik); if (u && j.vysledek.splneno) u.splneno = true;
    }).catch(e => { st.odesila = false; st.chyba = e.message + ' Odpovědi zůstaly uložené.'; vykreslit(); });
  }
  setInterval(() => { const c = $('t-cas'); if (c && st.konec) { c.textContent = zbyva(); if (st.konec - Date.now() < 0 && !st.odesila) { st.konec = 0; odevzdat(true); } } }, 1000);
  window.addEventListener('hashchange', () => location.reload());
  if (kod) nactiInfo(); else vykreslit();
})();
