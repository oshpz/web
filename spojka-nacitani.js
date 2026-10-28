/* Spojka – načítání (F14, podle návrhu „Načítání Spojka“ z Claude Design). Bez knihoven, sdílí aplikace, návody, závodní panel a test.
 *
 *   SpojkaNacitani.vytvor({ velikost: 72, barvy: 'barevne' | 'bila', text }) → prvek <spojka-nacitani>
 *   v šabloně:  <spojka-nacitani velikost="72"></spojka-nacitani>          znak uvnitř obrazovky (detail)
 *               <spojka-nacitani cela velikost="112"></spojka-nacitani>     celá obrazovka (první načtení, přepnutí okres / sbor)
 *               <spojka-kostra radky="4"></spojka-kostra>                   šedé obrysy řádků místo seznamu
 *   atributy:   barvy="bila" (na barevné ploše), text="…" (místo „Spojuji data“), text-offline="…", ihned (bez zpoždění), inline,
 *               ukazka (návody: hned, bez časovačů 6 / 20 s) a ukazka="offline" (vzhled bez spojení)
 *   tlačítka:   zakázané tlačítko s textem končícím „…“ (Ukládám…, Odesílám…, Nahrávám…) dostane znak 20 px v barvě písma (CSS, obsah tlačítka se nemění).
 *   spojení:    SpojkaNacitani.hlidatSpojeni({ znovu }) – proužek „Bez spojení…“ nahoře, po obnovení „Spojení obnoveno“ (2 s) a znovu().
 *
 * Pohyb: jedno časování pro všechny znaky na stránce (requestAnimationFrame + performance.now(), perioda 2,4 s):
 *   0–8 % od sebe · 8–50 % k sobě s otočením (levá −360°, pravá +360°, stínování) · 50–60 % cvaknutí · 60–66 % drží spojené · 66–92 % od sebe · 92–100 % drží.
 * Ukáže se až po 300 ms, drží aspoň 0,8 s; po odebrání ze stránky (data dorazila) dokončí přiblížení a cvaknutí (fáze 60 %) a zmizí za 150 ms –
 * nikdy nekončí v rozpojování. Po 6 s „Ještě chvíli…“, po 20 s chyba s Zkusit znovu / Napsat správci. Smyčka běží jen při viditelném znaku a viditelné stránce.
 */
