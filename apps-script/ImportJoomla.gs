/**
 * B15 – import starých aktualit z Joomly do listu Příspěvky. Data připraví nastroje/joomla-migrace.mjs (zkušební běh, docs/migrace-aktualit.md).
 * ZATÍM NESPOUŠTĚT naostro – nejdřív kontrola reportu a vzorku v TESTu.
 *
 * Postup:
 *   1. Složku migrace/ z počítače (prispevky.json a media/) nahrát na Disk účtu, pod kterým skript běží (stačí Můj disk).
 *   2. ID té složky zapsat do listu Nastavení jako JOOMLA_SLOZKA.
 *   3. V tabulce OSH data spustit Založit / doplnit strukturu (sloupec Původní adresa, zdroj joomla), pak z editoru importJoomla.
 * Běží po dávkách (limit Apps Scriptu 6 min): po ~4,5 min skončí a naplánuje si pokračování za minutu, dokud není hotovo.
 * Opakovaný běh nic nezdvojí – řádek se pozná podle Zdroj = joomla + Původní adresa (ID PJ<číslo článku>); nedokončený (Poznámka
 * IJ_NEDOKONCENO) se dokončí, soubory, které už ve složce jsou, se znovu nenahrávají. V režimu TEST jen IJ_TEST_POCET nejnovějších.
 * Fotky a přílohy jdou do Příspěvky/<ID> na sdíleném disku se sdílením odkazem (zveřejněno, veřejnost). Příloha se stejným MD5 jako
 * zveřejněný veřejný dokument orgánu se nenahraje – příspěvek na dokument jen odkáže (typ dokument v Přílohách).
 */

const IJ_LIMIT_MS = 270000, IJ_TEST_POCET = 20, IJ_NEDOKONCENO = 'import z Joomly: nahrávám soubory';

