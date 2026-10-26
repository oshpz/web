#!/usr/bin/env node
/*
 * G4 – generovaná část docs/rozhrani.md (popis rozhraní aplikace ↔ server) přímo z kódu apps-script/*.gs.
 *
 *   node nastroje/rozhrani.mjs             – přepíše generované bloky v docs/rozhrani.md (mezi <!-- GEN:… --> a <!-- /GEN:… -->)
 *   node nastroje/rozhrani.mjs --kontrola  – nic nepíše; kód 1 = dokument neodpovídá kódu, 2 = aplikace / web / panel volá akci, kterou server nezná
 *                                            (spouští ho ./nasadit.sh server – při 2 nenasadí, při 1 jen upozorní)
 *
 * Spouštět po každé změně API (nová akce, parametr, list, klíč Nastavení, časovač). Ručně psaný text mimo bloky GEN zůstává.
 * Rozbor je jednoduchý (regulární výrazy nad zvyklostmi kódu): rozcestník doPostAkce_ → apiX_(req) → větev podle req.akce → funkce.
 * Kdo smí volat se čte ze stráží (prihlaseny_, role['…'], smi…_(o), pohledSboru_) – rozhoduje vždy kód serveru, tabulka je přehled.
 */
import fs from 'node:fs';
import path from 'node:path';

const KOREN = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DOK = path.join(KOREN, 'docs/rozhrani.md');
const kontrola = process.argv.includes('--kontrola');

