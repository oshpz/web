// Snímky obrazovek do navody.html (assets/navody/*.jpg) – ze smyšlených dat (server.cjs: SDH Ukázkov, adresy example.com).
//   node nastroje/navody/server.cjs . &        (zkušební server na :18806)
//   node nastroje/navody/snimky.mjs [jméno…]   (bez jmen všechny; např. sbor-vybaveni okres-rezervace)
// Snímky soutěží okresu (okres-souteze, okres-soutez) vznikly ze skutečného kódu Souteze.gs nad daty v paměti – tady nejsou.
import { spust } from './cdp.mjs';
import os from 'node:os';
const OUT = new URL('../../assets/navody/', import.meta.url).pathname, N = 'http://localhost:18806/app.html', jen = process.argv.slice(2);
const b = await spust(9334, os.tmpdir() + '/osh-navody-profil');
const shot = async (jmeno, fn) => { if (jen.length && !jen.includes(jmeno)) return; try { await fn(); console.log('OK ' + jmeno); } catch (e) { console.log('CHYBA ' + jmeno + ': ' + e.message); } };
await b.okno(1100, 900);
// ---------- sbor
await shot('prihlaseni', async () => { await b.jdi(N + '?kdo=nikdo', 2500); await b.napis('input[type=email]', 'starosta@example.com'); await b.snimek(OUT + 'prihlaseni.jpg', { od: 'Přihlášení', vyska: 520 }); });
await shot('sbor-prehled', async () => { await b.jdi(N + '?kdo=sbor#sbor/sdh-ukazkov', 3500); await b.snimek(OUT + 'sbor-prehled.jpg', {}); });
await shot('sbor-mujsbor', async () => { await b.jdi(N + '?kdo=sbor#sbor/sdh-ukazkov/mujsbor', 3500); await b.snimek(OUT + 'sbor-mujsbor.jpg', {}); });
await shot('sbor-zadost', async () => { await b.okno(1100, 2000); await b.jdi(N + '?kdo=sbor#sbor/sdh-ukazkov/zadosti', 3500); await b.klik('Nová žádost');
  await b.napis('input[placeholder^="Např. Pohár"]', 'Den otevřených dveří'); await b.napis('input[type=date]', '2026-11-21'); await b.napis('input[placeholder^="Např. hřiště"]', 'Hasičská zbrojnice Ukázkov');
  await b.ev(`(() => { const l = Array.from(document.querySelectorAll('label')).find(x => /Pivní set/.test(x.textContent)); l && l.querySelector('input').click(); })()`); await b.spi(500);
  await b.snimek(OUT + 'sbor-zadost.jpg', { od: 'Nová žádost', vyska: 1180 }); await b.okno(1100, 900); });
await shot('sbor-vybaveni', async () => { await b.okno(1100, 2000); await b.jdi(N + '?kdo=sbor#sbor/sdh-ukazkov/vybaveni', 3500); await b.klik('Půjčit vybavení'); await b.napis('#vb-od', '2026-11-21'); await b.napis('#vb-do', '2026-11-22'); await b.napis('#vb-ucel', 'Výročí sboru'); await b.napis('#vb-misto', 'Hřiště Ukázkov');
  await b.ev(`(() => { const l = Array.from(document.querySelectorAll('label')).find(x => /Pivní set/.test(x.textContent)); l && l.querySelector('input').click(); })()`); await b.spi(500);
  await b.snimek(OUT + 'sbor-vybaveni.jpg', { od: 'Žádost o zápůjčku', vyska: 1000 }); await b.okno(1100, 900); });
await shot('sbor-souteze', async () => { await b.jdi(N + '?kdo=sbor#sbor/sdh-ukazkov/souteze', 3500); await b.snimek(OUT + 'sbor-souteze.jpg', {}); });
await shot('sbor-soutez', async () => { await b.jdi(N + '?kdo=sbor#sbor/sdh-ukazkov/soutez/A22', 3500); await b.snimek(OUT + 'sbor-soutez.jpg', {}); });
await shot('sbor-clenove', async () => { await b.jdi(N + '?kdo=sbor#sbor/sdh-ukazkov/clenove', 3500); await b.snimek(OUT + 'sbor-clenove.jpg', {}); });
await shot('sbor-prestupy', async () => { await b.jdi(N + '?kdo=sbor#sbor/sdh-ukazkov/prestupy', 3500); await b.snimek(OUT + 'sbor-prestupy.jpg', {}); });
await shot('sbor-seznam', async () => { await b.jdi(N + '?kdo=sbor#sbor/sdh-ukazkov/seznam', 3500); await b.snimek(OUT + 'sbor-seznam.jpg', {}); });
await shot('sbor-soupiska', async () => { await b.okno(1100, 1800); await b.jdi(N + '?kdo=sbor#sbor/sdh-ukazkov/soutez/A23', 3500); await b.klik('Naše družstva'); await b.klik('Přihlásit družstvo nebo závodníka');
  await b.napis('#sb-so-kat', 'starší'); await b.spi(600);
  for (const jm of ['Horáková', 'Kučerová', 'Procházka']) { await b.napis('#sb-sp-q', jm); await b.spi(300); await b.klik('Přidat'); }
  await b.napis('#sb-sp-q', ''); await b.spi(400);
  await b.snimek(OUT + 'sbor-soupiska.jpg', { od: 'Přihláška', vyska: 1250 }); await b.okno(1100, 900); });
// ---------- okres
await shot('okres-prehled', async () => { await b.jdi(N + '?kdo=okres#okres', 3500); await b.snimek(OUT + 'okres-prehled.jpg', {}); });
await shot('okres-zadost', async () => { await b.jdi(N + '?kdo=okres#okres/zadosti/Z101', 3500); await b.snimek(OUT + 'okres-zadost.jpg', {}); });
await shot('okres-dokumenty', async () => { await b.jdi(N + '?kdo=okres#okres/dokumenty', 3500); await b.snimek(OUT + 'okres-dokumenty.jpg', {}); });
await shot('okres-prispevky', async () => { await b.jdi(N + '?kdo=okres#okres/prispevky', 3500); await b.snimek(OUT + 'okres-prispevky.jpg', {}); });
await shot('okres-zmeny', async () => { await b.jdi(N + '?kdo=okres#okres/zmenysb/ZM5', 3500); await b.snimek(OUT + 'okres-zmeny.jpg', {}); });
await shot('okres-prihlasky', async () => { await b.jdi(N + '?kdo=okres#okres/clenove', 3500); await b.snimek(OUT + 'okres-prihlasky.jpg', {}); });
await shot('okres-rezervace', async () => { await b.jdi(N + '?kdo=okres#okres/majetek/vypujcky', 3500); await b.klik('Rezervace sborů'); await b.snimek(OUT + 'okres-rezervace.jpg', { od: 'Majetek a výpůjčky', vyska: 640 }); });
await shot('okres-clenove', async () => { await b.jdi(N + '?kdo=okres#okres/clenovesez', 3500); await b.snimek(OUT + 'okres-clenove.jpg', { od: 'Seznam členů', vyska: 560 }); });
b.konec(); process.exit(0);
