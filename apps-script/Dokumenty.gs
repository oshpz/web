/**
 * OSH data – serverová část, díl 3: dokumenty z Disku (B2.3).
 * Nový soubor „Dokumenty“ ve stejném projektu.
 *
 * Každých 15 minut projde složku „Orgány OSH PZ“ (i podsložky). Nový soubor zapíše do listu Dokumenty
 * jako „ke schválení“ a pošle upozornění. Zveřejnit / zamítnout jde z tabulky (menu OSH data) nebo z aplikace.
 * Název souboru: ZKRATKA RRRRMMDD Název   nebo   ZKRATKA RRRR Název   (např. „VV 20261001 Zápis z jednání.pdf“)
 */

const VZOR_NAZVU = /^([A-Za-zÁ-Žá-ž]{2,6})\s+(\d{8}|\d{6}|\d{4})\s+(.+?)(?:\.[A-Za-z0-9]{2,5})?$/;

// dataSs_() je v souboru API (otevře tabulku jednou za požadavek).

/** Rozebere název souboru. Vrací { organ, datum, rok, nazev, upozorneni }. */
function rozebratNazev_(nazevSouboru, slozkaOrganu) {
  const m = String(nazevSouboru).trim().match(VZOR_NAZVU);
  const zSlozky = slozkaOrganu ? slozkaOrganu.split(/[\s–-]/)[0].toUpperCase() : '';
  if (!m) return { organ: zSlozky, datum: '', rok: '', nazev: nazevSouboru.replace(/\.[A-Za-z0-9]{2,5}$/, ''),
    upozorneni: 'Název neodpovídá vzoru „ZKRATKA RRRRMMDD Název“. Opravte název souboru nebo doplňte údaje ručně.' };
  const organ = m[1].toUpperCase(), u = [];
  let d = m[2];
  if (d.length === 6) { d = '20' + d; u.push('Krátké datum – správně je RRRRMMDD (' + d + ').'); }
  let datum = '', rok = Number(d.slice(0, 4));
  if (d.length === 8) {
    const dt = new Date(rok, Number(d.slice(4, 6)) - 1, Number(d.slice(6, 8)));
    if (dt.getMonth() !== Number(d.slice(4, 6)) - 1 || dt.getDate() !== Number(d.slice(6, 8))) u.push('Neplatné datum ' + d + '.');
    else datum = dt;
  }
  if (rok < 1990 || rok > new Date().getFullYear() + 1) u.push('Podezřelý rok ' + rok + '.');
  if (zSlozky && zSlozky !== organ) u.push('Zkratka ' + organ + ' nesedí se složkou „' + slozkaOrganu + '“.');
  return { organ: organ, datum: datum, rok: rok, nazev: m[3].trim(), upozorneni: u.join(' ') };
}

/** Všechny soubory ve složce orgánů: [{ soubor, slozkaOrganu }]. */
function souboryOrganu_() {
  const disk = DriveApp.getFolderById(nastaveniWeb_('DISK_ID'));
  const it = disk.getFoldersByName(nastaveniWeb_('SLOZKA_ORGANY'));
  if (!it.hasNext()) throw new Error('Na disku chybí složka „' + nastaveniWeb_('SLOZKA_ORGANY') + '“.');
  const koren = it.next(), vysledek = [];
  const projit = (slozka, organ) => {
    const f = slozka.getFiles(); while (f.hasNext()) vysledek.push({ soubor: f.next(), slozkaOrganu: organ });
    const s = slozka.getFolders(); while (s.hasNext()) { const p = s.next(); projit(p, organ || p.getName()); }
  };
  projit(koren, '');
  return vysledek;
}