/* ---------- načtení kódu ---------- */
const soubory = d => fs.readdirSync(path.join(KOREN, d)).filter(f => f.endsWith('.gs')).sort().map(f => ({ f: d + '/' + f, t: fs.readFileSync(path.join(KOREN, d, f), 'utf8') }));
const GS = soubory('apps-script'), SKUPINY = soubory('skupiny-script');
const FN = {}; // jméno → { soubor, parametry, telo, popis }
GS.forEach(({ f, t }) => {
  const radky = t.split('\n');
  radky.forEach((r, i) => {
    const m = r.match(/^function (\w+)\s*\(([^)]*)\)/);
    if (!m) return;
    let j = i; while (j < radky.length && !(j > i && /^}/.test(radky[j])) && !(j === i && /}\s*$/.test(r) && /\{.*\}\s*$/.test(r))) j++;
    // popis: souvislý blok komentáře těsně nad funkcí
    let k = i - 1, kom = [];
    while (k >= 0 && /^\s*(\/\/|\/?\*|\*\/)/.test(radky[k])) kom.unshift(radky[k--]);
    const popis = kom.join(' ').replace(/\/\*\*?|\*\/|^\s*\*|\s\*\s|\/\//g, ' ').replace(/\s+/g, ' ').trim();
    FN[m[1]] = { soubor: f, par: m[2].split(',').map(s => s.trim()), telo: radky.slice(i, j + 1).join('\n'), popis };
  });
});
const VSE = GS.map(x => x.t).join('\n');
const KONST = {}; // LIST_X → 'Název listu'
for (const m of VSE.matchAll(/\b(LIST_\w+)\s*=\s*'([^']+)'/g)) KONST[m[1]] = m[2];
const strukt = fs.readFileSync(path.join(KOREN, 'apps-script/OSH-data-struktura.gs'), 'utf8');
const LISTY = []; // { nazev, sloupce }
strukt.slice(0, strukt.indexOf('\n];')).split(/\{ nazev: '/).slice(1).forEach(c => LISTY.push({ nazev: c.slice(0, c.indexOf("'")), sloupce: [...c.matchAll(/(?:^\s*|\]\s*,\s*|sloupce:\s*\[\s*)\[\s*'([^']+)'/gm)].map(x => x[1]) }));
const JMENA_LISTU = new Set(LISTY.map(l => l.nazev).concat(Object.values(KONST), ['Záznam změn', 'Členství skupin', 'Nastavení']));
JMENA_LISTU.delete('Majetek'); // list Majetek v OSH data se nepoužívá – 'Majetek' v kódu je list v tabulkách Evidence majetku

/* ---------- rozbor jedné větve ---------- */
const POMOCNE = new Set(['prihlaseny_', 'json_', 'kontrolaTextu_', 'kontrolaVolby_', 'kontrolaData_', 'kontrolaOdkazu_', 'bezVzorce_', 'nastaveniWeb_', 'mer_', 'otisk_', 'normEmail_', 'ano_', 'limit_',
  'zaznamZmeny_', 'zaznamZmenyHromadne_', 'pohledSboru_', 'radky_', 'radkyRychle_', 'dataSs_', 'hlavicka_', 'vycistitCache_', 'vycistitMezipamet_', 'ostryRezim_', 'posta_', 'smiVidet_']);
const volane = text => [...new Set([...text.replace(/^function \w+/, '').matchAll(/\b([a-zA-Z]\w*_)\(/g)].map(m => m[1]).filter(n => FN[n] && !POMOCNE.has(n)))];
/** Funkce dosažitelné z textu (do hloubky). */
function dosah(text, hloubka) {
  const nalez = new Set(), fronta = volane(text).map(n => [n, 1]);
  while (fronta.length) {
    const [n, h] = fronta.shift();
    if (nalez.has(n)) continue; nalez.add(n);
    if (h < hloubka) volane(FN[n].telo).forEach(x => fronta.push([x, h + 1]));
  }
  return [...nalez];
}
const ZAPIS = /\b(appendRow|setValues?|deleteRows?|insertRows?\w*|clearContent)\(/;
const OBJ_LISTU = {}; // const KAL_LISTY = { 'Akce': …, 'Termíny': … } → názvy listů
for (const m of VSE.matchAll(/^const (\w+) = \{([^;]*?)\};/gms)) { const k = [...m[2].matchAll(/(?:^|[{,])\s*'?([^':,{}\n]+?)'?\s*:/gm)].map(x => x[1].trim()).filter(x => JMENA_LISTU.has(x)); if (k.length) OBJ_LISTU[m[1]] = k; }
/** Listy zmíněné v textu; jenOtevrene = jen ty, které se otevírají jako list (ne radky_() / radkyRychle_(), ty jen čtou). */
function listyV(t, jenOtevrene) {
  const out = new Set(), cteni = i => /radky(Rychle)?_\(\s*$/.test(t.slice(Math.max(0, i - 16), i));
  for (const m of t.matchAll(/\b(LIST_\w+)\b/g)) if (KONST[m[1]] && !(jenOtevrene && cteni(m.index))) out.add(KONST[m[1]]);
  if (!jenOtevrene) for (const k in OBJ_LISTU) if (new RegExp('\\b' + k + '\\b').test(t)) OBJ_LISTU[k].forEach(l => out.add(l));
  for (const m of t.matchAll(/'([^'\n]{3,40})'/g)) if (JMENA_LISTU.has(m[1]) && t[m.index - 1] !== '[' && !/\bcase\s*$|===\s*$/.test(t.slice(m.index - 8, m.index)) && !(jenOtevrene && cteni(m.index))) out.add(m[1]);
  return [...out];
}
const SLUZBY = [['e-mail', /\b(GmailApp|MailApp|posta_\(|poslat\w*_\()/], ['Disk', /\b(DriveApp|Drive\.(Files|Permissions))/], ['Kalendář', /\b(CalendarApp|kalendar_\(|syncRadek_\()/],
  ['Skupiny', /\bAdminDirectory\b/], ['Turnstile', /\bturnstile/i], ['GitHub', /api\.github\.com|publikovatStatickaData_/], ['Evidence majetku', /\b(mjList_|mjDataCache_|mjSoubor_)\(/]];
function rozbor(text) {
  const fns = dosah(text, 3), vse = [text].concat(fns.map(n => FN[n].telo)).join('\n');
  const listy = new Set(), zapisListy = new Set();
  [text].concat(fns.map(n => FN[n].telo)).forEach(t => {
    const moje = listyV(t);
    moje.forEach(l => listy.add(l));
    // zápis: funkce s appendRow / setValue… zapisuje do listů, které sama zmiňuje nebo načítá přes přímo volanou funkci
    const zapisuje = ZAPIS.test(t) || volane(t).some(n => ZAPIS.test(FN[n].telo) && !listyV(FN[n].telo, true).length); // i zápis přes pomocnou funkci, která dostane list parametrem (prZapsat_(t, …))
    if (zapisuje) listyV(t, true).concat(...volane(t).filter(n => !ZAPIS.test(FN[n].telo)).map(n => listyV(FN[n].telo, true))).forEach(l => zapisListy.add(l));
  });
  if (/zaznamZmeny\w*_\(/.test(vse)) { listy.add('Záznam změn'); zapisListy.add('Záznam změn'); }
  const sluzby = SLUZBY.filter(([, re]) => re.test(vse)).map(([n]) => n);
  // parametry: req.x v textu větve a ve funkcích, které dostávají req
  const par = new Set();
  [text].concat(fns.filter(n => FN[n].par.includes('req')).map(n => FN[n].telo)).forEach(t => { for (const m of t.matchAll(/\breq\.(\w+)/g)) par.add(m[1]); });
  ['akce', 'token', 'klic'].forEach(x => par.delete(x));
  // omezení: kontrolaTextu_(…, { 'Pole': 200 })
  const limity = new Set();
  [text].concat(fns.slice(0, 6).map(n => FN[n].telo)).forEach(t => { for (const m of t.matchAll(/kontrolaTextu_\([^{]*\{([^}]*)\}/g)) for (const x of m[1].matchAll(/'?([^':,{}]+?)'?\s*:\s*(\d+)/g)) limity.add(x[1].trim() + ' ≤ ' + x[2]); });
  // výstup: klíče objektu v return { ok: true, … }
  const klice = new Set();
  [text].concat(fns.slice(0, 4).map(n => FN[n].telo)).forEach(t => {
    for (const m of t.matchAll(/(return|\?)\s*\{\s*ok:\s*true\b/g)) {
      let d = 0, i = m.index + t.slice(m.index).indexOf('{'), z = i, buf = '';
      for (; i < t.length; i++) { const c = t[i]; if ('{(['.includes(c)) d++; else if ('})]'.includes(c)) { d--; if (!d) break; } if (d === 1) buf += c; else if (d === 2 && '{(['.includes(c)) buf += ' '; }
      for (const k of buf.slice(1).split(',')) { const x = k.trim().match(/^(\w+)\s*(:|$)/); if (x && x[1] !== 'ok') klice.add(x[1]); }
      if (z < 0) break;
    }
  });
  const chyby = [...new Set([...[text].concat(fns.slice(0, 3).map(n => FN[n].telo)).join('\n').matchAll(/chyba:\s*'([^']{6,})'/g)].map(m => m[1]))].filter(c => !/^Nepřihlášen$|^Neznámá akce$/.test(c));
  const zapis = zapisListy.size > 0 || /\b(createFile|setTrashed|addPermission|Permissions\.create|createEvent|Members\.(insert|remove))\b/.test(vse);
  const tridit = s => [...s].sort((a, b) => a.localeCompare(b, 'cs'));
  return { fns, listy: tridit(listy), zapisListy: tridit(zapisListy), sluzby, par: [...par], limity: [...limity], klice: [...klice], chyby, zapis };
}

/* ---------- kdo smí volat ---------- */
const smiRole = (n, byl = new Set()) => { if (byl.has(n)) return []; byl.add(n); const t = (FN[n] || {}).telo || ''; const r = [...t.matchAll(/role\['([^']+)'\]/g)].map(m => m[1]); volane(t).filter(x => /^smi/.test(x) || /Role_$/.test(x)).forEach(x => r.push(...smiRole(x, byl))); return r; };
function kdo(disp, akce) {
  const t = FN[disp].telo;
  if (!/prihlaseny_\(/.test(t) && /req\.token/.test((AKCE.find(x => x.akce === akce) || {}).radek || '')) return 'kdokoli s tokenem relace';
  if (!/prihlaseny_\(/.test(t)) return /turnstile/i.test(dosah(t, 2).map(n => FN[n].telo).join(' ') + t) ? 'veřejné (Turnstile, limity)' : /\bk\b|klic|kod/.test(t) ? 'veřejné (kód / klíč v odkazu)' : 'veřejné';
  const radky = t.split('\n'), i = radky.findIndex(r => r.includes("'" + akce + "'"));
  const okno = i < 0 ? '' : radky.slice(i, i + 4).join('\n'), pred = radky.slice(0, i < 0 ? radky.length : i).filter(r => /^ {2}\S/.test(r) && (/return \{ ok: false/.test(r) || /pohledSboru_\(/.test(r))).join('\n');
  const role = new Set(), z = (s) => { for (const m of s.matchAll(/role\['([^']+)'\]/g)) role.add(m[1]); volane(s).filter(x => /^smi|Role_$/.test(x)).forEach(x => smiRole(x).forEach(r => role.add(r))); };
  z(okno); if (!role.size) z(pred);
  const okr = t.match(/const okres = (smi\w+_)\(o\)/); if (okr && /\bokres\b/.test(okno)) smiRole(okr[1]).forEach(r => role.add(r));
  const sbor = /pohledSboru_\(/.test(okno) || (!role.size && /pohledSboru_\(/.test(pred)) || (role.size && /pohledSboru_\(/.test(okno));
  const r = [...role].filter((x, j, a) => a.indexOf(x) === j);
  return (r.length ? 'role ' + r.join(' / ') : '') + (sbor ? (r.length ? ' nebo ' : '') + 'sbor (člen skupiny)' : '') || 'přihlášený';
}

/* ---------- akce POST ---------- */
const disp = FN.doPostAkce_.telo, OPAK = (VSE.match(/const OPAKOVATELNE = \[([\s\S]*?)\];/) || [, ''])[1].match(/'(\w+)'/g).map(s => s.slice(1, -1));
const AKCE = [], caseKom = {}; let cekaji = [];
disp.split('\n').forEach(r => {
  const c = [...r.matchAll(/case '(\w+)'/g)].map(m => m[1]); cekaji.push(...c);
  if (c.length === 1 && /\/\/\s*\S/.test(r)) caseKom[c[0]] = r.replace(/^.*?\/\/\s*/, ''); // popis akce = komentář na jejím řádku case
  const f = r.match(/return json_\((\w+)\(/), pozn = (r.match(/\/\/\s*(.*)$/) || [, ''])[1];
  if (f) { cekaji.forEach(a => AKCE.push({ akce: a, disp: f[1], pozn, radek: r })); cekaji = []; }
});
const uvod = t => t.split('\n').slice(1, Math.max(1, t.split('\n').findIndex(r => /req\.akce/.test(r)))).join('\n');
function vetev(d, akce) {
  const t = FN[d].telo;
  if (!FN[d].par.includes('req')) return { text: t, fn: d };
  const obj = t.match(new RegExp('\\b' + akce + ':\\s*(\\w+_)')); if (obj) return { text: obj[1] + '(o, req)', fn: obj[1] };
  // každý výskyt akce: text větve až k další větvi; bere se první, ve kterém je volání funkce
  for (const m of t.matchAll(new RegExp("(case\\s*|===\\s*)'" + akce + "'", 'g'))) {
    const zac = m.index, dal = t.slice(zac + 1).search(/req\.akce ===|case '|\n\s*\/\/ portál|\n {2}const u = pohledSboru_/), kon = dal < 0 ? t.length : zac + 1 + dal;
    const cely = t.slice(t.lastIndexOf('\n', zac) + 1, (t.indexOf('\n', zac) + 1 || t.length + 1) - 1);
    if (/req\.akce === '\w+'\s*\|\||\|\|\s*req\.akce ===/.test(cely) && !/\breturn\b/.test(cely)) continue; // stráž pro víc akcí – obsluha je níž
    const konRadku = t.indexOf('\n', zac) < 0 ? t.length : t.indexOf('\n', zac);
    const text = t.slice(zac, Math.max(kon, konRadku)), obsl = n => FN[n] && !POMOCNE.has(n) && !/^smi/.test(n);
    const ter = text.match(/^[^\n]*?\?\s*([a-zA-Z]\w*_)\(/);
    if (ter && obsl(ter[1])) return { text: ter[1] + '(o, req)', fn: ter[1] };
    const fn = [...text.matchAll(/return\s+[^;]*?\b([a-zA-Z]\w*_)\(|\b([a-zA-Z]\w*_)\(o\b/g)].map(m => m[1] || m[2]).find(obsl);
    if (fn) return { text, fn };
    if (/\breturn\b/.test(text)) return { text: uvod(t) + '\n' + text, fn: d }; // obsluha přímo v dispečeru (+ úvod dispečeru: pomocné funkce jako vse = () => radky_(…))
  }
  // „… ? f1(…) : f2(…)“ – poslední větev (else) patří akci ze stráže nad ní
  const radky = t.split('\n'), i = radky.findIndex(r => r.includes("'" + akce + "'"));
  for (let j = i; i >= 0 && j < Math.min(radky.length, i + 10); j++) {
    const el = radky[j].match(/req\.akce === '\w+' \?[^\n]*:\s*([a-zA-Z]\w*_)\([^?]*$/);
    if (el && !new RegExp("=== '" + akce + "'").test(radky[j]) && FN[el[1]]) return { text: el[1] + '(o, req)', fn: el[1] };
  }
  // obsluha je společný zbytek dispečeru: bez větví jiných akcí (řádek „if (req.akce === 'jiná') return …“ nebo blok „{ … }“)
  const zbytek = []; let blok = null;
  radky.forEach(r => {
    if (blok !== null) { if (new RegExp('^' + blok + '}').test(r)) blok = null; return; }
    if (/req\.akce === '/.test(r) && !r.includes("'" + akce + "'") && /^\s*if \(/.test(r)) { if (/\{\s*$/.test(r)) blok = r.match(/^\s*/)[0]; else if (/\breturn\b/.test(r)) return; }
    zbytek.push(r);
  });
  return { text: zbytek.join('\n'), fn: d };
}
const radkyAkci = AKCE.map(a => {
  const v = vetev(a.disp, a.akce), r = rozbor(v.text);
  if (!/^api/.test(a.disp)) for (const m of a.radek.matchAll(/\breq\.(\w+)/g)) if (!['akce', 'klic'].includes(m[1]) && !r.par.includes(m[1])) r.par.push(m[1]); // přímé volání: parametry z řádku case
  const radek = FN[a.disp].telo.split('\n').find(x => new RegExp("(=== |case )'" + a.akce + "'").test(x) && /\/\/|\/\*/.test(x)) || '';
  const kom = (radek.match(/\/\/\s*(.+)$/) || radek.match(/\/\*\s*(.+?)\s*\*\//) || [, ''])[1];
  const fnPopis = v.fn !== a.disp || !/^api/.test(a.disp) ? (FN[v.fn] || {}).popis : '';
  return Object.assign({}, a, r, { fn: v.fn, kdo: kdo(a.disp, a.akce), popis: caseKom[a.akce] || kom || fnPopis || '', zapis: OPAK.includes(a.akce) || r.zapis, opak: OPAK.includes(a.akce) });
});

/* ---------- akce GET ---------- */
const get = FN.doGet.telo, GETY = [];
for (const m of get.matchAll(/co === '(\w+)'\)[\s\S]*?(?=\n\s*if \((co ===|VEREJNE)|\n\s*return json_\(\{ ok: false)/g)) { const f = (m[0].match(/\b([a-z]\w*_?)\((?!p\.callback)/g) || []).map(s => s.slice(0, -1)).find(n => FN[n] && !POMOCNE.has(n));
  const k = (m[0].match(/\{ ok: true, ([^}]*)\}/) || [, ''])[1].split(',').map(x => (x.trim().match(/^(\w+):/) || [])[1]).filter(x => x && x !== 'data'); GETY.push({ co: m[1], fn: f || '', klice: k }); }
const ver = (VSE.match(/const VEREJNE = \{([\s\S]*?)\n\};/) || [, ''])[1];
for (const m of ver.matchAll(/(\w+):\s*\{\s*list:\s*'([^']+)',\s*pole:\s*\[([^\]]*)\]/g)) GETY.push({ co: m[1], fn: 'cistVerejne_', list: m[2], pole: m[3].replace(/'/g, '') });

/* ---------- klienti: kdo které akce volá ---------- */
const klient = (f, n) => { try { return { n, t: fs.readFileSync(path.join(KOREN, f), 'utf8') }; } catch (e) { return { n, t: '' }; } };
const KLIENTI = [klient('Aplikace OSH.dc.html', 'aplikace'), klient('index.html', 'web'), klient('zavod.js', 'panel'), klient('prihlaska.js', 'web'), klient('test.js', 'test')];
const volaKlient = {}, neznameKlient = [];
KLIENTI.forEach(k => {
  const prime = new Set([...k.t.matchAll(/\b(?:api|serverem|prStahnout)\(\s*'(\w+)'/g), ...(k.n === 'aplikace' ? [] : k.t.matchAll(/\bakce:\s*'(\w+)'/g))].map(m => m[1]));
  prime.forEach(a => { if (!AKCE.some(x => x.akce === a)) neznameKlient.push(k.n + ': ' + a); });
  AKCE.forEach(x => { if (prime.has(x.akce) || new RegExp("'" + x.akce + "'").test(k.t)) (volaKlient[x.akce] = volaKlient[x.akce] || new Set()).add(k.n); });
});
const getKlient = {}; KLIENTI.forEach(k => GETY.forEach(g => { if (new RegExp('co=' + g.co + '\\b|co:\\s*\'' + g.co + "'").test(k.t)) (getKlient[g.co] = getKlient[g.co] || new Set()).add(k.n); }));

/* ---------- Nastavení, vlastnosti skriptu, časovače ---------- */
const NAST = {}; for (const m of VSE.matchAll(/nastaveni\w*_\('([A-Z][A-Z0-9_]+)'/g)) { const f = GS.find(x => x.t.slice(0).includes(m[0])).f.replace('apps-script/', ''); (NAST[m[1]] = NAST[m[1]] || new Set()).add(f); }
for (const m of (strukt.match(/const NASTAVENI = \[([\s\S]*?)\n\];/) || [, ''])[1].matchAll(/\['([A-Z][A-Z0-9_]+)',/g)) if (!NAST[m[1]]) NAST[m[1]] = new Set(['OSH-data-struktura.gs']); // výchozí řádky listu Nastavení
const VLAST = {}; for (const { f, t } of GS.concat(SKUPINY)) for (const m of t.matchAll(/getProperty\('([A-Z_]+)'\)/g)) (VLAST[m[1]] = VLAST[m[1]] || new Set()).add(f.split('/').pop());
const CASOVACE = [];
for (const { f, t } of GS.concat(SKUPINY)) for (const m of t.matchAll(/newTrigger\('(\w+)'\)([^;]*?)\.create\(\)/g)) {
  const c = m[2], n = x => (c.match(new RegExp(x + '\\(([^)]*)\\)')) || [, ''])[1];
  const kdy = /onEdit/.test(c) ? 'při úpravě tabulky' : /onFormSubmit/.test(c) ? 'po odeslání formuláře' : /after\(/.test(c) ? 'jednorázově (pokračování dávky)' :
    /everyMinutes/.test(c) ? 'každých ' + n('everyMinutes') + ' min' : /everyHours/.test(c) ? (n('everyHours') === '1' ? 'každou hodinu' : 'každé ' + n('everyHours') + ' h') :
    /onWeekDay/.test(c) ? ({ SUNDAY: 'neděle', MONDAY: 'pondělí' }[(c.match(/WeekDay\.(\w+)/) || [])[1]] || 'týdně') + ' ' + n('atHour') + ':00' :
    /onMonthDay/.test(c) ? n('onMonthDay') + '. den v měsíci ' + n('atHour') + ':00' : /everyDays/.test(c) ? 'denně ' + n('atHour') + ':' + (n('nearMinute') || '00').padStart(2, '0') : c.trim();
  if (!CASOVACE.some(x => x.fn === m[1] && x.kdy === kdy)) CASOVACE.push({ fn: m[1], kdy, soubor: (FN[m[1]] ? FN[m[1]].soubor : f).split('/').pop() });
}

/* ---------- výstup ---------- */
const kod = s => '`' + s + '`', esc = s => String(s).replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
const prvniVeta = s => { const x = esc(s).replace(/^[-–\s]+/, ''); const m = x.match(/^(.{20,180}?[.:;])(\s|$)/); return (m ? m[1] : x.slice(0, 180)).replace(/[:;]$/, '.'); };
const modul = a => FN[a.disp].soubor.replace('apps-script/', '').replace('.gs', '');
const B = {};
{ // akce
  const o = [], podle = {};
  radkyAkci.forEach(a => (podle[modul(a)] = podle[modul(a)] || []).push(a));
  o.push('Celkem **' + radkyAkci.length + ' akcí POST** v ' + Object.keys(podle).length + ' modulech, z toho ' + radkyAkci.filter(a => a.zapis).length + ' zapisuje (✎) a ' + OPAK.length + ' je opakovatelných (↻ – stejný `klic` do 10 min vrátí uloženou odpověď).');
  o.push('Sloupce: **Kdo** = stráž na serveru; **Vstup** = pole požadavku vedle `akce`, `token`, `klic` (omezení délky z `kontrolaTextu_`); **Výstup** = klíče odpovědi vedle `ok`; **Data** = listy tabulky (**tučně** = zapisuje) a *služby Googlu*, se kterými obsluha pracuje (i nepřímo); **Volá** = aplikace / web / panel.');
  Object.keys(podle).forEach(m => {
    o.push('', '#### ' + m + '.gs' + (/^api/.test(podle[m][podle[m].length - 1].disp) ? ' (' + kod(podle[m][podle[m].length - 1].disp) + ')' : ''), '', '| Akce | Účel | Kdo | Vstup | Výstup | Data | Volá |', '| --- | --- | --- | --- | --- | --- | --- |');
    podle[m].forEach(a => o.push('| ' + kod(a.akce) + (a.zapis ? ' ✎' : '') + (a.opak ? ' ↻' : '') + ' | ' + prvniVeta(a.popis || '–') + (a.fn !== a.disp ? ' ' + kod(a.fn) : '') + (a.chyby.length ? ' Chyby např.: „' + esc(a.chyby[0]).slice(0, 70) + '“' : '') +
      ' | ' + a.kdo + ' | ' + (a.par.length ? a.par.map(kod).join(', ') : '–') + (a.limity.length ? ' (' + a.limity.slice(0, 5).join(', ') + ')' : '') +
      ' | ' + (a.klice.length ? a.klice.slice(0, 8).map(kod).join(', ') : '–') + ' | ' + a.listy.map(l => a.zapisListy.includes(l) ? '**' + l + '**' : l).concat(a.sluzby.map(s => '*' + s + '*')).join(', ') + ' | ' + [...(volaKlient[a.akce] || [])].join(', ') + ' |'));
  });
  B.akce = o.join('\n');
}
{ // GET
  const o = ['| `?co=` | Funkce | Vrací | Volá |', '| --- | --- | --- | --- |'];
  GETY.forEach(g => { const r = g.fn && FN[g.fn] ? rozbor(FN[g.fn].telo) : { listy: [] };
    o.push('| ' + kod(g.co) + ' | ' + (g.fn ? kod(g.fn) : '–') + ' | ' + (g.klice && g.klice.length && !g.fn ? g.klice.map(kod).join(', ') : g.list ? 'řádky listu ' + g.list + ' (' + g.pole + '), jen zveřejněné pro veřejnost' : prvniVeta((FN[g.fn] || {}).popis || (r.listy.length ? 'z listů ' + r.listy.join(', ') : '–'))) + ' | ' + [...(getKlient[g.co] || [])].join(', ') + ' |'); });
  B.get = o.join('\n');
}
{ // listy
  const zapisuji = {}, ctou = {}; radkyAkci.forEach(a => { a.zapisListy.forEach(l => (zapisuji[l] = zapisuji[l] || []).push(a.akce)); a.listy.filter(l => !a.zapisListy.includes(l)).forEach(l => (ctou[l] = ctou[l] || []).push(a.akce)); });
  const sezn = (x, n) => x ? x.slice(0, n).map(kod).join(', ') + (x.length > n ? ' a ' + (x.length - n) + ' dalších' : '') : '';
  const o = ['| List | Sloupce | Zapisují akce | Jen čtou |', '| --- | --- | --- | --- |'];
  LISTY.forEach(l => o.push('| **' + l.nazev + '** | ' + l.sloupce.join(', ') + ' | ' + (sezn(zapisuji[l.nazev], 10) || 'jen ručně / časovače') + ' | ' + (sezn(ctou[l.nazev], 6) || '–') + ' |'));
  B.listy = o.join('\n');
}
B.nastaveni = ['| Klíč v listu Nastavení | Používá |', '| --- | --- |'].concat(Object.keys(NAST).sort().map(k => '| ' + kod(k) + ' | ' + [...NAST[k]].join(', ') + ' |')).join('\n');
B.vlastnosti = ['| Vlastnost skriptu (tajné / ID) | Používá |', '| --- | --- |'].concat(Object.keys(VLAST).sort().map(k => '| ' + kod(k) + ' | ' + [...VLAST[k]].join(', ') + ' |')).join('\n');
B.casovace = ['| Funkce | Kdy | Soubor | Účel |', '| --- | --- | --- | --- |'].concat(CASOVACE.map(c => '| ' + kod(c.fn) + ' | ' + c.kdy + ' | ' + c.soubor + ' | ' + prvniVeta((FN[c.fn] || {}).popis || '–') + ' |')).join('\n');

/* ---------- zápis do dokumentu ---------- */
let dok = fs.existsSync(DOK) ? fs.readFileSync(DOK, 'utf8') : '';
const chybi = [];
Object.keys(B).forEach(k => {
  const re = new RegExp('(<!-- GEN:' + k + ' -->)[\\s\\S]*?(<!-- /GEN:' + k + ' -->)');
  if (!re.test(dok)) { chybi.push(k); return; }
  dok = dok.replace(re, (m, a, b) => a + '\n' + B[k] + '\n' + b);
});
const problemy = [];
if (chybi.length) problemy.push('V docs/rozhrani.md chybí bloky: ' + chybi.map(k => '<!-- GEN:' + k + ' -->').join(', '));
neznameKlient.forEach(x => problemy.push('Klient volá akci, kterou server nezná – ' + x));
const nikdo = radkyAkci.filter(a => !volaKlient[a.akce]).map(a => a.akce);
if (kontrola) {
  if (fs.readFileSync(DOK, 'utf8') !== dok) problemy.push('docs/rozhrani.md neodpovídá kódu – spusťte node nastroje/rozhrani.mjs');
} else if (!chybi.length) fs.writeFileSync(DOK, dok);
if (nikdo.length) console.log('Akce, které žádný klient přímo nevolá (jen ruční / testovací?): ' + nikdo.join(', '));
console.log('Akcí POST: ' + radkyAkci.length + ', GET: ' + GETY.length + ', listů: ' + LISTY.length + ', klíčů Nastavení: ' + Object.keys(NAST).length + ', vlastností: ' + Object.keys(VLAST).length + ', časovačů: ' + CASOVACE.length + '.');
if (problemy.length) { problemy.forEach(p => console.error('CHYBA: ' + p)); process.exit(neznameKlient.length ? 2 : 1); } // 2 = klient volá neznámou akci (nasazení serveru se zastaví)
console.log(kontrola ? 'docs/rozhrani.md odpovídá kódu.' : 'docs/rozhrani.md aktualizován.');
