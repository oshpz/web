/* Hlášení chyb z webu a ze Spojky – jeden formulář pro obojí (server: akce chybaNahlasit, apps-script/Chyby.gs).
 *
 * Člověk napíše pár slov a může přidat snímek obrazovky (vyfotit kartu prohlížeče, vložit ze schránky Ctrl+V, nebo vybrat obrázek).
 * Technické údaje přidá stránka sama: adresa a obrazovka, prohlížeč, velikost okna, čas, poslední chyby skriptů a (ve Spojce) poslední
 * volání serveru. Co přesně se odešle, je ve formuláři vidět pod „Co se odešle automaticky“.
 *
 *   OshHlaseni.otevri({ kde: 'web' | 'aplikace', obrazovka: 'Kalendář', kontakt: 'e-mail přihlášeného' | '', prihlasen: true | false,
 *                       technicke: () => ({ role, sbor, rezim, volani, hlaska }), odeslat: data => Promise<{ id }> })
 *
 * Od načtení souboru se pamatuje posledních 10 chyb skriptů (window.onerror, unhandledrejection) – jen text a místo, žádná data stránky.
 * Staví se přímo v DOM mimo šablonu (jako dialog.js); barvy z motivu stránky, tlačítka ze styles.css. */
(function (koren) {
  if (typeof document === 'undefined') return;
  const chyby = [];
  const pridej = t => { const s = String(t || '').replace(/\s+/g, ' ').slice(0, 220); if (s && chyby[0] !== s) { chyby.unshift(s); chyby.length = Math.min(chyby.length, 10); } };
  const misto = (f, r) => f ? ' (' + String(f).split('/').pop().split('?')[0] + (r ? ':' + r : '') + ')' : '';
  koren.addEventListener('error', e => { if (e && e.message) pridej(e.message + misto(e.filename, e.lineno)); });
  koren.addEventListener('unhandledrejection', e => { const d = e && e.reason; pridej('Promise: ' + (d && d.message ? d.message : d)); });

  /* adresa bez tajných klíčů z osobních odkazů (?k=… u přihlášky a přestupu, #k=… u závodního panelu) */
  const adresa = () => String(location.href).replace(/([?&#]k=)[^&#]+/g, '$1…').slice(0, 480);

  /* obrázek (soubor, schránka, snímek karty) → JPEG do 1600 px, bez EXIF */
  const zmensit = zdroj => new Promise((ok, ko) => {
    const hotovo = (img, w, h) => { const m = Math.min(1, 1600 / Math.max(w, h)), c = document.createElement('canvas'); c.width = Math.round(w * m); c.height = Math.round(h * m);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); const u = c.toDataURL('image/jpeg', 0.82); ok({ mime: 'image/jpeg', base64: u.split(',')[1], nahled: u }); };
    if (zdroj instanceof HTMLVideoElement) return hotovo(zdroj, zdroj.videoWidth, zdroj.videoHeight);
    const url = URL.createObjectURL(zdroj), img = new Image();
    img.onload = () => { try { hotovo(img, img.naturalWidth, img.naturalHeight); } catch (e) { ko(e); } URL.revokeObjectURL(url); };
    img.onerror = () => { URL.revokeObjectURL(url); ko(new Error('Obrázek se nepodařilo načíst. Zkuste jiný formát (JPG nebo PNG).')); };
    img.src = url;
  });

  /* snímek karty prohlížeče: prohlížeč se zeptá, co sdílet; vezme se jediný obraz a sdílení hned skončí */
  const vyfotit = async obal => {
    const proud = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' }, audio: false, preferCurrentTab: true });
    try {
      obal.style.visibility = 'hidden'; // formulář na snímku nebude
      const v = document.createElement('video'); v.srcObject = proud; v.muted = true; await v.play();
      await new Promise(r => setTimeout(r, 450)); // okno výběru zmizí a stránka se překreslí
      return await zmensit(v);
    } finally { proud.getTracks().forEach(t => t.stop()); obal.style.visibility = ''; }
  };

  let otevrene = null, rozepsane = '';
  const otevri = o => {
    o = o || {};
    if (otevrene) return;
    const el = (tag, styl, txt) => { const e = document.createElement(tag); if (styl) e.style.cssText = styl; if (txt != null) e.textContent = txt; return e; };
    const tema = (document.querySelector('[data-screen-label="Navigace"]') || document.querySelector('[data-theme]') || document.body).getAttribute('data-theme') || '';
    const pred = document.activeElement, web = o.kde !== 'aplikace';
    const tech = () => { let t = {}; try { t = (o.technicke && o.technicke()) || {}; } catch (e) {}
      return Object.assign({ prostredi: (koren.OSH_CONFIG || {}).prostredi || '', cas: new Date().toISOString(), prohlizec: navigator.userAgent,
        okno: innerWidth + ' × ' + innerHeight + ' px, hustota ' + (koren.devicePixelRatio || 1), jazyk: navigator.language || '', online: navigator.onLine === false ? 'ne' : 'ano', chyby: chyby.slice() }, t); };
    const techText = () => { const t = tech(); return ['adresa: ' + adresa(), 'obrazovka: ' + (o.obrazovka || document.title)].concat(Object.keys(t).filter(k => t[k] != null && t[k] !== '' && !(Array.isArray(t[k]) && !t[k].length))
      .map(k => k + ': ' + (Array.isArray(t[k]) ? t[k].join(' | ') : t[k]))).join('\n'); };

    const obal = el('div', 'position:fixed;inset:0;z-index:1000;display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow-y:auto;background:rgba(32,46,69,.55);');
    obal.className = 'sp-hlaseni'; if (tema) obal.setAttribute('data-theme', tema);
    const okno = el('div', 'width:100%;max-width:560px;margin:auto 0;box-sizing:border-box;background:var(--color-bg,#f3f2ee);color:var(--color-text,#202e45);border:2px solid var(--color-text,#202e45);padding:22px;font-family:var(--font-body,Archivo,Arial,sans-serif);font-size:15px;line-height:1.5;');
    okno.setAttribute('role', 'dialog'); okno.setAttribute('aria-modal', 'true'); okno.setAttribute('aria-labelledby', 'sp-hl-nadpis');
    const POLE = 'display:block;width:100%;box-sizing:border-box;font:inherit;font-size:16px;border:2px solid var(--color-text,#202e45);border-radius:0;background:#fff;color:inherit;';
    const POPISEK = 'display:block;font-weight:700;font-size:14px;margin:16px 0 6px;';
    const h = el('div', 'font-family:var(--font-heading,Archivo,Arial,sans-serif);font-weight:800;font-size:21px;line-height:1.25;margin:0 0 6px;', 'Nahlásit chybu'); h.id = 'sp-hl-nadpis';
    const uvod = el('div', 'margin:0;', 'Napište pár slov, co se stalo. Kde to bylo a v jakém prohlížeči, k tomu přidáme sami.');
    const lPopis = el('label', POPISEK, 'Co se stalo a co jste čekali?'); lPopis.htmlFor = 'sp-hl-popis';
    const popis = el('textarea', POLE + 'min-height:120px;padding:10px 12px;resize:vertical;'); popis.id = 'sp-hl-popis'; popis.maxLength = 3000; popis.value = rozepsane;
    popis.placeholder = web ? 'Např.: Na stránce sboru se neukazuje mapa.' : 'Např.: Po uložení žádosti se seznam neobnovil.';

    const lKont = el('label', POPISEK, 'Váš e-mail (nepovinné – když chcete odpověď)'); lKont.htmlFor = 'sp-hl-kontakt';
    const kont = el('input', POLE + 'height:46px;padding:0 12px;'); kont.id = 'sp-hl-kontakt'; kont.type = 'email'; kont.autocomplete = 'email'; kont.maxLength = 120;
    const kdoRadek = el('div', 'margin:14px 0 0;font-size:14px;', o.kontakt ? 'Odpověď pošleme na ' + o.kontakt + '.' : '');

    /* snímek obrazovky */
    let snimek = null;
    const lSn = el('div', POPISEK, 'Snímek obrazovky (nepovinné)');
    const radaSn = el('div', 'display:flex;flex-wrap:wrap;gap:8px;align-items:center;');
    const umiFotit = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) && !(koren.matchMedia && koren.matchMedia('(pointer: coarse)').matches);
    const bFot = el('button', 'min-height:44px;', 'Vyfotit tuto stránku'); bFot.type = 'button'; bFot.className = 'btn btn-secondary';
    const bSoub = el('button', 'min-height:44px;', umiFotit ? 'Vybrat obrázek' : 'Přiložit snímek nebo fotku'); bSoub.type = 'button'; bSoub.className = 'btn btn-secondary';
    const vstup = el('input', 'display:none;'); vstup.type = 'file'; vstup.accept = 'image/*'; vstup.setAttribute('aria-label', 'Obrázek ke hlášení');
    const napSn = el('div', 'font-size:13px;margin:6px 0 0;opacity:.85;', umiFotit ? 'Po kliknutí na „Vyfotit“ se prohlížeč zeptá, co sdílet – vyberte tuto kartu. Hotový snímek z klávesy PrtSc jde vložit i přes Ctrl+V.'
      : 'Na telefonu nejdřív udělejte snímek obrazovky tlačítky telefonu a tady ho vyberte z galerie.');
    const nahled = el('div', 'display:none;margin:10px 0 0;gap:12px;align-items:flex-start;');
    const img = el('img', 'max-width:220px;max-height:160px;border:2px solid var(--color-text,#202e45);background:#fff;display:block;'); img.alt = 'Náhled přiloženého snímku';
    const bPryc = el('button', 'min-height:44px;', 'Odebrat snímek'); bPryc.type = 'button'; bPryc.className = 'btn btn-ghost';
    nahled.appendChild(img); nahled.appendChild(bPryc);
    const pozor = el('div', 'display:none;font-size:13px;margin:8px 0 0;', 'Na snímku je vidět vše, co máte na stránce – i jména a údaje. Uvidí ho jen správci aplikace.');
    const nastavSnimek = s => { snimek = s; nahled.style.display = s ? 'flex' : 'none'; pozor.style.display = s ? 'block' : 'none'; if (s) img.src = s.nahled; };
    const chybaEl = el('div', 'display:none;margin:14px 0 0;border-left:4px solid var(--color-action,#b30410);padding:8px 12px;font-size:14.5px;'); chybaEl.setAttribute('role', 'alert');
    const ukazChybu = t => { chybaEl.style.display = t ? 'block' : 'none'; chybaEl.textContent = t || ''; };
    const zObrazku = z => zmensit(z).then(s => { nastavSnimek(s); ukazChybu(''); }).catch(e => ukazChybu(e.message || 'Obrázek se nepodařilo zpracovat.'));
    bFot.addEventListener('click', () => vyfotit(obal).then(s => { nastavSnimek(s); ukazChybu(''); }).catch(e => { if (e && e.name !== 'NotAllowedError' && e.name !== 'AbortError') ukazChybu('Stránku se nepodařilo vyfotit. Použijte klávesu PrtSc a vložte snímek přes Ctrl+V, nebo vyberte obrázek.'); }));
    bSoub.addEventListener('click', () => vstup.click());
    vstup.addEventListener('change', () => { const f = vstup.files && vstup.files[0]; vstup.value = ''; if (!f) return; if (f.size > 15 * 1024 * 1024) return ukazChybu('Obrázek je větší než 15 MB.'); zObrazku(f); });
    bPryc.addEventListener('click', () => nastavSnimek(null));
    const vlozeni = e => { const f = Array.from((e.clipboardData && e.clipboardData.files) || []).find(x => /^image\//.test(x.type)); if (f) { e.preventDefault(); zObrazku(f); } };
    if (umiFotit) radaSn.appendChild(bFot); radaSn.appendChild(bSoub); radaSn.appendChild(vstup);

    /* co se odešle automaticky */
    const det = el('details', 'margin:16px 0 0;font-size:14px;'), sum = el('summary', 'cursor:pointer;font-weight:700;min-height:32px;', 'Co se odešle automaticky');
    const pre = el('pre', 'margin:8px 0 0;padding:10px 12px;background:#fff;border:1px solid var(--color-neutral-500,#8a8f99);font:12.5px/1.5 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;max-height:200px;overflow-y:auto;');
    det.appendChild(sum); det.appendChild(pre); det.addEventListener('toggle', () => { if (det.open) pre.textContent = techText(); });

    const rada = el('div', 'display:flex;flex-wrap:wrap;justify-content:flex-end;gap:10px;margin:22px 0 0;');
    const bZpet = el('button', 'min-height:44px;', 'Zpět'); bZpet.type = 'button'; bZpet.className = 'btn btn-secondary';
    const bOk = el('button', 'min-height:44px;', 'Odeslat hlášení'); bOk.type = 'button'; bOk.className = 'btn btn-primary';
    rada.appendChild(bZpet); rada.appendChild(bOk);
    [h, uvod, lPopis, popis].forEach(x => okno.appendChild(x));
    if (!o.prihlasen) { okno.appendChild(lKont); okno.appendChild(kont); } else if (o.kontakt) okno.appendChild(kdoRadek);
    [lSn, radaSn, napSn, nahled, pozor, det, chybaEl, rada].forEach(x => okno.appendChild(x));
    obal.appendChild(okno);

    const zavrit = () => { if (!otevrene) return; rozepsane = popis.value; otevrene = null; document.removeEventListener('keydown', klavesa, true); document.removeEventListener('paste', vlozeni, true); obal.remove();
      try { if (pred && pred.focus && document.contains(pred)) pred.focus(); } catch (e) {} };
    const klavesa = e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); zavrit(); }
      else if (e.key === 'Tab') { const f = Array.from(okno.querySelectorAll('textarea, input:not([type=file]), button, summary, a[href]')).filter(x => x.offsetParent !== null && !x.disabled); if (!f.length) return;
        const i = f.indexOf(document.activeElement); if (e.shiftKey ? i <= 0 : i === f.length - 1) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); } }
    };
    const hotovo = id => { rozepsane = ''; okno.textContent = '';
      const n = el('div', 'font-family:var(--font-heading,Archivo,Arial,sans-serif);font-weight:800;font-size:21px;line-height:1.25;margin:0 0 8px;', 'Děkujeme, hlášení jsme přijali'); n.id = 'sp-hl-nadpis'; n.setAttribute('role', 'status');
      const t = el('div', '', 'Číslo hlášení: ' + id + '. ' + (kont.value.trim() || o.kontakt ? 'Když budeme potřebovat něco upřesnit, ozveme se e-mailem.' : 'Podíváme se na to.'));
      const r = el('div', 'display:flex;justify-content:flex-end;margin:22px 0 0;'), b = el('button', 'min-height:44px;', 'Zavřít'); b.type = 'button'; b.className = 'btn btn-primary'; b.addEventListener('click', zavrit);
      r.appendChild(b); [n, t, r].forEach(x => okno.appendChild(x)); b.focus(); };
    const odeslat = () => {
      const p = popis.value.trim(), k = o.prihlasen ? '' : kont.value.trim();
      if (p.length < 5) { ukazChybu('Napište prosím aspoň pár slov, co se stalo.'); popis.focus(); return; }
      if (k && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(k)) { ukazChybu('E-mail nemá správný tvar. Opravte ho, nebo pole nechte prázdné.'); kont.focus(); return; }
      if (!o.odeslat) return;
      ukazChybu(''); bOk.disabled = true; bZpet.disabled = true; bOk.textContent = 'Odesílám…';
      const data = { popis: p, kontakt: k, kde: web ? 'web' : 'aplikace', obrazovka: String(o.obrazovka || document.title).slice(0, 200), adresa: adresa(), technicke: tech(), snimek: snimek ? { mime: snimek.mime, base64: snimek.base64 } : null };
      Promise.resolve().then(() => o.odeslat(data)).then(j => hotovo((j && j.id) || ''), e => {
        bOk.disabled = false; bZpet.disabled = false; bOk.textContent = 'Odeslat hlášení';
        const adr = 'spravci@oshpz.cz', telo = p + '\n\n---\n' + techText();
        chybaEl.style.display = 'block'; chybaEl.textContent = ((e && e.message) || 'Hlášení se nepodařilo odeslat.') + ' Text zůstal vyplněný – zkuste to znovu, nebo ho ';
        const a = el('a', '', 'pošlete e-mailem'); a.href = 'mailto:' + adr + '?subject=' + encodeURIComponent('Hlášení chyby – ' + (web ? 'web' : 'Spojka')) + '&body=' + encodeURIComponent(telo.slice(0, 1800));
        chybaEl.appendChild(a); chybaEl.appendChild(document.createTextNode('.'));
      });
    };
    bOk.addEventListener('click', odeslat); bZpet.addEventListener('click', zavrit);
    obal.addEventListener('mousedown', e => { if (e.target === obal && !popis.value.trim() && !snimek) zavrit(); }); // rozepsané hlášení klepnutí mimo nezavře
    document.addEventListener('keydown', klavesa, true); document.addEventListener('paste', vlozeni, true);
    otevrene = zavrit;
    document.body.appendChild(obal);
    popis.focus();
  };

  koren.OshHlaseni = { otevri, chyby: () => chyby.slice() };
})(typeof window !== 'undefined' ? window : this);