(function () {
  'use strict';
  if (window.SpojkaNacitani) return;
  var PERIODA = 2400, ZPOZDENI = 300, MIN = 800, ZMIZENI = 150, POMALU = 6000, VZDAT = 20000, TECKY = 450;
  var CESTA_L = 'M45 14A36 36 0 0 0 45 86L45 74A24 24 0 0 1 45 26ZM2 43V57H16V43Z', CESTA_P = 'M55 86A36 36 0 0 0 55 14L55 26A24 24 0 0 1 55 74ZM84 43V57H98V43Z';
  var BARVY = { barevne: ['#ec3013', '#2b4fb0'], bila: ['#fff', '#fff'] };
  var SPRAVCE = 'spravci@oshpz.cz';
  var T_NACITANI = 'Spojuji data', T_POMALU = 'Ještě chvíli, server odpovídá pomaleji', T_CHYBA = 'Nepodařilo se načíst data.',
    T_OFFLINE = 'Bez spojení k internetu – zobrazuji naposledy načtená data', T_OBNOVENO = 'Spojení obnoveno';
  var NS = 'http://www.w3.org/2000/svg';
  var bezPohybu = function () { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  var online = function () { return navigator.onLine !== false; };

  /* ---------- styly (jednou do <head>) ---------- */
  var ZNAK_MASKA = 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="' + NS + '" viewBox="0 0 100 100"><path d="' + CESTA_L + '"/><path d="' + CESTA_P + '"/></svg>') + '")';
  var VNITRNI = ':host{display:block}' +
    '.sn-znak{position:relative;margin:0 auto}' +
    '.sn-znak svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;will-change:transform}' +
    '.sn-text{margin-top:14px;font-weight:700;font-size:15px;line-height:1.4}' +
    '.sn-tecky{display:inline-block;width:1.2em;text-align:left}' +
    ':host(.sn-offline) .sn-znak{opacity:.35;filter:grayscale(1)}' +
    ':host(.sn-offline) .sn-text{font-weight:600}' +
    '.sn-akce{display:none;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:14px}' +
    ':host(.sn-chyba) .sn-akce{display:flex}' +
    '.sn-akce a,.sn-akce button{font:inherit;font-weight:700;font-size:14px;padding:9px 16px;border:2px solid currentColor;background:transparent;color:inherit;cursor:pointer;text-decoration:none;border-radius:0}' +
    '.sn-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}' +
    '.sk-r{display:flex;gap:16px;align-items:center;padding:14px 0;border-bottom:2px solid var(--color-divider,#d9d9d9)}' +
    '.sk-b{display:block;height:12px;background:var(--color-neutral-200,#e3e3e3)}' +
    '.sk-s{flex:1 1 auto;display:grid;gap:8px}';
  function koren(el) { // shadow DOM se styly; vrací kořen bez starého obsahu
    var r = el.shadowRoot;
    if (!r) { r = el.attachShadow({ mode: 'open' }); var st = document.createElement('style'); st.textContent = VNITRNI; r.appendChild(st); }
    while (r.lastChild && r.lastChild.nodeName !== 'STYLE') r.removeChild(r.lastChild);
    return r;
  }
  function styly() {
    if (document.getElementById('spojka-nacitani-styly')) return;
    var s = document.createElement('style'); s.id = 'spojka-nacitani-styly';
    s.textContent =
      'spojka-nacitani{display:block;text-align:center;padding:24px 0;opacity:0;transition:opacity .15s linear;color:inherit}' +
      'spojka-nacitani.sn-ukazano{opacity:1}' +
      'spojka-nacitani[cela]{position:fixed;inset:0;z-index:950;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;background:var(--color-bg,#f2f2f2);pointer-events:none}' +
      'spojka-nacitani[cela].sn-ukazano{pointer-events:auto}' +
      'spojka-nacitani[inline]{display:inline-block;padding:0;vertical-align:middle}' +
      '.sn-znak{position:relative;margin:0 auto}' +
      '.sn-znak svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;will-change:transform}' +
      '.sn-text{margin-top:14px;font-weight:700;font-size:15px;line-height:1.4}' +
      '.sn-tecky{display:inline-block;width:1.2em;text-align:left}' +
      '.sn-sr{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}' +
      '.sn-duch{position:fixed;z-index:960;pointer-events:none;text-align:center;transition:opacity .15s linear}' +
      'spojka-kostra{display:block;border-top:2px solid var(--color-text,#201e1d)}' +
      'button[data-sn-busy]::before{content:"";display:inline-block;width:20px;height:20px;margin:-4px 8px -4px 0;vertical-align:middle;background:currentColor;' +
      '-webkit-mask:' + ZNAK_MASKA + ' center/contain no-repeat;mask:' + ZNAK_MASKA + ' center/contain no-repeat;animation:sn-puls 2.4s ease-in-out infinite}' +
      '@keyframes sn-puls{0%,100%{opacity:1}50%{opacity:.45}}' +
      '@media (prefers-reduced-motion:reduce){button[data-sn-busy]::before{animation-duration:4.8s}}' +
      'body{transition:padding-top .2s ease}.sn-pruh{position:fixed;left:0;right:0;top:0;z-index:940;display:flex;gap:10px;align-items:center;justify-content:center;padding:6px 16px;font-size:13.5px;font-weight:600;' +
      'background:var(--color-surface,#fff);color:var(--color-text,#201e1d);border-bottom:2px solid var(--color-text,#201e1d);transform:translateY(-110%);transition:transform .2s ease}' +
      '.sn-pruh.sn-ukazano{transform:none}' +
      '@media print{spojka-nacitani,.sn-duch,.sn-pruh{display:none!important}}';
    (document.head || document.documentElement).appendChild(s);
  }

  /* ---------- pohyb ---------- */
  var eio = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }; // easeInOutCubic
  // stav znaku ve fázi p (0–1): x = oddálení v násobcích D, otočení, jas půlek, měřítko obalu
  function faze(p) {
    var s, k;
    if (p < .08) return { x: 1, rl: 0, rp: 0, jl: 1, jp: 1, m: 1 };
    if (p < .5) { s = eio((p - .08) / .42); k = Math.sin(2 * Math.PI * s); return { x: 1 - s, rl: -360 * s, rp: 360 * s, jl: 1 + .35 * k, jp: 1 - .35 * k, m: 1 }; }
    if (p < .6) { k = (p - .5) / .1; return { x: 0, rl: 0, rp: 0, jl: 1, jp: 1, m: 1 + .08 * Math.sin(Math.PI * k) }; }
    if (p < .66) return { x: 0, rl: 0, rp: 0, jl: 1, jp: 1, m: 1 };
    if (p < .92) { s = eio((p - .66) / .26); return { x: s, rl: 0, rp: 0, jl: 1, jp: 1, m: 1 }; }
    return { x: 1, rl: 0, rp: 0, jl: 1, jp: 1, m: 1 };
  }
  var SPOJENO = { x: 0, rl: 0, rp: 0, jl: 1, jp: 1, m: 1 };
  var faze0 = function () { return (performance.now() % PERIODA) / PERIODA; };

  /* ---------- jedna smyčka pro všechny znaky ---------- */
  var aktivni = new Set(), raf = 0;
  function smycka() {
    raf = 0;
    if (document.visibilityState !== 'visible') return;
    var p = faze0(), dalsi = false;
    aktivni.forEach(function (z) { if (z.krok(p)) dalsi = true; });
    if (dalsi) raf = requestAnimationFrame(smycka);
  }
  function rozbehnout() { if (!raf && document.visibilityState === 'visible' && aktivni.size) raf = requestAnimationFrame(smycka); }
  document.addEventListener('visibilitychange', rozbehnout);
  var io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(function (z) {
    z.forEach(function (x) { if (x.target._sn) { x.target._sn.naObrazovce = x.isIntersecting; } }); rozbehnout();
  }) : null;

  /* ---------- znak (sdílí prvek i „duch“ po odebrání) ---------- */
  function Znak(obal, velikost, barvy) {
    this.v = velikost; this.D = velikost * .22;
    var b = BARVY[barvy] || BARVY.barevne;
    this.el = document.createElement('div'); this.el.className = 'sn-znak'; this.el.setAttribute('aria-hidden', 'true');
    this.el.style.cssText = 'width:' + velikost + 'px;height:' + velikost + 'px;perspective:' + (velikost * .8) + 'px';
    var pul = function (d, f) { var s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 100 100'); s.setAttribute('focusable', 'false');
      var c = document.createElementNS(NS, 'path'); c.setAttribute('d', d); c.setAttribute('fill', f); s.appendChild(c); return s; };
    this.l = pul(CESTA_L, b[0]); this.p = pul(CESTA_P, b[1]);
    this.el.appendChild(this.l); this.el.appendChild(this.p); obal.appendChild(this.el);
  }
  Znak.prototype.kresli = function (f) {
    var x = f.x * this.D;
    this.l.style.transform = 'translateX(' + (-x).toFixed(2) + 'px) rotateX(' + f.rl.toFixed(1) + 'deg)';
    this.p.style.transform = 'translateX(' + x.toFixed(2) + 'px) rotateX(' + f.rp.toFixed(1) + 'deg)';
    this.l.style.filter = f.jl === 1 ? '' : 'brightness(' + f.jl.toFixed(3) + ')';
    this.p.style.filter = f.jp === 1 ? '' : 'brightness(' + f.jp.toFixed(3) + ')';
    this.el.style.transform = f.m === 1 ? '' : 'scale(' + f.m.toFixed(4) + ')';
  };
  Znak.prototype.pulz = function (p) { this.kresli(SPOJENO); this.el.style.opacity = (1 - .55 * (.5 - .5 * Math.cos(2 * Math.PI * p))).toFixed(3); }; // bez pohybu: 1 → 0,45

  /* ---------- <spojka-nacitani> ---------- */
  var duchove = new Set();
  class Prvek extends HTMLElement {}

  Prvek.prototype.connectedCallback = function () {
    styly();
    if (this._sn) { this._sn.odpojeno = false; return; } // přesun v DOM
    var self = this, v = Math.max(16, Number(this.getAttribute('velikost')) || 72), barvy = this.getAttribute('barvy') || 'barevne';
    var st = this._sn = { v: v, barvy: barvy, naObrazovce: true, ukazano: false, start: performance.now(), stav: 'nacita', tecky: 0 };
    if (!this.hasAttribute('cela') && !this.hasAttribute('inline')) this.style.minHeight = (v + (v >= 48 ? 70 : 0)) + 'px';
    var koren0 = koren(this);
    st.box = document.createElement('div'); st.box.style.position = 'relative'; koren0.appendChild(st.box);
    st.znak = new Znak(st.box, v, barvy);
    st.maText = v >= 40 && this.getAttribute('text') !== '';
    if (st.maText) {
      st.text = document.createElement('div'); st.text.className = 'sn-text'; st.text.setAttribute('aria-hidden', 'true');
      st.t = document.createElement('span'); st.d = document.createElement('span'); st.d.className = 'sn-tecky'; st.d.setAttribute('aria-hidden', 'true');
      st.text.appendChild(st.t); st.text.appendChild(st.d); st.box.appendChild(st.text);
      st.akce = document.createElement('div'); st.akce.className = 'sn-akce';
      var znovu = document.createElement('button'); znovu.type = 'button'; znovu.textContent = 'Zkusit znovu';
      znovu.addEventListener('click', function () { var e = new CustomEvent('spojka-znovu', { bubbles: true, cancelable: true }); if (self.dispatchEvent(e)) location.reload(); });
      st.mail = document.createElement('a'); st.mail.textContent = 'Napsat správci';
      st.akce.appendChild(znovu); st.akce.appendChild(st.mail); st.box.appendChild(st.akce);
    }
    st.sr = document.createElement('span'); st.sr.className = 'sn-sr'; st.sr.setAttribute('role', 'status'); st.sr.setAttribute('aria-live', 'polite'); koren0.appendChild(st.sr);
    this.krok = function (p) { return self._krok(p); };
    this._texty();
    // navazuje na ducha ve stejném místě (stránka znak odebrala a hned přidala) → bez zpoždění, duch pryč
    var navazat = this.hasAttribute('ihned') || this.hasAttribute('ukazka');
    duchove.forEach(function (d) { if (d.cela === self.hasAttribute('cela')) { navazat = true; d.zrusit(); } });
    if (navazat) this._ukazat(); else st.casovac = setTimeout(function () { self._ukazat(); }, ZPOZDENI);
    if (io) io.observe(this);
    aktivni.add(this); rozbehnout();
  };
  Prvek.prototype._ukazat = function () {
    var st = this._sn; if (!st || st.ukazano) return;
    st.ukazano = true; st.ukazanoOd = performance.now(); this.classList.add('sn-ukazano');
    st.sr.textContent = online() ? 'Načítám data' : 'Bez spojení k internetu';
    rozbehnout(); pruhOffline();
  };
  Prvek.prototype._texty = function () {
    var st = this._sn, off = !online(); this.classList.toggle('sn-chyba', st.stav === 'chyba' && !off);
    if (!st.maText) return;
    if (this.getAttribute('ukazka') === 'offline') off = true;
    this.classList.toggle('sn-offline', off);
    var t = off ? (this.getAttribute('text-offline') || T_OFFLINE) : st.stav === 'chyba' ? T_CHYBA : st.stav === 'pomalu' ? T_POMALU : (this.getAttribute('text') || T_NACITANI);
    if (st.t.textContent !== t) st.t.textContent = t;
    st.d.style.display = off || st.stav === 'chyba' ? 'none' : '';
    if (st.stav === 'chyba') st.mail.href = 'mailto:' + SPRAVCE + '?subject=' + encodeURIComponent('Spojka: nepodařilo se načíst data') +
      '&body=' + encodeURIComponent('Obrazovka: ' + (document.title || '') + '\n' + location.href + '\nČas: ' + new Date().toLocaleString('cs-CZ') + '\nPřipojení: ' + (online() ? 'online' : 'offline') + '\n\nCo jsem dělal/a:\n');
  };
  // jeden snímek; vrací true, když má smyčka běžet dál
  Prvek.prototype._krok = function (p) {
    var st = this._sn; if (!st || st.odpojeno) return false;
    if (st.ukazano && st.naObrazovce !== false) {
      try { var r = this.getBoundingClientRect(); if (r.width) st.rect = r; } catch (e) {} // pro „ducha“ po odebrání
    }
    var ukazka = this.getAttribute('ukazka'), off = !online() || ukazka === 'offline';
    var ted = performance.now(), uplynulo = ted - st.start;
    if (online() && st.stav !== 'chyba' && ukazka == null) {
      var stav = uplynulo >= VZDAT ? 'chyba' : uplynulo >= POMALU ? 'pomalu' : 'nacita';
      if (stav !== st.stav) { st.stav = stav; this._texty(); if (stav === 'chyba') st.sr.textContent = T_CHYBA; }
    }
    if (st.maText && st.stav !== 'chyba' && !off) { var n = Math.floor(ted / TECKY) % 4; if (n !== st.tecky) { st.tecky = n; st.d.textContent = '...'.slice(0, n); } }
    if (off || st.stav === 'chyba') { st.znak.kresli(SPOJENO); st.znak.el.style.opacity = ''; return true; } // stojí; běží jen kvůli časům
    if (!st.ukazano || st.naObrazovce === false) return true;
    if (bezPohybu()) st.znak.pulz(p); else { st.znak.el.style.opacity = ''; st.znak.kresli(faze(p)); }
    return true;
  };
  Prvek.prototype.disconnectedCallback = function () {
    var st = this._sn; if (!st) return;
    st.odpojeno = true; clearTimeout(st.casovac); aktivni.delete(this); if (io) io.unobserve(this);
    var self = this;
    // přesun v DOM (connected hned zase) – nic; jinak úklid a případně dokončení „duchem“
    Promise.resolve().then(function () {
      if (self.isConnected) { self._sn.odpojeno = false; aktivni.add(self); if (io) io.observe(self); rozbehnout(); return; }
      var cela = self.hasAttribute('cela'), nastupce = null;
      aktivni.forEach(function (z) { if (z !== self && z._sn && !z._sn.ukazano && z.hasAttribute && z.hasAttribute('cela') === cela) nastupce = z; });
      if (nastupce && st.ukazano) nastupce._ukazat(); // stránka znak hned nahradila jiným – plynule pokračuje, bez ducha
      else if (st.ukazano && st.rect && online() && st.stav !== 'chyba' && !self.hasAttribute('ukazka')) duch(st, cela);
      self._sn = null; koren(self); pruhOffline();
    });
  };
  try { customElements.define('spojka-nacitani', Prvek); } catch (e) {}

  /* ---------- „duch“: po příchodu dat dokončí přiblížení a cvaknutí, pak zmizí ---------- */
  function duch(st, cela) {
    var el = document.createElement('div'), r = st.rect;
    el.className = 'sn-duch'; el.setAttribute('aria-hidden', 'true');
    if (cela) el.style.cssText = 'inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--color-bg,#f2f2f2)';
    else el.style.cssText = 'left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;display:flex;flex-direction:column;align-items:center;justify-content:center';
    var z = new Znak(el, st.v, st.barvy);
    if (st.maText) { var t = document.createElement('div'); t.className = 'sn-text'; t.textContent = st.t.textContent; el.appendChild(t); }
    var sr = document.createElement('span'); sr.className = 'sn-sr'; sr.setAttribute('role', 'status'); sr.setAttribute('aria-live', 'polite'); el.appendChild(sr);
    document.body.appendChild(el);
    var d = { cela: cela, konec: false, mizi: false };
    var odkdy = st.ukazanoOd, klid = bezPohybu(), sr2 = false;
    d.zrusit = function () { d.konec = true; aktivni.delete(d); duchove.delete(d); if (el.parentNode) el.parentNode.removeChild(el); };
    d.krok = function (p) {
      if (d.konec) return false;
      if (d.mizi) { z.kresli(SPOJENO); return true; }
      var hotovo = performance.now() - odkdy >= MIN && (klid || (p >= .6 && p < .66));
      if (hotovo) {
        d.mizi = true; z.kresli(SPOJENO); z.el.style.opacity = '';
        if (!sr2) { sr.textContent = 'Načteno'; sr2 = true; }
        el.style.opacity = '0'; setTimeout(d.zrusit, ZMIZENI + 30);
        return true;
      }
      if (klid) z.pulz(p); else z.kresli(faze(p));
      return true;
    };
    duchove.add(d); aktivni.add(d); rozbehnout();
    setTimeout(function () { if (!d.konec) { el.style.opacity = '0'; setTimeout(d.zrusit, ZMIZENI + 30); } }, MIN + PERIODA + 400); // pojistka (skrytá karta)
  }

  /* ---------- <spojka-kostra> – šedé obrysy řádků ---------- */
  class Kostra extends HTMLElement {}
  Kostra.prototype.connectedCallback = function () {
    styly();
    if (this._hotovo) return; this._hotovo = true;
    var n = Math.min(8, Math.max(1, Number(this.getAttribute('radky')) || 4)), sirky = [62, 48, 70, 55, 66, 44, 58, 50], h = '';
    for (var i = 0; i < n; i++) h += '<div class="sk-r"><span class="sk-s"><span class="sk-b" style="width:' + sirky[i % 8] + '%"></span><span class="sk-b" style="width:' + (sirky[(i + 3) % 8] - 18) + '%;height:9px"></span></span><span class="sk-b" style="width:72px;flex:none"></span></div>';
    var r = koren(this), d = document.createElement('div');
    d.innerHTML = '<span class="sn-sr" role="status">' + (this.getAttribute('text') || 'Načítám seznam').replace(/[<>&"]/g, '') + '</span><div aria-hidden="true">' + h + '</div>';
    while (d.firstChild) r.appendChild(d.firstChild);
  };
  try { customElements.define('spojka-kostra', Kostra); } catch (e) {}

  /* ---------- tlačítka: zakázané s textem „…“ dostanou znak ---------- */
  var BUSY = /…\s*$/;
  function tlacitka() {
    var b = document.querySelectorAll('button'), i, x, ma;
    for (i = 0; i < b.length; i++) { x = b[i]; ma = x.disabled && BUSY.test(x.textContent || '') && !/^Bez spojení/.test(x.textContent || '');
      if (ma && !x.hasAttribute('data-sn-busy')) x.setAttribute('data-sn-busy', ''); else if (!ma && x.hasAttribute('data-sn-busy')) x.removeAttribute('data-sn-busy'); }
  }
  var cekaTl = 0;
  function hlidatTlacitka() {
    if (typeof MutationObserver === 'undefined' || !document.body) return;
    new MutationObserver(function () { if (!cekaTl) cekaTl = requestAnimationFrame(function () { cekaTl = 0; tlacitka(); }); })
      .observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['disabled'] });
    tlacitka();
  }

  /* ---------- spojení: proužek nahoře ---------- */
  var pruh = null, pruhCas = 0, hlidam = null;
  function viditelnyZnak() { var v = false; aktivni.forEach(function (z) { if (z._sn && z._sn.ukazano && !z.hasAttribute('ukazka')) v = true; }); return v; }
  function ukazPruh(text, offline) {
    styly();
    if (!pruh) {
      pruh = document.createElement('div'); pruh.className = 'sn-pruh'; pruh.setAttribute('role', 'status'); pruh.setAttribute('aria-live', 'polite');
      var z = document.createElement('div'); z.style.cssText = 'width:20px;height:20px;flex:none;opacity:.35;filter:grayscale(1);background:currentColor;-webkit-mask:' + ZNAK_MASKA + ' center/contain no-repeat;mask:' + ZNAK_MASKA + ' center/contain no-repeat';
      pruh._z = z; pruh._t = document.createElement('span'); pruh.appendChild(z); pruh.appendChild(pruh._t); document.body.appendChild(pruh);
    }
    pruh._z.style.display = offline ? '' : 'none'; pruh._t.textContent = text;
    clearTimeout(pruhCas); requestAnimationFrame(function () { pruh.classList.add('sn-ukazano'); document.body.style.paddingTop = pruh.offsetHeight + 'px'; }); // obsah pod proužek, ať je vidět
  }
  function schovejPruh() { if (pruh) { pruh.classList.remove('sn-ukazano'); document.body.style.paddingTop = ''; } }
  // bez spojení: proužek jen když na stránce není znak načítání (ten hlášku ukazuje sám uprostřed)
  function pruhOffline() { if (!hlidam || online()) return; if (!viditelnyZnak()) ukazPruh(T_OFFLINE, true); else schovejPruh(); }
  function stavSpojeni(e) {
    aktivni.forEach(function (z) { if (z._texty && z._sn) { if (online()) { z._sn.start = performance.now(); z._sn.stav = 'nacita'; } z._texty(); } });
    rozbehnout();
    if (!hlidam) return;
    if (!online()) pruhOffline();
    else if (e && e.type === 'online') { ukazPruh(T_OBNOVENO, false); pruhCas = setTimeout(schovejPruh, 2000); if (hlidam.znovu) try { hlidam.znovu(); } catch (x) { console.error(x); } }
  }
  window.addEventListener('online', stavSpojeni); window.addEventListener('offline', stavSpojeni);

  window.SpojkaNacitani = {
    vytvor: function (o) {
      o = o || {}; var e = document.createElement('spojka-nacitani');
      e.setAttribute('velikost', String(o.velikost || 72)); if (o.barvy) e.setAttribute('barvy', o.barvy);
      if (o.text != null) e.setAttribute('text', o.text); if (o.textOffline) e.setAttribute('text-offline', o.textOffline);
      if (o.cela) e.setAttribute('cela', ''); if (o.ihned) e.setAttribute('ihned', ''); if (o.inline) e.setAttribute('inline', '');
      return e;
    },
    // proužek „Bez spojení…“ / „Spojení obnoveno“; znovu() = načíst data po obnovení spojení
    hlidatSpojeni: function (o) { hlidam = o || {}; if (document.body) stavSpojeni(); else document.addEventListener('DOMContentLoaded', function () { stavSpojeni(); }); },
    online: online
  };
  if (document.body) hlidatTlacitka(); else document.addEventListener('DOMContentLoaded', hlidatTlacitka);
})();