/** Spouští se každých 15 minut. Jde spustit i ručně z menu. */
function kontrolaDokumentu() {
  const lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return;
  try {
    const sh = dataSs_().getSheetByName('Dokumenty');
    const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String), col = k => h.indexOf(k);
    const data = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues() : [];
    const znamo = {}; data.forEach((r, i) => { if (r[col('Soubor – ID')]) znamo[r[col('Soubor – ID')]] = i; });
    const nove = [], naDisku = {}, zmeny = [];
    souboryOrganu_().forEach(({ soubor, slozkaOrganu }) => {
      const id = soubor.getId(); naDisku[id] = true;
      if (id in znamo) { prejmenovani_(sh, h, data[znamo[id]], znamo[id], soubor, slozkaOrganu, zmeny); return; }
      const p = rozebratNazev_(soubor.getName(), slozkaOrganu), ted = new Date();
      const hodnoty = { 'ID': 'D' + Utilities.formatDate(ted, 'Europe/Prague', 'yyMMddHHmmss') + nove.length, 'Soubor – ID': id,
        'Název souboru': soubor.getName(), 'Orgán': p.organ, 'Datum': p.datum, 'Rok': p.rok, 'Název': p.nazev,
        'Stav': 'ke schválení', 'Upozornění': p.upozorneni, 'Pro koho': 'veřejnost', 'Vytvořeno': ted, 'Vytvořil': 'Disk' };
      nove.push(h.map(k => k in hodnoty ? bezVzorce_(hodnoty[k]) : ''));
    });
    if (nove.length) {
      sh.getRange(sh.getLastRow() + 1, 1, nove.length, h.length).setValues(nove);
      zaznamZmenyHromadne_(nove.map(r => ['Disk', 'Dokumenty', r[col('ID')], 'vytvořeno', '', r[col('Název souboru')] + ' → ke schválení']));
    }
    // soubor smazaný z Disku → zveřejněný dokument se stáhne z webu
    let stazeno = 0;
    data.forEach((r, i) => {
      const id = r[col('Soubor – ID')];
      if (id && !naDisku[id] && r[col('Stav')] !== 'staženo' && r[col('Stav')] !== 'zamítnuto') {
        sh.getRange(i + 2, col('Stav') + 1).setValue('staženo');
        sh.getRange(i + 2, col('Upozornění') + 1).setValue('Soubor byl smazán nebo přesunut z Disku.');
        zaznamZmeny_('Disk', 'Dokumenty', r[col('ID')], 'upraveno', r[col('Stav')], 'staženo – soubor zmizel z Disku');
        stazeno++;
      }
    });
    if (stazeno) vycistitCache_();
    if (nove.length) upozornitSchvalovatele_(nove.map(r => ({ nazev: r[col('Název souboru')], organ: r[col('Orgán')], upoz: r[col('Upozornění')] })));
    if (zmeny.length) vycistitCache_();
    console.log('Nové: ' + nove.length + ', přejmenováno: ' + zmeny.length + ', staženo: ' + stazeno);
    return { nove: nove.length, prejmenovano: zmeny.length, stazeno: stazeno };
  } finally { lock.releaseLock(); }
}

/** Soubor přejmenovaný na Disku: u neschválených (a zamítnutých) se údaje přečtou znovu, zamítnutý se vrátí ke schválení. */
function prejmenovani_(sh, h, r, i, soubor, slozkaOrganu, zmeny) {
  const col = k => h.indexOf(k), jmeno = soubor.getName();
  if (r[col('Název souboru')] === jmeno) return;
  const stav = r[col('Stav')], pred = r[col('Název souboru')];
  r[col('Název souboru')] = bezVzorce_(jmeno);
  if (stav === 'ke schválení' || stav === 'zamítnuto') {
    const p = rozebratNazev_(jmeno, slozkaOrganu);
    r[col('Orgán')] = bezVzorce_(p.organ); r[col('Datum')] = p.datum; r[col('Rok')] = p.rok; r[col('Název')] = bezVzorce_(p.nazev);
    r[col('Upozornění')] = p.upozorneni; r[col('Stav')] = 'ke schválení';
  } else if (stav === 'zveřejněno') {
    r[col('Upozornění')] = 'Soubor přejmenován po zveřejnění. Údaje na webu se nezměnily – upravte je ručně, pokud je třeba.';
  }
  r[col('Upraveno')] = new Date(); r[col('Upravil')] = 'Disk';
  sh.getRange(i + 2, 1, 1, h.length).setValues([r]);
  zaznamZmeny_('Disk', 'Dokumenty', r[col('ID')], 'upraveno', pred, jmeno);
  zmeny.push(r[col('ID')]);
}

function upozornitSchvalovatele_(polozky) {
  const komu = radky_('Uživatelé').filter(u => ano_(u['Aktivní']) && (ano_(u['Dokumenty']) || ano_(u['Správce']))).map(u => normEmail_(u['E-mail']));
  if (!komu.length) return;
  const text = 'Dobrý den,\n\nna Disk přibyly dokumenty ke schválení:\n\n' +
    polozky.map(p => '• ' + p.nazev + (p.upoz ? '\n   ⚠ ' + p.upoz : '')).join('\n') +
    '\n\nSchválit je můžete v aplikaci nebo v tabulce OSH data (list Dokumenty → menu OSH data).\n' + dataSs_().getUrl() + '\n\nOSH Praha-západ';
  komu.forEach(e => posta_(e, 'Ke schválení: ' + polozky.length + ' ' + (polozky.length === 1 ? 'dokument' : polozky.length < 5 ? 'dokumenty' : 'dokumentů'), text));
}