function importJoomla() {
  const zacatek = Date.now(), log = [];
  const zadano = String(nastaveniWeb_('JOOMLA_SLOZKA') || '').trim();
  if (!zadano) throw new Error('Doplňte v listu Nastavení JOOMLA_SLOZKA = ID složky na Disku s prispevky.json a media/ (nahraná složka migrace/).');
  // stačí i celá adresa složky (…/folders/<ID>?usp=…)
  const idSlozky = (zadano.match(/folders\/([\w-]{10,})/) || zadano.match(/[?&]id=([\w-]{10,})/) || [])[1] || zadano.replace(/[?#].*$/, '');
  let koren;
  try { koren = DriveApp.getFolderById(idSlozky); } catch (e) {
    throw new Error('Složku JOOMLA_SLOZKA „' + idSlozky + '“ nevidí účet ' + Session.getEffectiveUser().getEmail() + ' (pod ním import běží). Nahrajte složku na Disk tohoto účtu nebo ji s ním sdílejte a zkontrolujte ID v Nastavení.');
  }
  const soubor = koren.getFilesByName('prispevky.json');
  if (!soubor.hasNext()) throw new Error('Ve složce JOOMLA_SLOZKA chybí prispevky.json.');
  let data = JSON.parse(soubor.next().getBlob().getDataAsString('UTF-8'));
  data.sort((a, b) => String(b['Zveřejněno'] || '').localeCompare(String(a['Zveřejněno'] || '')));
  if (!ostryRezim_()) data = data.slice(0, IJ_TEST_POCET);
  const t = prNacist_(), col = k => t.h.indexOf(k);
  if (col('Původní adresa') < 0) throw new Error('V listu Příspěvky chybí sloupec Původní adresa – spusťte OSH data → Založit / doplnit strukturu.');
  const podleUrl = {};
  t.v.forEach((r, i) => { if (String(r[col('Zdroj')]) === 'joomla' && r[col('Původní adresa')]) podleUrl[String(r[col('Původní adresa')])] = i; });
  const dokumenty = ijDokumentyMd5_(), media = ijPodslozka_(koren, 'media');
  let novych = 0, dokonceno = 0, preskoceno = 0, zbyva = 0;
  for (const c of data) {
    if (Date.now() - zacatek > IJ_LIMIT_MS) { zbyva++; continue; }
    const i0 = podleUrl[c.puvodniUrl];
    if (i0 != null && String(t.v[i0][col('Poznámka')] || '') !== IJ_NEDOKONCENO) { preskoceno++; continue; }
    const v = ijClanek_(t, c, i0, dokumenty, media, zacatek);
    if (v.novy) { novych++; podleUrl[c.puvodniUrl] = v.i; }
    if (v.hotovo) dokonceno++; else zbyva++;
  }
  prVycistitWeb_('');
  log.push('Import z Joomly (' + (ostryRezim_() ? 'OSTRÝ – všechny články' : 'TEST – jen ' + IJ_TEST_POCET + ' nejnovějších') + '): nových ' + novych + ', dokončeno ' + dokonceno + ', už bylo ' + preskoceno + ', zbývá ' + zbyva + '.');
  if (zbyva) { ijNaplanovat_(); log.push('Pokračování je naplánované za minutu (časovač importJoomla).'); } else ijZrusitPlan_();
  console.log(log.join('\n'));
  try { SpreadsheetApp.getActive().toast(log.join(' '), 'Import z Joomly', 10); } catch (e) {}
  return log.join('\n');
}

/** Jeden článek: řádek (nový nebo nedokončený), soubory do Příspěvky/<ID>, Přílohy, hlavní fotka. Vrací { i, novy, hotovo }. */
function ijClanek_(t, c, i0, dokumenty, media, zacatek) {
  const col = k => t.h.indexOf(k), ted = new Date(), novy = i0 == null;
  const r = novy ? t.h.map(() => '') : t.v[i0].slice(), set = (k, v) => { if (col(k) >= 0) r[col(k)] = v; };
  if (novy) {
    const id = 'PJ' + c.puvodniId;
    set('ID', id); set('Titulek', String(c.Titulek || '').slice(0, 300)); set('Perex', String(c.Perex || '').slice(0, 500)); set('Text', prVycistitText_(c.Text).slice(0, PR_TEXT_MAX));
    set('Autor', String(c.Autor || '').slice(0, 100)); set('Zdroj', 'joomla'); set('Stav', 'zveřejněno'); set('Pro koho', 'veřejnost');
    set('Zveřejněno', c['Zveřejněno'] ? new Date(c['Zveřejněno']) : ''); set('Štítky', String(c['Štítky'] || '')); set('Připnout', 'NE');
    set('Adresa', ijVolnaAdresa_(t, c.Adresa, c['Zveřejněno'])); set('Původní adresa', c.puvodniUrl);
    set('Odkaz', (nastaveniWeb_('WEB_URL') || '') + '/?clanek=' + r[col('Adresa')]);
    set('Vytvořeno', ted); set('Vytvořil', 'import Joomla'); set('Upraveno', ted); set('Upravil', 'import Joomla'); set('Poznámka', IJ_NEDOKONCENO);
    prZapsat_(t, -1, r); t.v.push(r);
    zaznamZmeny_('import Joomla', LIST_PRISPEVKY, String(r[col('ID')]), 'vytvořeno', '', 'z ' + c.puvodniUrl);
  }
  const i = novy ? t.v.length - 1 : i0, id = String(r[col('ID')]);
  const slozka = prSlozka_(id, r, t), uz = {};
  const it = slozka.getFiles(); while (it.hasNext()) { const f = it.next(); uz[f.getName()] = f; }
  const zdroj = ijPodslozka_(media, String(c.puvodniId), true), soubory = [];
  let hotovo = true;
  const nahrat = (x, druh) => {
    let f = uz[x.n];
    if (!f) {
      if (!zdroj) throw new Error('V media/ chybí složka ' + c.puvodniId);
      const z = zdroj.getFilesByName(x.n);
      if (!z.hasNext()) { console.warn('Chybí soubor ' + c.puvodniId + '/' + x.n); return; }
      f = slozka.createFile(z.next().getBlob().setName(x.n));
    }
    try { nastavitSdileni_(f, 'veřejnost', ''); } catch (e) { console.error('Sdílení ' + f.getId() + ': ' + e.message); }
    soubory.push({ id: f.getId(), n: x.n, t: druh, m: druh === 'foto' ? 'image/jpeg' : x.m });
  };
  for (const x of (c.fotky || []).concat(c.prilohy || [])) {
    if (Date.now() - zacatek > IJ_LIMIT_MS + 30000) { hotovo = false; break; } // zbytek příště
    const druh = (c.fotky || []).indexOf(x) >= 0 ? 'foto' : 'priloha', dok = druh === 'priloha' && x.md5 ? dokumenty[x.md5] : null;
    if (dok) soubory.push({ t: 'dokument', id: dok.id, n: dok.n, u: dok.u }); else nahrat(x, druh);
  }
  set('Přílohy', JSON.stringify(soubory));
  set('Hlavní fotka – ID', (soubory.find(x => x.t === 'foto') || {}).id || '');
  if (hotovo) set('Poznámka', '');
  set('Upraveno', new Date()); set('Upravil', 'import Joomla');
  prZapsat_(t, i, r); t.v[i] = r;
  return { i: i, novy: novy, hotovo: hotovo };
}

/** Adresa z přípravy; když ji mezitím obsadil jiný příspěvek, přidá rok a pak -2, -3… */
function ijVolnaAdresa_(t, adresa, datum) {
  const col = k => t.h.indexOf(k), obsazene = {};
  t.v.forEach(r => { obsazene[String(r[col('Adresa')] || '')] = true; });
  let a = String(adresa || 'prispevek');
  if (obsazene[a] && datum) a = a + '-' + String(datum).slice(0, 4);
  const z = a; let n = 2;
  while (obsazene[a]) a = z + '-' + n++;
  return a;
}

/** MD5 souborů zveřejněných veřejných dokumentů orgánů → { md5: { id, n, u } } (30 min v mezipaměti). */
function ijDokumentyMd5_() {
  const c = CacheService.getScriptCache(), z = c.get('ij_dok_md5');
  if (z) return JSON.parse(z);
  const out = {};
  radky_('Dokumenty').filter(r => r['Stav'] === 'zveřejněno' && r['Soubor – ID'] && PRO_VEREJNOST.indexOf(String(r['Pro koho'] || 'veřejnost').trim() || 'veřejnost') >= 0).forEach(r => {
    try {
      const m = Drive.Files.get(String(r['Soubor – ID']), { fields: 'md5Checksum', supportsAllDrives: true }).md5Checksum;
      if (m) out[m] = { id: String(r['ID']), n: [r['Orgán'], r['Název']].filter(Boolean).join(' – '), u: String(r['Veřejný odkaz'] || '') };
    } catch (e) { console.warn('MD5 dokumentu ' + r['ID'] + ': ' + e.message); }
  });
  try { c.put('ij_dok_md5', JSON.stringify(out), 1800); } catch (e) {}
  return out;
}

function ijPodslozka_(slozka, nazev, volitelne) {
  const it = slozka.getFoldersByName(nazev);
  if (it.hasNext()) return it.next();
  if (volitelne) return null;
  throw new Error('Ve složce ' + slozka.getName() + ' chybí podsložka ' + nazev + '.');
}
function ijNaplanovat_() {
  ijZrusitPlan_();
  ScriptApp.newTrigger('importJoomla').timeBased().after(60 * 1000).create();
}
function ijZrusitPlan_() {
  ScriptApp.getProjectTriggers().filter(x => x.getHandlerFunction() === 'importJoomla').forEach(x => ScriptApp.deleteTrigger(x));
}
