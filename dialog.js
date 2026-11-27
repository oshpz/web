/* Dialog ve vzhledu Spojky / webu OSH místo systémových oken confirm, prompt a alert – jeden pro Spojku, web i test kandidáta.
 *   OshDialog({ text })                 → Promise<true | false>   (potvrzení)
 *   OshDialog({ text, pole: true, vychozi }) → Promise<text | null>  (dotaz s polem; null = Zpět)
 *   OshDialog({ text, jen: true })      → Promise<true>           (oznámení s jedním tlačítkem)
 * Text do prvního otazníku je nadpis, zbytek popis. Hlavní tlačítko se jmenuje podle slovesa otázky (Smazat, Zrušit, Poslat…, jinak Pokračovat),
 * druhé je vždy Zpět. Esc a klepnutí mimo = Zpět, Enter = potvrdit. Barvy bere z motivu stránky (data-theme), styl tlačítek ze styles.css. */
(function (koren) {
  let otevreny = null;
  koren.OshDialog = function (o) {
    o = o || {};
    if (typeof document === 'undefined') return Promise.resolve(o.pole ? null : !!o.jen);
    if (otevreny) otevreny(o.pole ? null : false); /* nikdy dva dialogy přes sebe */
    return new Promise(hotovo => {
      const el = (tag, styl, txt) => { const e = document.createElement(tag); if (styl) e.style.cssText = styl; if (txt != null) e.textContent = txt; return e; };
      const text = String(o.text == null ? '' : o.text), m = /^([^?\n]{1,140}\?)\s*([\s\S]*)$/.exec(text), nadpis = o.jen ? '' : m ? m[1] : (o.pole ? text : ''), zbytek = o.jen ? text : m ? m[2] : (o.pole ? '' : text);
      /* popisek hlavního tlačítka podle slovesa v otázce („Smazat „X“?“ → Smazat); druhé tlačítko je vždy Zpět („Zrušit“ by se pletlo s otázkou „Zrušit žádost?“) */
      const SLOVESA = ['Smazat', 'Zrušit', 'Odebrat', 'Zveřejnit', 'Zamítnout', 'Schválit', 'Poslat', 'Uzavřít', 'Otevřít', 'Hlasovat', 'Zapsat', 'Označit', 'Přepsat', 'Stáhnout', 'Rozřadit', 'Vylosovat', 'Odhlásit', 'Vyřadit', 'Potvrdit', 'Vytvořit', 'Ukončit', 'Připomenout', 'Vyhodnotit', 'Předat', 'Obnovit'];
      const sl = /^(?:Opravdu\s+)?(\S+)/.exec(text), ano = o.ano || (o.jen ? 'Rozumím' : o.pole ? 'Potvrdit' : sl && SLOVESA.indexOf(sl[1].charAt(0).toUpperCase() + sl[1].slice(1)) >= 0 ? sl[1].charAt(0).toUpperCase() + sl[1].slice(1) : 'Pokračovat');
      const tema = (document.querySelector('[data-screen-label="Navigace"]') || document.querySelector('[data-theme]') || document.body).getAttribute('data-theme') || '';
      const pred = document.activeElement, id = 'sp-dialog-' + Date.now();
      const obal = el('div', 'position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(32,46,69,.55);');
      obal.className = 'sp-dialog'; if (tema) obal.setAttribute('data-theme', tema);
      const okno = el('div', 'width:100%;max-width:460px;max-height:calc(100vh - 32px);overflow-y:auto;box-sizing:border-box;background:var(--color-bg,#f3f2ee);color:var(--color-text,#202e45);border:2px solid var(--color-text,#202e45);padding:22px 22px 18px;font-family:var(--font-body,Archivo,Arial,sans-serif);');
      okno.setAttribute('role', o.pole ? 'dialog' : 'alertdialog'); okno.setAttribute('aria-modal', 'true'); okno.setAttribute('aria-labelledby', id + '-n');
      const h = el('div', "font-family:var(--font-heading,Archivo,Arial,sans-serif);font-weight:800;font-size:19px;line-height:1.3;margin:0;overflow-wrap:anywhere;", nadpis || (o.jen ? '' : 'Potvrzení')); h.id = id + '-n'; if (h.textContent) okno.appendChild(h); else okno.setAttribute('aria-label', 'Oznámení');
      if (zbytek) { const p = el('div', 'font-size:' + (o.jen ? 16 : 15) + 'px;line-height:1.5;margin:' + (o.jen ? 0 : 10) + 'px 0 0;white-space:pre-line;overflow-wrap:anywhere;', zbytek); p.id = id + '-p'; okno.setAttribute('aria-describedby', p.id); okno.appendChild(p); }
      let pole = null;
      if (o.pole) { pole = el('input', 'display:block;width:100%;box-sizing:border-box;margin:14px 0 0;height:46px;padding:0 12px;font:inherit;font-size:16px;border:2px solid var(--color-text,#202e45);border-radius:0;background:#fff;color:inherit;');
        pole.type = 'text'; pole.value = o.vychozi == null ? '' : String(o.vychozi); pole.setAttribute('aria-labelledby', id + '-n'); pole.maxLength = 500; okno.appendChild(pole); }
      const rada = el('div', 'display:flex;flex-wrap:wrap;justify-content:flex-end;gap:10px;margin:20px 0 0;');
      const bZpet = el('button', 'min-height:44px;', o.ne || 'Zpět'); bZpet.type = 'button'; bZpet.className = 'btn btn-secondary';
      const bAno = el('button', 'min-height:44px;', ano); bAno.type = 'button'; bAno.className = 'btn btn-primary';
      if (!o.jen) rada.appendChild(bZpet); rada.appendChild(bAno); okno.appendChild(rada); obal.appendChild(okno);
      const zavrit = v => { if (otevreny !== zavrit) return; otevreny = null; document.removeEventListener('keydown', klavesa, true); obal.remove();
        try { if (pred && pred.focus && document.contains(pred)) pred.focus(); } catch (e) {} hotovo(v); };
      const ok = () => zavrit(pole ? pole.value : true), ne = () => zavrit(pole ? null : !!o.jen);
      const klavesa = e => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); ne(); }
        else if (e.key === 'Enter' && document.activeElement !== bZpet) { e.preventDefault(); e.stopPropagation(); ok(); }
        else if (e.key === 'Tab') { const f = [pole, o.jen ? null : bZpet, bAno].filter(Boolean), i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1) + f.length) % f.length].focus(); }
      };
      bAno.addEventListener('click', ok); bZpet.addEventListener('click', ne);
      obal.addEventListener('mousedown', e => { if (e.target === obal) ne(); });
      document.addEventListener('keydown', klavesa, true);
      otevreny = zavrit;
      document.body.appendChild(obal);
      if (pole) { pole.focus(); pole.select(); } else bAno.focus();
    });
  };
})(typeof window !== 'undefined' ? window : this);
