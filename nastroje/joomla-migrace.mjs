#!/usr/bin/env node
/*
 * B15 – převod starých aktualit z Joomly (www.oshpz.cz) do listu Příspěvky. ZKUŠEBNÍ BĚH: nic nezapisuje do tabulky ani na Disk.
 *
 *   node nastroje/joomla-migrace.mjs stahnout   – najde kategorie a články (kanály kategorií + chybějící ID), stáhne stránky článků
 *   node nastroje/joomla-migrace.mjs zpracovat  – převede text, stáhne a zmenší fotky a přílohy, připraví řádky a přesměrování
 *   node nastroje/joomla-migrace.mjs vse        – obojí
 *
 * Výstup do migrace/ (v .gitignore, nic z ní do repozitáře): prispevky.json, presmerovani.json, media/, report.json, cache/.
 * Stahuje šetrně: 1 požadavek za sekundu, User-Agent „OSHPZ migrace“, vše se drží v migrace/cache (opakovaný běh nic nestahuje znovu).
 * Fotky zmenšuje nastroje/zmensit-foto.swift (macOS, ImageIO): delší strana 1600 px, JPEG bez EXIF/GPS.
 * Import do tabulky a na Disk dělá až importJoomla v apps-script/ImportJoomla.gs (zatím nespouštět).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const KOREN = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const VYSTUP = path.join(KOREN, 'migrace'), CACHE = path.join(VYSTUP, 'cache'), MEDIA = path.join(VYSTUP, 'media');
const WEB = 'https://www.oshpz.cz', UA = 'OSHPZ migrace', PRODLEVA = 1000;
const MAX_KATEGORIE = 300;
[VYSTUP, CACHE, MEDIA].forEach(d => fs.mkdirSync(d, { recursive: true }));

/* ---------- stahování s mezipamětí ---------- */
let posledni = 0, pozadavku = 0;
const otisk = t => crypto.createHash('sha1').update(t).digest('hex');
const spat = ms => new Promise(r => setTimeout(r, ms));
/** Vrací { status, typ, url, data (Buffer) }. 404 a chyby se také pamatují (aby se neptal znovu). */
async function stahni(url) {
  const k = otisk(url), fm = path.join(CACHE, k + '.json'), fd = path.join(CACHE, k + '.bin');
  if (fs.existsSync(fm)) { const m = JSON.parse(fs.readFileSync(fm, 'utf8')); return Object.assign(m, { data: fs.existsSync(fd) ? fs.readFileSync(fd) : Buffer.alloc(0) }); }
  const cekat = posledni + PRODLEVA - Date.now(); if (cekat > 0) await spat(cekat);
  posledni = Date.now(); pozadavku++;
  let m, data = Buffer.alloc(0);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(60000) });
    data = Buffer.from(await r.arrayBuffer());
    m = { status: r.status, typ: r.headers.get('content-type') || '', url: r.url };
  } catch (e) { m = { status: 0, typ: '', url, chyba: String(e.message || e) }; }
  fs.writeFileSync(fm, JSON.stringify(m)); if (data.length) fs.writeFileSync(fd, data);
  if (pozadavku % 25 === 0) console.log('  … ' + pozadavku + ' požadavků');
  return Object.assign(m, { data });
}
const text = r => r.data.toString('utf8');

/* ---------- HTML a Atom ---------- */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', bdquo: '„', ldquo: '“', rdquo: '”', lsquo: '‚', rsquo: '‘', laquo: '«', raquo: '»',
  scaron: 'š', Scaron: 'Š', ccaron: 'č', Ccaron: 'Č', rcaron: 'ř', Rcaron: 'Ř', zcaron: 'ž', Zcaron: 'Ž', ecaron: 'ě', Ecaron: 'Ě', dcaron: 'ď', Dcaron: 'Ď', tcaron: 'ť', Tcaron: 'Ť', ncaron: 'ň', Ncaron: 'Ň',
  aacute: 'á', Aacute: 'Á', eacute: 'é', Eacute: 'É', iacute: 'í', Iacute: 'Í', oacute: 'ó', Oacute: 'Ó', uacute: 'ú', Uacute: 'Ú', yacute: 'ý', Yacute: 'Ý', uring: 'ů', Uring: 'Ů',
  deg: '°', copy: '©', reg: '®', euro: '€', times: '×', middot: '·', bull: '•', shy: '' };
// celá sada latinkových entit HTML 4 (ü, ö, ä, ß, à…) – kód 160–255 podle názvu
'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml'
  .split(' ').forEach((n, i) => { if (ENT[n] == null) ENT[n] = n === 'shy' ? '' : n === 'nbsp' ? ' ' : String.fromCharCode(160 + i); });
