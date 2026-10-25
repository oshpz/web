// Malý ovladač Chrome přes DevTools protokol (Node 22+ má WebSocket vestavěný) – klik, vyplnění pole, výřez snímku. Pro nastroje/navody/snimky.mjs.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const CH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export async function spust(port = 9333, profil) {
  const p = spawn(CH, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=' + port, '--user-data-dir=' + profil, 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { const r = await fetch('http://127.0.0.1:' + port + '/json/version'); if (r.ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 200)); }
  const t = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).find(x => x.type === 'page');
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const cek = {};
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && cek[m.id]) { cek[m.id](m); delete cek[m.id]; } };
  const cmd = (method, params = {}) => new Promise((r, j) => { const i = ++id; const t = setTimeout(() => j(new Error('timeout ' + method)), 20000); cek[i] = m => { clearTimeout(t); r(m); }; ws.send(JSON.stringify({ id: i, method, params })); });
  const spi = ms => new Promise(r => setTimeout(r, ms));
  const ev = async (expr) => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result && r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return r.result && r.result.result && r.result.result.value; };
  const api = {
    cmd, ev, spi,
    async okno(w, h, mobil) { await cmd('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobil }); },
    async jdi(url, cekat = 3000) { await cmd('Page.navigate', { url }); await spi(cekat); },
    // klik na tlačítko / odkaz podle textu (začátek)
    async klik(text, sel = 'button, a, [role=tab]') { const ok = await ev(`(() => { const b = Array.from(document.querySelectorAll(${JSON.stringify(sel)})).filter(x => x.offsetParent).find(x => x.textContent.trim().indexOf(${JSON.stringify(text)}) === 0); if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true; })()`); if (!ok) throw new Error('nenalezeno: ' + text); await spi(700); },
    // vyplnění pole (nativní setter kvůli React-like runtime)
    async napis(sel, val) { const ok = await ev(`(() => { const i = document.querySelector(${JSON.stringify(sel)}); if (!i) return false; const proto = i.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : i.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(i, ${JSON.stringify(val)}); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`); if (!ok) throw new Error('pole nenalezeno: ' + sel); await spi(500); },
    // snímek: celé okno od prvku (top) do výšky h, nebo výřez prvku
    async snimek(soubor, { od, vyska, prvek, sirka } = {}) {
      await ev(`window.scrollTo(0, 0)`); await spi(200);
      let clip;
      if (prvek || od) { const r = await ev(`(() => { const e = ${prvek ? `document.querySelector(${JSON.stringify(prvek)})` : `Array.from(document.querySelectorAll('h1,h2,h3,b,button,a,span,p')).filter(x => x.offsetParent).find(x => x.textContent.trim().indexOf(${JSON.stringify(od || '')}) === 0)`}; if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height }; })()`);
        if (!r) throw new Error('prvek pro snímek nenalezen: ' + (prvek || od));
        const m = await ev(`({ w: document.documentElement.clientWidth })`);
        clip = prvek ? { x: Math.max(0, r.x - 12), y: Math.max(0, r.y - 12), width: Math.min(m.w, r.w + 24), height: (vyska || r.h + 24), scale: 1 } : { x: 0, y: Math.max(0, r.y - 16), width: sirka || m.w, height: vyska || 700, scale: 1 };  const y0 = Math.max(0, clip.y); await ev(`window.scrollTo(0, ${y0})`); await spi(400); const sy = await ev('scrollY'); clip.y = sy + (y0 - sy); }
      const r = await cmd('Page.captureScreenshot', Object.assign({ format: 'jpeg', quality: 82, captureBeyondViewport: false }, clip ? { clip } : {}));
      fs.writeFileSync(soubor, Buffer.from(r.result.data, 'base64'));
    },
    konec() { ws.close(); p.kill(); }
  };
  await cmd('Page.enable'); await cmd('Runtime.enable');
  return api;
}
