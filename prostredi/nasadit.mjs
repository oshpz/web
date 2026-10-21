// Sestavení a nasazení prostředí TEST / OSTRY (L0). Spouští se přes ./nasadit.sh – popis v docs/prostredi.md.
// Bez závislostí (jen Node.js 18+): git a clasp se volají jako příkazy.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const KOREN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KLICE = ['prostredi', 'apiUrl', 'turnstileSitekey', 'webUrl', 'aplikaceUrl', 'kalendarId', 'dataUrl'];
// do ostrého webu nepatří interní podklady, zdrojáky serveru, konfigurace prostředí ani data testu
const VYLOUCIT = [/^docs\//, /^assets\/ucty\//, /^apps-script\//, /^skupiny-script\//, /^prostredi\//, /^nasadit\.sh$/, /^[^/]+\.md$/, /^\.gitignore$/, /^\.claude\//,
  /^CNAME$/, /^config\.js$/, /^data\/web\.json$/];
const ROBOTS = '<meta name="robots" content="noindex, nofollow" data-prostredi="test"><!-- vkládá nasadit.sh jen v TESTu -->';

const git = (args, cwd = KOREN) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const konec = text => { console.error('\nNENASAZENO: ' + text); process.exit(1); };
const info = text => console.log(text);

/* ---------- konfigurace ---------- */

function nactiKonfig(prostredi) {
  const soubor = path.join(KOREN, 'prostredi', prostredi + '.config.js');
  if (!fs.existsSync(soubor)) konec('Chybí ' + path.relative(KOREN, soubor) + '.');
  const text = fs.readFileSync(soubor, 'utf8'), okno = {};
  try { vm.runInNewContext(text, { window: okno }); } catch (e) { konec(path.relative(KOREN, soubor) + ' nejde načíst: ' + e.message); }
  const cfg = okno.OSH_CONFIG;
  if (!cfg) konec(path.relative(KOREN, soubor) + ' nenastaví window.OSH_CONFIG.');
  const chybi = KLICE.filter(k => typeof cfg[k] !== 'string');
  if (chybi.length) konec(path.relative(KOREN, soubor) + ': chybí klíče ' + chybi.join(', ') + '.');
  if (cfg.prostredi !== prostredi.toUpperCase()) konec(path.relative(KOREN, soubor) + ': prostredi musí být ' + prostredi.toUpperCase() + '.');
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(cfg.apiUrl) && !/DOPLNIT/.test(cfg.apiUrl)) konec('apiUrl musí být adresa nasazení Apps Script (…/exec).');
  if (!/^https:\/\/[^/]+$/.test(cfg.webUrl)) konec('webUrl musí být https://doména bez lomítka na konci.');
  return { text, cfg, doplnit: /DOPLNIT/.test(text), soubor: path.relative(KOREN, soubor) };
}

/* ---------- úpravy HTML podle prostředí ---------- */

const puvod = u => { try { return new URL(u).origin; } catch (e) { return ''; } };

