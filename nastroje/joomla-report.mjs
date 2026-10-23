#!/usr/bin/env node
/* B15 – podklady pro docs/migrace-aktualit.md z migrace/prispevky.json a migrace/report.json (výstup na stdout jako Markdown). */
import fs from 'node:fs';
import path from 'node:path';

const KOREN = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'), V = path.join(KOREN, 'migrace');
const radky = JSON.parse(fs.readFileSync(path.join(V, 'prispevky.json'), 'utf8')), rep = JSON.parse(fs.readFileSync(path.join(V, 'report.json'), 'utf8'));
const st = JSON.parse(fs.readFileSync(path.join(V, 'stazeno.json'), 'utf8'));
const MB = b => (b / 1048576).toFixed(1).replace('.', ',') + ' MB', cz = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const out = [], p = t => out.push(t);
const rok = r => String(r['Zveřejněno'] || '').slice(0, 4) || 'bez data';
const pocty = (f) => { const m = {}; radky.forEach(r => { const k = f(r); m[k] = (m[k] || 0) + 1; }); return m; };

p('## Rozsah'); p('');
p('| | Počet |'); p('| --- | --- |');
p('| Kategorie s články (kanály podle čísla kategorie) | ' + Object.values(rep.kategorie).filter(k => k.clanku).length + ' |');
p('| Články celkem (veřejně publikované) | ' + radky.length + ' |');
p('| z toho mimo kanály kategorií (dohledané podle čísla) | ' + Object.values(st.clanky).filter(c => c.mimoKanaly && c.status === 200).length + ' |');
p('| Požadavků na starý web (tento běh, bez mezipaměti) | ' + cz(st.pozadavku || 0) + ' |'); p('');

p('### Po letech'); p('');
const roky = pocty(rok); p('| Rok | Článků |'); p('| --- | --- |');
Object.keys(roky).sort().reverse().forEach(k => p('| ' + k + ' | ' + roky[k] + ' |')); p('');

p('### Po kategoriích a štítcích'); p('');
const kat = {}; radky.forEach(r => { const k = r.kategorie || '(bez kategorie)'; (kat[k] = kat[k] || { n: 0, s: r['Štítky'], cesta: '' }).n++; try { kat[k].cesta = kat[k].cesta || decodeURIComponent(new URL(r.puvodniUrl).pathname).replace(/\/\d+-[^/]*$/, ''); } catch (e) {} });
p('| Kategorie Joomly | Cesta na starém webu | Článků | Štítky |'); p('| --- | --- | --- | --- |');
Object.keys(kat).sort((a, b) => kat[b].n - kat[a].n).forEach(k => p('| ' + k + ' | `' + (kat[k].cesta || '–') + '` | ' + kat[k].n + ' | ' + kat[k].s + ' |')); p('');

const s = rep.statistika, fotky = radky.reduce((a, r) => a + r.fotky.length, 0), prilohy = radky.reduce((a, r) => a + r.prilohy.length, 0);
p('## Fotky a přílohy'); p('');
p('| | Počet | Velikost |'); p('| --- | --- | --- |');
p('| Fotky (zmenšené na 1600 px, JPEG bez EXIF/GPS) | ' + cz(fotky) + ' | ' + MB(s.fotekB) + ' (originály ' + MB(s.fotekPuvodneB) + ') |');
p('| Vynechané malé obrázky (pod 200 px) | ' + cz(s.vynechanoMalych) + ' | – |');
p('| Přílohy (PDF, DOC, XLS…) | ' + cz(prilohy) + ' | ' + MB(s.prilohB) + ' (unikátních ' + MB(s.prilohUnikB) + ') |');
p('| Články s aspoň jednou fotkou | ' + radky.filter(r => r.fotky.length).length + ' | |');
p('| Články s přílohou | ' + radky.filter(r => r.prilohy.length).length + ' | |'); p('');
const typy = {}; radky.forEach(r => r.prilohy.forEach(x => { const e = (x.n.split('.').pop() || '?').toLowerCase(); typy[e] = (typy[e] || 0) + 1; }));
p('Typy příloh: ' + Object.keys(typy).sort((a, b) => typy[b] - typy[a]).map(k => k + ' ' + typy[k]).join(', ') + '.'); p('');

p('## Články s problémy'); p('');
const druhy = {}; radky.forEach(r => r.problemy.forEach(x => { const d = x.split(':')[0].replace(/\s*\(\d+×\)/, ''); (druhy[d] = druhy[d] || []).push(r); }));
p('| Problém | Článků |'); p('| --- | --- |'); Object.keys(druhy).sort((a, b) => druhy[b].length - druhy[a].length).forEach(k => p('| ' + k + ' | ' + new Set(druhy[k]).size + ' |'));
p('| odkazy mimo web (aspoň jeden) | ' + radky.filter(r => r.odkazyMimoWeb).length + ' (celkem ' + radky.reduce((a, r) => a + r.odkazyMimoWeb, 0) + ' odkazů, z toho ' + radky.reduce((a, r) => a + r.odkazyHttp, 0) + ' převedeno z http na https) |');
p('| interní odkazy na staré články (přepsané na ?clanek=) | ' + radky.filter(r => r.interniOdkazy).length + ' (celkem ' + radky.reduce((a, r) => a + r.interniOdkazy, 0) + ') |'); p('');
p('<details><summary>Seznam článků s problémy</summary>'); p('');
const bezParam = t => t.replace(/(https?:\/\/[^\s?]+)\?[^\s)]*/g, '$1?…'); // parametry adres (např. webová pošta, ID účtů) do repozitáře nepatří
radky.filter(r => r.problemy.length).forEach(r => p('- **' + r.Titulek.replace(/\|/g, '/') + '** (' + rok(r) + ', `' + r.puvodniUrl.replace('https://www.oshpz.cz', '') + '`): ' + r.problemy.slice(0, 4).map(bezParam).join('; ') + (r.problemy.length > 4 ? ' … (+' + (r.problemy.length - 4) + ')' : '')));
p(''); p('</details>'); p('');

p('## Ukázka převedených článků'); p('');
const vzor = [radky.find(r => r.fotky.length >= 3 && r.Text.length > 600), radky.find(r => r.prilohy.length && /orgány/.test(r['Štítky'])), radky.find(r => r.interniOdkazy || r.odkazyMimoWeb > 1)].filter(Boolean);
vzor.forEach(r => { p('**' + r.Titulek + '** – ' + rok(r) + ', štítky ' + r['Štítky'] + ', adresa `?clanek=' + r.Adresa + '`, ' + r.fotky.length + ' fotek, ' + r.prilohy.length + ' příloh'); p('');
  p('> ' + r.Text.slice(0, 420).replace(/(https:\/\/[^\s)?]+)\?[^\s)]*/g, '$1').replace(/\n+/g, ' ⏎ ') + (r.Text.length > 420 ? ' …' : '')); p(''); }); // parametry odkazů pryč (ID účtů Google)

const disk = s.fotekB + s.prilohB;
p('## Odhad místa na Disku'); p('');
p('Fotky ' + MB(s.fotekB) + ' + přílohy ' + MB(s.prilohB) + ' = **' + MB(disk) + '** (při propojení shodných příloh s dokumenty orgánů méně; unikátní přílohy ' + MB(s.prilohUnikB) + '). Místo se počítá do úložiště Google Workspace okresu; sdílený disk unese až 400 000 položek, import přidá ' + cz(fotky + prilohy) + ' souborů a ' + cz(radky.filter(r => r.fotky.length || r.prilohy.length).length) + ' složek.');
console.log(out.join('\n'));