const dekoduj = t => String(t || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e] != null ? ENT[e] : m));
const tag = (s, t) => { const m = s.match(new RegExp('<' + t + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + t + '>')); return m ? m[1] : ''; };
function atomZaznamy(xml) {
  return (xml.match(/<entry>[\s\S]*?<\/entry>/g) || []).map(e => ({
    titulek: dekoduj(tag(e, 'title')).trim(), odkaz: dekoduj((e.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/) || e.match(/<link[^>]*href="([^"]+)"/) || [])[1] || ''),
    zverejneno: tag(e, 'published').trim(), upraveno: tag(e, 'updated').trim(), autor: dekoduj(tag(tag(e, 'author'), 'name')).trim(),
    kategorie: dekoduj((e.match(/<category term="([^"]*)"/) || [])[1] || ''), shrnuti: dekoduj(tag(e, 'summary') || tag(e, 'content'))
  }));
}
const idClanku = u => { const m = String(u).match(/\/(\d+)-[^/?#]*(?:[?#]|$)/) || String(u).match(/[?&]id=(\d+)/); return m ? Number(m[1]) : null; };

/* ---------- 1. stahování: kategorie, kanály, stránky článků ---------- */
async function stahnout() {
  console.log('1) Kategorie (kanály podle čísla kategorie)…');
  const kategorie = {}, clanky = {};
  let posledniNalezena = 0;
  for (let cid = 1; cid <= MAX_KATEGORIE && cid <= posledniNalezena + 60; cid++) {
    const zaklad = WEB + '/index.php?option=com_content&view=category&id=' + cid + '&format=feed&type=atom';
    let r = await stahni(zaklad);
    if (r.status !== 200 || !/<feed/.test(text(r))) continue;
    const xml = text(r), titul = dekoduj(tag(xml, 'title')).trim(), sef = dekoduj((xml.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/) || [])[1] || '');
    kategorie[cid] = { id: cid, nazev: titul, adresa: sef, clanku: 0 };
    posledniNalezena = cid;
    for (let start = 0; start < 5000; start += 10) {
      if (start) r = await stahni(zaklad + '&start=' + start);
      const z = atomZaznamy(text(r));
      z.forEach(x => { const id = idClanku(x.odkaz); if (!id) return; kategorie[cid].clanku++;
        if (!clanky[id] || (clanky[id].kategorieId !== cid && x.kategorie === titul)) clanky[id] = Object.assign({ id: id, kategorieId: cid }, x); });
      if (z.length < 10) break;
    }
    console.log('  kategorie ' + cid + ': ' + titul + ' (' + kategorie[cid].clanku + ')');
  }
  console.log('2) Stránky článků z kanálů (' + Object.keys(clanky).length + ')…');
  for (const id of Object.keys(clanky)) {
    const c = clanky[id], r = await stahni(c.odkaz);
    c.status = r.status; c.html = r.status === 200 ? teloClanku(text(r)) : '';
  }
  const maxId = Math.max(0, ...Object.keys(clanky).map(Number));
  console.log('3) Chybějící čísla článků 1–' + (maxId + 20) + ' (mimo kanály kategorií)…');
  for (let id = 1; id <= maxId + 20; id++) {
    if (clanky[id]) continue;
    const r = await stahni(WEB + '/index.php?option=com_content&view=article&id=' + id);
    if (r.status !== 200) continue;
    const h = text(r), h1 = dekoduj((tag(h, 'h1') || '').replace(/<[^>]+>/g, '')).trim();
    clanky[id] = { id: id, kategorieId: null, titulek: h1, odkaz: WEB + '/index.php?option=com_content&view=article&id=' + id, zverejneno: '', autor: '', kategorie: '', shrnuti: '', status: 200, html: teloClanku(h), mimoKanaly: true };
    console.log('  mimo kanály: ' + id + ' ' + h1);
  }
  fs.writeFileSync(path.join(VYSTUP, 'stazeno.json'), JSON.stringify({ kategorie, clanky, pozadavku }, null, 1));
  console.log('Hotovo: ' + Object.keys(kategorie).length + ' kategorií, ' + Object.keys(clanky).length + ' článků, ' + pozadavku + ' nových požadavků.');
}
/** Tělo článku ze stránky (Joomla 4: com-content-article__body), jinak <main>. */
function teloClanku(h) {
  const i = h.indexOf('com-content-article__body');
  if (i >= 0) { const z = h.indexOf('>', i) + 1; return vyrizniDiv(h, z); }
  return tag(h, 'main');
}
/** Obsah od pozice z do odpovídajícího </div> (počítá vnořené <div>). */
function vyrizniDiv(h, z) {
  let hl = 1, i = z; const re = /<(\/?)div\b[^>]*>/gi; re.lastIndex = z; let m;
  while ((m = re.exec(h))) { hl += m[1] ? -1 : 1; if (!hl) return h.slice(z, m.index); i = re.lastIndex; }
  return h.slice(z);
}


const prikaz = process.argv[2] || '';
if (prikaz === 'stahnout' || prikaz === 'vse') await stahnout();
if (prikaz === 'zpracovat' || prikaz === 'vse') { const z = await import('./joomla-zpracovat.mjs'); await z.zpracovat({ stahni, dekoduj, idClanku, VYSTUP, MEDIA, WEB }); }
if (!['stahnout', 'zpracovat', 'vse'].includes(prikaz)) console.log('Použití: node nastroje/joomla-migrace.mjs stahnout | zpracovat | vse');
