// Snímky jednotných seznamů (úkol 6) do docs/claude-design/seznamy/ – PC 1280 × 1000 a telefon 393 × 852 (mob-…).
// Spuštění: node nastroje/navody/server.cjs . &   a pak   node nastroje/navody/seznamy.mjs [jméno…]
// Pokaždé nový Chrome s čistým profilem na volném portu, mezipaměť vypnutá – žádná stará relace ani staré soubory.
import { spust } from './cdp.mjs';
import os from 'node:os';
import fs from 'node:fs';
import crypto from 'node:crypto';
const OUT = new URL('../../docs/claude-design/seznamy/', import.meta.url).pathname;
const N = 'http://localhost:18806/app.html';
const jen = process.argv.slice(2);
// [soubor, kdo, adresa, klik na záložku / tlačítko s textem, rozbalit 1. řádek tabulky]
const OBR = [
  // 1. vlna
  ['okres-kalendar', 'okres', 'okres/kalendar'], ['okres-dokumenty', 'okres', 'okres/dokumenty'], ['sbor-kalendar', 'sbor', 'sbor/sdh-ukazkov/kalendar'], ['sbor-dokumenty', 'sbor', 'sbor/sdh-ukazkov/dokumenty'],
  // 2. vlna
  ['okres-zadosti', 'okres', 'okres/zadosti'], ['okres-prispevky', 'okres', 'okres/prispevky'], ['okres-zmenysb', 'okres', 'okres/zmenysb'], ['okres-clenove', 'okres', 'okres/clenove'], ['okres-prestupy', 'okres', 'okres/prestupy'],
  ['sbor-zadosti', 'sbor', 'sbor/sdh-ukazkov/zadosti'], ['sbor-clenove', 'sbor', 'sbor/sdh-ukazkov/clenove'], ['sbor-prestupy', 'sbor', 'sbor/sdh-ukazkov/prestupy'],
  // 3. vlna
  ['okres-souteze', 'okres', 'okres/souteze'], ['okres-skoleni', 'okres', 'okres/skoleni'], ['okres-vv', 'okres', 'okres/vv'], ['okres-vypujcky', 'okres', 'okres/majetek/vypujcky'],
  ['sbor-prihlasky', 'sbor', 'sbor/sdh-ukazkov/prihlasky'], ['sbor-skoleni', 'sbor', 'sbor/sdh-ukazkov/skoleni'], ['sbor-vybaveni', 'sbor', 'sbor/sdh-ukazkov/vybaveni'],
  // 4. vlna – tabulky
  ['okres-kontakty', 'okres', 'okres/kontakty'], ['okres-majetek', 'okres', 'okres/majetek/majetek'], ['okres-osoby', 'okres', 'okres/majetek/osoby'], ['okres-zaznam', 'okres', 'okres/zaznam'],
  ['okres-clenovesez', 'okres', 'okres/clenovesez'], ['okres-clenovesez-clenove', 'okres', 'okres/clenovesez', 'Členové'], ['okres-kvalifikace', 'okres', 'okres/kvalifikace', '', true],
  ['okres-odvody', 'okres', 'okres/clenove', 'Odvody', true], ['sbor-seznam', 'sbor', 'sbor/sdh-ukazkov/seznam', '', true], ['sbor-kvalifikace', 'sbor', 'sbor/sdh-ukazkov/skoleni', 'Kvalifikace členů']
].filter(o => !jen.length || jen.includes(o[0]));
const port = 9500 + Math.floor(Math.random() * 400);
const b = await spust(port, fs.mkdtempSync(os.tmpdir() + '/osh-seznamy-'));
await b.cmd('Network.enable'); await b.cmd('Network.setCacheDisabled', { cacheDisabled: true });
const vypis = [];
for (const [mob, w, h] of [[false, 1280, 1000], [true, 393, 852]]) for (const [jm, kdo, hash, klik, radek] of OBR) {
  await b.okno(w, h, mob);
  await b.cmd('Page.navigate', { url: 'about:blank' }); await b.spi(200);
  await b.cmd('Page.navigate', { url: N + '?kdo=' + kdo + '&r=' + Date.now() + '#' + hash }); await b.spi(4000);
  if (klik) { await b.ev(`(Array.from(document.querySelectorAll('.sz-zalozka')).concat(Array.from(document.querySelectorAll('button'))).find(x => x.textContent.trim().startsWith(${JSON.stringify(klik)})) || { click() {} }).click()`); await b.spi(800); }
  if (radek) { await b.ev(`(document.querySelector('tr.sz-tab-r--klik') || { click() {} }).click()`); await b.spi(800); }
  const info = JSON.parse(await b.ev(`JSON.stringify({ chyba: (document.querySelector('.sc-logic-error') || {}).textContent || '', radku: document.querySelectorAll('.sz-radek,tr.sz-tab-r').length,
    sirka: document.documentElement.scrollWidth, h1: (document.querySelector('.sz-hlava h1') || {}).textContent || '' })`));
  const r = await b.cmd('Page.captureScreenshot', { format: 'jpeg', quality: 72 }), data = Buffer.from(r.result.data, 'base64'), soubor = (mob ? 'mob-' : '') + jm + '.jpg';
  fs.writeFileSync(OUT + soubor, data);
  const md5 = crypto.createHash('md5').update(data).digest('hex');
  vypis.push([soubor, md5, info]);
  console.log((info.chyba || info.sirka > w || !info.h1 ? 'POZOR ' : 'OK    ') + soubor.padEnd(34) + md5 + '  ' + info.h1 + ' · řádků ' + info.radku + (info.sirka > w ? ' · přetéká ' + info.sirka : '') + (info.chyba ? ' · ' + info.chyba : ''));
}
b.konec();
if (!jen.length) fs.writeFileSync(OUT + 'SNIMKY.md', '# Snímky seznamů (úkol 6)\n\nVyfoceno ' + new Date().toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' }) + ' skriptem `nastroje/navody/seznamy.mjs` ze smyšlených dat zkušebního serveru (čistý profil prohlížeče, bez mezipaměti). '
  + 'MD5 slouží ke kontrole, že čtete aktuální soubor.\n\n| Soubor | MD5 | Nadpis | Řádků |\n|---|---|---|---|\n' + vypis.map(([s, m, i]) => '| `' + s + '` | `' + m + '` | ' + i.h1 + ' | ' + i.radku + ' |').join('\n') + '\n');
process.exit(0);