/** CSP: doplní adresy, které stránka podle konfigurace potřebuje (server, kopie dat, Turnstile). Nic neubírá. */
function upravCsp(html, cfg) {
  const pouzivaApi = /CFG\.apiUrl/.test(html);
  return html.replace(/(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(")/, (m, a, obsah, z) => {
    const dir = obsah.split(';').map(x => x.trim()).filter(Boolean).map(x => x.split(/\s+/));
    const pridat = (nazev, adresy) => {
      let d = dir.find(x => x[0] === nazev);
      if (!d) { d = [nazev, "'self'"]; dir.push(d); }
      adresy.filter(Boolean).forEach(u => { if (d.indexOf(u) < 0) d.push(u); });
    };
    if (pouzivaApi) {
      const api = puvod(cfg.apiUrl);
      pridat('connect-src', [api, api === 'https://script.google.com' ? 'https://script.googleusercontent.com' : '', /^https?:/.test(cfg.dataUrl) ? puvod(cfg.dataUrl) : '']);
      if (cfg.turnstileSitekey) { pridat('script-src', ['https://challenges.cloudflare.com']); pridat('frame-src', ['https://challenges.cloudflare.com']); }
    }
    return a + dir.map(x => x.join(' ')).join('; ') + z;
  });
}

/** noindex jen v TESTu (vloží za viewport, jinak za charset); v ostrém provozu ho odstraní. */
function upravRobots(html, prostredi) {
  let h = html.replace(/^[ \t]*<meta name="robots"[^>]*>(?:<!--.*?-->)?[ \t]*\r?\n/gm, '');
  if (prostredi === 'test') {
    const m = /^<meta name="viewport"[^>]*>\r?\n/m.exec(h) || /^<meta charset[^>]*>\r?\n/m.exec(h);
    if (m) h = h.slice(0, m.index + m[0].length) + ROBOTS + '\n' + h.slice(m.index + m[0].length);
  }
  return h;
}

const upravHtml = (html, prostredi, cfg) => upravCsp(upravRobots(html, prostredi), cfg);

/* ---------- sestavení ---------- */

function sledovaneSoubory() { return git(['ls-files', '-z']).split('\0').filter(Boolean); }

function configJs(k, prostredi) {
  // verze = poslední commit konfigurace (ne HEAD) – opakované nasazení beze změny nic necommituje
  const v = git(['log', '-1', '--format=%h', '--', k.soubor]) || 'necommitnuto';
  return '/* VYGENEROVÁNO: ./nasadit.sh ' + prostredi + ' z ' + k.soubor + ' (' + v + '). Needitovat – upravte ' + k.soubor + ' a nasaďte znovu. */\n' + k.text;
}

/** Celý web pro dané prostředí: mapa cesta → obsah (Buffer). */
function sestavit(prostredi, k, cname) {
  const out = new Map();
  sledovaneSoubory().forEach(f => {
    if (prostredi === 'ostry' && VYLOUCIT.some(r => r.test(f))) return;
    if (!fs.existsSync(path.join(KOREN, f))) return;
    let obsah = fs.readFileSync(path.join(KOREN, f));
    if (f.endsWith('.html')) obsah = Buffer.from(upravHtml(obsah.toString('utf8'), prostredi, k.cfg));
    out.set(f, obsah);
  });
  out.set('config.js', Buffer.from(configJs(k, prostredi)));
  if (prostredi === 'ostry') {
    out.set('CNAME', Buffer.from(cname + '\n'));
    out.set('README.md', Buffer.from('# Web OSH Praha – západ (ostrý provoz)\n\nSestavení z repozitáře [oshpz/web](https://github.com/oshpz/web) skriptem `nasadit.sh ostry`. '
      + 'Soubory tu needitujte – každé nasazení je přepíše. Výjimka: `data/web.json` zapisuje server (Apps Script).\n'));
  }
  return out;
}

/** Kontrola hotového sestavení – v ostrém nesmí být noindex, testovací proužek, interní dokumenty ani testovací adresy. */
function zkontrolovat(mapa, prostredi) {
  const vady = [], textove = [...mapa.keys()].filter(f => /\.(html|js|json|css|txt|md)$|^CNAME$/.test(f));
  const obsahuje = re => textove.filter(f => re.test(mapa.get(f).toString('utf8')));
  if (prostredi === 'ostry') {
    const test = nactiKonfig('test').cfg;
    const id = (test.apiUrl.match(/\/s\/([\w-]+)\//) || [])[1];
    const pravidla = [
      ['noindex (zákaz indexace)', /noindex/i],
      ['testovací proužek', /osh-test-pruh|Testovací verze –/],
      ['adresa test.oshpz.cz', /test\.oshpz\.cz/],
      ['adresa testovacího serveru', new RegExp(id.replace(/[-]/g, '\\-'))],
      ['ID testovacího kalendáře', new RegExp(test.kalendarId.split('@')[0])],
      ['DOPLNIT v konfiguraci', /DOPLNIT/]
    ];
    pravidla.forEach(([co, re]) => { const kde = obsahuje(re); (kde.length ? vady : []).push(co + ': ' + kde.join(', ')); info((kde.length ? '  CHYBA  ' : '  OK     ') + 'bez – ' + co + (kde.length ? ' (' + kde.join(', ') + ')' : '')); });
    const interni = [...mapa.keys()].filter(f => VYLOUCIT.some(r => r.test(f)) && !['CNAME', 'README.md', 'config.js'].includes(f));
    (interni.length ? vady : []).push('interní soubory: ' + interni.join(', '));
    info((interni.length ? '  CHYBA  ' : '  OK     ') + 'bez interních souborů (docs/, apps-script/, skupiny-script/, prostredi/, *.md)');
    const cfg = mapa.get('config.js').toString('utf8');
    info((/prostredi: 'OSTRY'/.test(cfg) ? '  OK     ' : '  CHYBA  ') + 'config.js = OSTRY');
    if (!/prostredi: 'OSTRY'/.test(cfg)) vady.push('config.js není OSTRY');
  } else {
    const bez = [...mapa.keys()].filter(f => f.endsWith('.html') && !/noindex/.test(mapa.get(f).toString('utf8')));
    info((bez.length ? '  CHYBA  ' : '  OK     ') + 'noindex na všech stránkách' + (bez.length ? ' – chybí: ' + bez.join(', ') : ''));
    if (bez.length) vady.push('chybí noindex');
  }
  return vady;
}

function zapsat(mapa, cil) {
  for (const [f, obsah] of mapa) { const p = path.join(cil, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, obsah); }
}

function vsechnySoubory(slozka, zaklad = slozka) {
  return fs.readdirSync(slozka, { withFileTypes: true }).flatMap(d => d.name === '.git' ? [] : d.isDirectory() ? vsechnySoubory(path.join(slozka, d.name), zaklad) : [path.relative(zaklad, path.join(slozka, d.name))]);
}

function verze() { return git(['rev-parse', '--short', 'HEAD']) + ' ' + git(['log', '-1', '--format=%s']).slice(0, 70); }

function vyzadovatCisty(cwd, popis) {
  const s = git(['status', '--porcelain'], cwd);
  if (s) konec('V ' + popis + ' jsou necommitnuté změny – nejdřív je commitněte (nebo vraťte):\n' + s);
}

/* ---------- příkazy ---------- */

function argumenty(a) {
  const o = { _: [] };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--nanecisto') { o.nanecisto = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; }
    else if (a[i] === '--cname') o.cname = a[++i];
    else if (a[i] === '--cil') o.cil = a[++i];
    else o._.push(a[i]);
  }
  return o;
}

function nanecisto(mapa, prostredi, kam) {
  const cil = typeof kam === 'string' ? path.resolve(kam) : path.join(os.tmpdir(), 'osh-' + prostredi + '-sestaveni');
  fs.rmSync(cil, { recursive: true, force: true });
  zapsat(mapa, cil);
  info('\nSestavení nanečisto (nic se necommitovalo): ' + cil + ' – ' + mapa.size + ' souborů');
}

function webTest(o) {
  const k = nactiKonfig('test');
  if (k.doplnit) konec(k.soubor + ' obsahuje DOPLNIT.');
  const mapa = sestavit('test', k);
  info('Kontrola sestavení TEST:');
  const vady = zkontrolovat(mapa, 'test');
  if (o.nanecisto) { nanecisto(mapa, 'test', o.nanecisto); process.exit(vady.length ? 1 : 0); }
  if (vady.length) konec(vady.join('; '));
  vyzadovatCisty(KOREN, 'repozitáři');
  // test.oshpz.cz = GitHub Pages z větve main tohoto repozitáře: mění se jen config.js a hlavičky stránek, zbytek je beze změny
  const zmenene = [...mapa.keys()].filter(f => (f === 'config.js' || f.endsWith('.html')) && (!fs.existsSync(path.join(KOREN, f)) || !fs.readFileSync(path.join(KOREN, f)).equals(mapa.get(f))));
  zmenene.forEach(f => fs.writeFileSync(path.join(KOREN, f), mapa.get(f)));
  if (zmenene.length) {
    git(['add', '--', ...zmenene]);
    git(['commit', '-m', 'Nasazení TEST: ' + zmenene.join(', ') + '\n\nVytvořeno skriptem nasadit.sh test z ' + k.soubor + '.']);
    info('Upraveno a commitnuto: ' + zmenene.join(', '));
  } else info('config.js a stránky už odpovídají konfiguraci TEST.');
  // server sám commituje data/web.json do main – nejdřív stáhnout
  execFileSync('git', ['pull', '--rebase', '-q'], { cwd: KOREN, stdio: 'inherit' });
  execFileSync('git', ['push', '-q'], { cwd: KOREN, stdio: 'inherit' });
  info('\nNasazeno: ' + k.cfg.webUrl + ' (' + verze() + '). GitHub Pages zveřejní změnu do 1–2 minut.');
}

function webOstry(o) {
  const k = nactiKonfig('ostry'), cname = o.cname || 'oshpz.cz';
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(cname)) konec('--cname musí být doména, např. novy.oshpz.cz.');
  if (k.doplnit && !o.nanecisto) konec(k.soubor + ' obsahuje DOPLNIT – doplňte ID ostrého prostředí (docs/spusteni-ostre.md).');
  if (k.doplnit) info('POZOR: ' + k.soubor + ' obsahuje DOPLNIT – nanečisto sestavuji i tak, nasadit to nepůjde.');
  const mapa = sestavit('ostry', k, cname);
  info('Kontrola sestavení OSTRY (doména ' + cname + '):');
  const vady = zkontrolovat(mapa, 'ostry');
  if (o.nanecisto) { nanecisto(mapa, 'ostry', o.nanecisto); process.exit(vady.filter(v => !/^DOPLNIT/.test(v)).length ? 1 : 0); }
  if (vady.length) konec(vady.join('; '));
  vyzadovatCisty(KOREN, 'repozitáři oshpz/web');
  const cil = path.resolve(KOREN, o.cil || '../web-ostry');
  if (!fs.existsSync(path.join(cil, '.git'))) konec('Složka ' + cil + ' není klon oshpz/web-ostry. Založte ji: git clone https://github.com/oshpz/web-ostry.git ' + cil);
  vyzadovatCisty(cil, cil);
  execFileSync('git', ['pull', '--rebase', '-q'], { cwd: cil, stdio: 'inherit' });
  // smazat, co v sestavení není (kromě dat webu, která zapisuje server), a zapsat nové
  vsechnySoubory(cil).filter(f => !mapa.has(f) && f !== 'data/web.json').forEach(f => fs.rmSync(path.join(cil, f)));
  zapsat(mapa, cil);
  git(['add', '-A'], cil);
  if (!git(['status', '--porcelain'], cil)) { info('Ostrý web už je v této verzi, nic k nasazení.'); return; }
  git(['commit', '-m', 'Nasazení ' + verze() + '\n\nZ oshpz/web ' + git(['rev-parse', 'HEAD']) + ', doména ' + cname + '.'], cil);
  execFileSync('git', ['push', '-q'], { cwd: cil, stdio: 'inherit' });
  info('\nNasazeno do ' + cil + ' → https://' + cname + ' (' + verze() + '). GitHub Pages zveřejní změnu do 1–2 minut.');
}

function server(prostredi) {
  if (prostredi !== 'test' && prostredi !== 'ostry') konec('Použití: ./nasadit.sh server test|ostry');
  const slozka = path.join(KOREN, 'apps-script'), projekt = path.join(slozka, '.clasp.' + prostredi + '.json');
  if (!fs.existsSync(projekt)) konec('Chybí apps-script/.clasp.' + prostredi + '.json' + (prostredi === 'ostry' ? ' – zkopírujte .clasp.ostry.json.example a doplňte ID (docs/spusteni-ostre.md).' : '.'));
  const text = fs.readFileSync(projekt, 'utf8');
  if (/DOPLNIT/.test(text)) konec('apps-script/.clasp.' + prostredi + '.json obsahuje DOPLNIT.');
  const p = JSON.parse(text);
  if (!p.scriptId || !p.deploymentId) konec('V .clasp.' + prostredi + '.json chybí scriptId nebo deploymentId.');
  vyzadovatCisty(KOREN, 'repozitáři');
  // stejně pojmenovaná funkce ve dvou souborech .gs se tiše přepíše (jeden jmenný prostor)
  const jmena = {};
  fs.readdirSync(slozka).filter(f => f.endsWith('.gs')).forEach(f => {
    const zdroj = fs.readFileSync(path.join(slozka, f), 'utf8');
    for (const m of zdroj.matchAll(/^(?:function|const|let)\s+([A-Za-z0-9_$]+)/gm)) (jmena[m[1]] = jmena[m[1]] || []).push(f);
    const tmp = path.join(os.tmpdir(), 'osh-kontrola-' + f + '.js'); fs.writeFileSync(tmp, zdroj);
    try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); } catch (e) { konec('Syntaktická chyba v ' + f + ':\n' + e.stderr); }
  });
  const kolize = Object.keys(jmena).filter(j => jmena[j].length > 1);
  if (kolize.length) konec('Stejná jména ve více souborech .gs: ' + kolize.map(j => j + ' (' + jmena[j].join(', ') + ')').join('; '));
  const uzivatel = p.ucet && p.ucet !== 'default' ? ['-u', p.ucet] : [];
  const clasp = args => { try { execFileSync('clasp', [...uzivatel, '-P', projekt, ...args], { cwd: slozka, stdio: 'inherit' }); }
    catch (e) { konec('clasp ' + args[0] + ' selhal (výpis výše). Při „invalid_rapt“ / „invalid_grant“ vypršelo přihlášení: spusťte v apps-script/ ' + (p.ucet && p.ucet !== 'default' ? 'clasp login -u ' + p.ucet : 'clasp login') + ' a nasazení zopakujte.'); } };
  info('Apps Script ' + prostredi.toUpperCase() + ' (účet clasp: ' + (p.ucet || 'default') + ')');
  clasp(['push', '-f']);
  clasp(['deploy', '-i', p.deploymentId, '-d', verze().slice(0, 90)]);
  const url = 'https://script.google.com/macros/s/' + p.deploymentId + '/exec?co=ping';
  return fetch(url).then(r => r.json()).then(j => {
    if (j.rezim !== prostredi.toUpperCase()) konec('Server odpovídá v režimu ' + j.rezim + ', čekal jsem ' + prostredi.toUpperCase() + ' – zkontrolujte Nastavení REZIM.');
    info('\nNasazeno, server odpovídá (režim ' + j.rezim + '). Adresa /exec zůstala stejná.');
  }).catch(e => info('\nNasazeno, ale kontrolní ping selhal (' + e.message + ') – zkuste ' + url));
}

const o = argumenty(process.argv.slice(2)), [prikaz, druhy] = o._;
if (prikaz === 'test') webTest(o);
else if (prikaz === 'ostry') webOstry(o);
else if (prikaz === 'server') await server(druhy);
else { console.log(fs.readFileSync(path.join(KOREN, 'nasadit.sh'), 'utf8').split('\n').filter(r => r.startsWith('#') && !r.startsWith('#!')).map(r => r.slice(2)).join('\n')); process.exit(prikaz ? 1 : 0); }