/** Zveřejní, vrátí k opravě (zamítne) nebo stáhne dokument. kdo = e-mail schvalovatele. Vrací aktualizovaný řádek.
 *  vrátit = zamítnout s poznámkou ve sloupci Upozornění; po přejmenování souboru na Disku se dokument vrátí ke schválení.
 *  stáhnout = z webu zpět ke schválení (soubor zůstává na Disku). Stav „staženo“ nastavuje jen kontrola Disku, když soubor zmizí. */
function rozhodnoutDokument_(id, rozhodnuti, kdo, upravy, poznamka) {
  const sh = dataSs_().getSheetByName('Dokumenty');
  const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String), col = k => h.indexOf(k);
  const ids = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 1).getValues().map(r => String(r[0]));
  const i = ids.indexOf(String(id)); if (i < 0) throw new Error('Dokument ' + id + ' nenalezen.');
  const rng = sh.getRange(i + 2, 1, 1, h.length), r = rng.getValues()[0], pred = r[col('Stav')];
  upravy = upravy || {};
  ['Orgán', 'Datum', 'Rok', 'Název', 'Pro koho', 'Okrsek'].forEach(k => { if (upravy[k] !== undefined && col(k) >= 0) r[col(k)] = k === 'Datum' && upravy[k] ? new Date(upravy[k]) : bezVzorce_(upravy[k]); });
  const soubor = DriveApp.getFileById(r[col('Soubor – ID')]);
  let sdileni = '';
  if (rozhodnuti === 'zveřejnit') {
    if (!r[col('Orgán')] || !(r[col('Rok')] || r[col('Datum')]) || !r[col('Název')]) throw new Error('Doplňte orgán, datum/rok a název.');
    // Pro koho: veřejnost = odkaz pro kohokoli, jinak sdílení se skupinou sborů / okrsku (Portal.gs)
    sdileni = nastavitSdileni_(soubor, col('Pro koho') >= 0 ? r[col('Pro koho')] : 'veřejnost', col('Okrsek') >= 0 ? r[col('Okrsek')] : '');
    r[col('Stav')] = 'zveřejněno'; r[col('Veřejný odkaz')] = 'https://drive.google.com/file/d/' + soubor.getId() + '/view';
    r[col('Upozornění')] = '';
  } else if (rozhodnuti === 'zamítnout' || rozhodnuti === 'vrátit' || rozhodnuti === 'stáhnout') {
    try { nastavitSdileni_(soubor, null); } catch (e) { console.error(e); try { soubor.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); } catch (x) {} }
    r[col('Stav')] = rozhodnuti === 'stáhnout' ? 'ke schválení' : 'zamítnuto'; r[col('Veřejný odkaz')] = '';
    if (poznamka) r[col('Upozornění')] = bezVzorce_('Vráceno k opravě: ' + String(poznamka).slice(0, 1000));
  } else throw new Error('Neznámé rozhodnutí.');
  r[col('Schválil')] = kdo; r[col('Schváleno')] = new Date(); r[col('Upraveno')] = new Date(); r[col('Upravil')] = kdo;
  rng.setValues([r]);
  zaznamZmeny_(kdo, 'Dokumenty', id, rozhodnuti === 'zveřejnit' ? 'schváleno' : rozhodnuti === 'stáhnout' ? 'upraveno' : 'zamítnuto', pred, r[col('Stav')] + (sdileni ? ' – sdílení: ' + sdileni : ''));
  vycistitCache_();
  return h.reduce((o, k, j) => (o[k] = r[j] instanceof Date ? r[j].toISOString() : r[j], o), {});
}

function zaznamZmeny_(kdo, list, id, akce, pred, po) {
  dataSs_().getSheetByName('Záznam změn').appendRow([new Date(), kdo, list, id, akce, pred || '', po || ''].map(bezVzorce_));
}

/** Víc záznamů najednou (jedním zápisem): radky = [[kdo, list, id, akce, pred, po], …]. */
function zaznamZmenyHromadne_(radky) {
  if (!radky.length) return;
  const sh = dataSs_().getSheetByName('Záznam změn'), ted = new Date();
  sh.getRange(sh.getLastRow() + 1, 1, radky.length, 7).setValues(radky.map(r => [ted].concat(r.map(x => x == null ? '' : x)).map(bezVzorce_)));
}

/** Text od uživatele nebo z názvu souboru se nesmí v tabulce spustit jako vzorec (=, +, -, @ na začátku) – uloží se s apostrofem jako text. */
function bezVzorce_(v) { return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v; }

function vycistitCache_() { CacheService.getScriptCache().removeAll(['v_akce', 'v_terminy', 'v_dokumenty', 'v_sbory', 'v_organy']); }

/* ---------- API pro aplikaci (volá doPost) ---------- */

function apiDokumenty_(req) {
  const o = prihlaseny_(req.token);
  if (!o) return { ok: false, chyba: 'Nepřihlášen', odhlasen: true };
  if (!(o.role['Dokumenty'] || o.role['Správce'])) return { ok: false, chyba: 'Nemáte oprávnění schvalovat dokumenty.' };
  const vse = () => radky_('Dokumenty').map(r => Object.keys(r).reduce((x, k) => (x[k] = r[k] instanceof Date ? r[k].toISOString() : r[k], x), {}));
  if (req.akce === 'dokumentyKeSchvaleni') return { ok: true, data: vse().filter(r => r['Stav'] === 'ke schválení') };
  if (req.akce === 'dokumentyVse') return { ok: true, data: vse() };
  if (req.akce === 'zkontrolovatDisk') { const n = kontrolaDokumentu() || {}; return { ok: true, nove: n.nove || 0, data: vse() }; }
  if (req.akce === 'dokumentRozhodnout') {
    const u = req.upravy || {};
    const chyba = kontrolaTextu_(Object.assign({}, u, { 'Poznámka': req.poznamka }), { 'Název': 300, 'Poznámka': 1000 }) ||
      kontrolaVolby_(u['Orgán'], ['VV', 'OKRR', 'OORM', 'OORS', 'OORB', 'OORV', 'OSP'], 'Orgán') || kontrolaData_(u['Datum'], 'Datum') ||
      kontrolaVolby_(u['Pro koho'], PRO_KOHO, 'Pro koho') ||
      (u['Pro koho'] === 'okrsek' && !(Number(u['Okrsek']) >= 1 && Number(u['Okrsek']) <= 14) ? 'U „okrsek“ vyberte číslo okrsku 1–14.' : null) ||
      (u['Rok'] !== undefined && u['Rok'] !== '' && !(Number(u['Rok']) >= 1990 && Number(u['Rok']) <= new Date().getFullYear() + 1) ? 'Neplatný rok.' : null) ||
      kontrolaVolby_(req.rozhodnuti, ['zveřejnit', 'zamítnout', 'vrátit', 'stáhnout'], 'rozhodnutí');
    if (chyba) return { ok: false, chyba: chyba };
    return { ok: true, data: rozhodnoutDokument_(req.id, req.rozhodnuti, o.email, req.upravy, req.poznamka) };
  }
  return { ok: false, chyba: 'Neznámá akce' };
}

/* ---------- menu v tabulce (pro správce, než bude aplikace) ---------- */

function vybraneDokumenty_() {
  const sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() !== 'Dokumenty') throw new Error('Přepněte na list Dokumenty a označte řádky.');
  const ids = [];
  sh.getActiveRangeList().getRanges().forEach(rg => {
    for (let r = rg.getRow(); r < rg.getRow() + rg.getNumRows(); r++) if (r > 1) { const v = sh.getRange(r, 1).getValue(); if (v) ids.push(v); }
  });
  if (!ids.length) throw new Error('Označte alespoň jeden řádek s dokumentem.');
  return ids;
}
function hromadne_(rozhodnuti) {
  const kdo = Session.getActiveUser().getEmail(), o = opravneni_(kdo);
  if (!o || !(o.role['Dokumenty'] || o.role['Správce'])) throw new Error('Nemáte v listu Uživatelé roli Dokumenty ani Správce.');
  const chyby = [];
  vybraneDokumenty_().forEach(id => { try { rozhodnoutDokument_(id, rozhodnuti, kdo); } catch (e) { chyby.push(id + ': ' + e.message); } });
  SpreadsheetApp.getActive().toast(chyby.length ? 'Chyby: ' + chyby.join('; ') : 'Hotovo.', 'Dokumenty', 8);
}
function zverejnitVybrane() { hromadne_('zveřejnit'); }
function zamitnoutVybrane() { hromadne_('zamítnout'); }
function stahnoutVybrane() { hromadne_('stáhnout'); } // z webu zpět ke schválení
function kontrolaDokumentuTed() {
  const r = kontrolaDokumentu() || { nove: 0, prejmenovano: 0, stazeno: 0 };
  SpreadsheetApp.getActive().toast('Nové: ' + r.nove + ', přejmenováno: ' + (r.prejmenovano || 0) + ', staženo: ' + r.stazeno, 'Dokumenty', 6);
}
