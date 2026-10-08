/**
 * OSH data – B13 Majetek a rezervace nad stávající Evidencí majetku (Majetek.gs).
 *
 * Zdroj = tři tabulky staré aplikace „OSHPZ – Evidence majetku“ (běží dál beze změny):
 *   Nastavení → MAJETEK_CISELNIKY_ID (Kategorie, Stav_majetku, Stav_vypujčky, Osoby, Admins, Audit_log),
 *               MAJETEK_TABULKA_ID (Majetek, Audit_log), MAJETEK_VYPUJCKY_ID (Výpůjčky, Audit_log).
 *   Listy Majetek a Rezervace v OSH data se nepoužívají.
 *
 * Pravidla souběhu se starou aplikací:
 *   – čte a zapisuje podle názvů hlaviček, ID je vždy v 1. sloupci (u Výpůjček má hlavičku „m“);
 *   – strukturu listů, pořadí sloupců ani hlavičky nemění, řádky nemaže (vyřazení = Aktivní_záznam / Aktivní = NE);
 *   – ID jako stará aplikace: M/O/V + 6 znaků z UUID, číselníky = slug názvu (+ _2, _3 …);
 *   – výpůjčka: Stav_výpůjčky AKTIVNÍ a majetek PUJCENO; vrácení: Skutečné_vrácení, VRÁCENO, majetek K_DISPOZICI;
 *   – PO_TERMINU se nezapisuje (stará aplikace ho počítá z Plánovaného vrácení, zápis by výpůjčku skryl);
 *   – každý zápis pod zámkem a jen když se řádek od načtení nezměnil (jinak „Záznam mezitím upravil…“);
 *   – změny se zapisují do Záznamu změn v OSH data i do Audit_log příslušné tabulky (jako stará aplikace).
 * Oprávnění: role Majetek nebo Správce, kontrola na serveru.
 */

const MJ = {
  majetek:      { soubor: 'MAJETEK_TABULKA_ID',  list: 'Majetek',       prefix: 'M', entita: 'Majetek',
                  pole: ['Název', 'Kategorie', 'Popis', 'Výrobce_Model', 'Inventární_číslo', 'Rok_pořízení', 'Číslo_faktury', 'Pořizovací_cena', 'Kusů',
                         'Aktuální_stav', 'Umístění', 'SDH_vlastník', 'Poznámka', 'Datum_poslední_kontroly', 'Aktivní_záznam'],
                  cisla: ['Rok_pořízení', 'Pořizovací_cena', 'Kusů'], data: ['Datum_poslední_kontroly'], povinne: ['Název'],
                  nove: { 'Kusů': 1, 'Pořizovací_cena': 0, 'Foto_URL': '', 'Aktivní_záznam': 'ANO' }, nazev: r => r['Název'] },
  osoba:        { soubor: 'MAJETEK_CISELNIKY_ID', list: 'Osoby',        prefix: 'O', entita: 'Osoby',
                  pole: ['Jméno', 'Příjmení', 'SDH', 'Telefon', 'Email', 'Aktivní', 'Poznámka'], cisla: [], data: [], povinne: ['Jméno', 'Příjmení'],
                  nove: { 'Aktivní': 'ANO' }, nazev: r => r['Jméno'] + ' ' + r['Příjmení'] },
  kategorie:    { soubor: 'MAJETEK_CISELNIKY_ID', list: 'Kategorie',     slug: 'Název_Kategorie', entita: 'Kategorie',
                  pole: ['Název_Kategorie', 'Popis', 'Ikona'], cisla: [], data: [], povinne: ['Název_Kategorie'], nove: {}, nazev: r => r['Název_Kategorie'] },
  stavMajetku:  { soubor: 'MAJETEK_CISELNIKY_ID', list: 'Stav_majetku',  slug: 'Název_Stavu', entita: 'StavMajetku',
                  pole: ['Název_Stavu', 'Popis', 'Barva'], cisla: [], data: [], povinne: ['Název_Stavu'], nove: { 'Barva': '#95A5A6' }, nazev: r => r['Název_Stavu'] },
  stavVypujcky: { soubor: 'MAJETEK_CISELNIKY_ID', list: 'Stav_vypujčky', slug: 'Název_Stavu', entita: 'StavVypujcky',
                  pole: ['Název_Stavu', 'Popis', 'Barva'], cisla: [], data: [], povinne: ['Název_Stavu'], nove: { 'Barva': '#95A5A6' }, nazev: r => r['Název_Stavu'] }
};
const MJ_VYP = { soubor: 'MAJETEK_VYPUJCKY_ID', list: 'Výpůjčky', entita: 'Výpůjčky' };
const MJ_AKTIVNI_VYP = ['AKTIVNÍ', 'ČEKÁ_NA_VRÁCENÍ', 'PO_TERMINU'];
const MJ_KOLIZE = 'Záznam mezitím upravil někdo jiný, načtěte znovu.';

let _mjSs = {};
function mjSoubor_(klic) {
  const id = nastaveniWeb_(klic);
  if (!id) throw new Error('V Nastavení chybí ' + klic + ' – spusťte zalozitStrukturu.');
  return _mjSs[id] || (_mjSs[id] = SpreadsheetApp.openById(id));
}
function mjList_(klic, nazev) {
  const sh = mjSoubor_(klic).getSheetByName(nazev);
  if (!sh) throw new Error('V evidenci majetku chybí list „' + nazev + '“.');
  return sh;
}
/** Hodnota buňky jako text – stejně jako formatValue staré aplikace (datum → yyyy-MM-dd). */
function mjFmt_(v) { return v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd') : v == null ? '' : String(v); }
function mjDnes_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function mjId_(p) { return p + Utilities.getUuid().replace(/-/g, '').substring(0, 6).toUpperCase(); }
function mjSlug_(t) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').substring(0, 30) || mjId_('');
}
/** Celý list: hlavička + řádky jako objekty (_id = 1. sloupec, _r = číslo řádku). */
function mjNacist_(sh) {
  const v = sh.getDataRange().getValues(), h = v.shift().map(String);
  return { h: h, rows: v.map((r, i) => { const o = { _id: mjFmt_(r[0]), _r: i + 2 }; h.forEach((k, j) => { if (k) o[k] = mjFmt_(r[j]); }); return o; }).filter(o => o._id) };
}
/** Najde řádek podle ID (vždy znovu – stará aplikace řádky maže a posouvá). */
function mjRadek_(sh, id) {
  const ids = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 1).getValues();
  for (let i = 0; i < ids.length; i++) if (mjFmt_(ids[i][0]) === String(id)) return i + 2;
  return -1;
}
function mjRadekObjekt_(sh, h, r) { const v = sh.getRange(r, 1, 1, h.length).getValues()[0], o = { _id: mjFmt_(v[0]) }; h.forEach((k, j) => { if (k) o[k] = mjFmt_(v[j]); }); return o; }
/** Kontrola souběhu: hodnoty, které klient viděl, musí v tabulce pořád být. */
function mjKolize_(aktualni, puvodni) {
  return Object.keys(puvodni || {}).some(k => k in aktualni && String(aktualni[k]) !== String(puvodni[k] == null ? '' : puvodni[k]));
}
function mjHodnota_(def, k, v) {
  if (def.cisla.indexOf(k) >= 0) return v === '' || v == null ? '' : Number(v);
  if (def.data.indexOf(k) >= 0) return v ? String(v).slice(0, 10) : '';
  return bezVzorce_(String(v == null ? '' : v).trim());
}
/** Audit: OSH data (Záznam změn) + Audit_log v tabulce evidence (formát staré aplikace). */
function mjAudit_(soubor, email, akce, entita, id, detail, akceOsh) {
  try { mjSoubor_(soubor).getSheetByName('Audit_log').appendRow([Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'), email, akce, entita, id || '', bezVzorce_(String(detail || ''))]); }
  catch (e) { console.error('Audit_log: ' + e.message); }
  zaznamZmeny_(email, 'Majetek: ' + entita, id, akceOsh || 'upraveno', '', String(detail || '').slice(0, 400));
}

function smiMajetek_(o) { return !!(o && (o.role['Majetek'] || o.role['Správce'])); }

function apiMajetek_(req) {
  const o = prihlaseny_(req.token);
  if (!o) return { ok: false, chyba: 'Nepřihlášen', odhlasen: true };
  if (!smiMajetek_(o)) return { ok: false, chyba: 'Evidence majetku je jen pro roli Majetek nebo Správce.' };
  if (req.akce === 'majetekData') return mjDataCache_(!!req.cerstva);
  if (req.akce === 'majetekFoto') return mjFoto_(req);
  const zapisy = { majetekUlozit: mjUlozit_, majetekVyradit: mjVyradit_, vypujckaNova: mjVypujcka_, vypujckaVratit: mjVratit_, majetekFotoNahrat: mjFotoNahrat_ };
  if (!zapisy[req.akce]) return { ok: false, chyba: 'Neznámá akce' };
  const r = zapisy[req.akce](o, req);
  // po zápisu (i neúspěšném – kolize) rovnou čerstvá data, aplikace je nemusí načítat znovu
  r.data = mjDataCache_(true);
  return r;
}

/** Data evidence: 2 minuty v mezipaměti (zápisy z této aplikace ji obnoví; změny ze staré aplikace jsou vidět nejpozději za 2 min, hned po „Načíst znovu“). */
function mjDataCache_(cerstva) {
  const c = CacheService.getScriptCache();
  if (!cerstva) { const z = c.get('mj_data'); if (z) return JSON.parse(z); }
  const d = mjData_();
  try { c.put('mj_data', JSON.stringify(d), 120); } catch (e) { console.warn('Data evidence se nevešla do mezipaměti: ' + e.message); }
  return d;
}

function mjData_() {
  const ob = (def) => mjNacist_(mjList_(def.soubor, def.list)).rows;
  return { ok: true, dnes: mjDnes_(), majetek: ob(MJ.majetek), osoby: ob(MJ.osoba), kategorie: ob(MJ.kategorie), stavMajetku: ob(MJ.stavMajetku),
    stavVypujcky: ob(MJ.stavVypujcky), vypujcky: ob(MJ_VYP) };
}

/** Přidat / upravit majetek, osobu nebo položku číselníku. req: typ, id?, data {hlavička: hodnota}, puvodni {…}. */
function mjUlozit_(o, req) {
  const def = MJ[req.typ];
  if (!def) return { ok: false, chyba: 'Neznámý typ záznamu.' };
  const d = req.data || {}, pravidla = {};
  def.pole.filter(k => def.cisla.indexOf(k) < 0 && def.data.indexOf(k) < 0).forEach(k => { pravidla[k] = k === 'Popis' || k === 'Poznámka' ? 2000 : 200; });
  const chyba = kontrolaTextu_(d, pravidla) || def.povinne.map(k => (req.id ? d[k] !== undefined && !String(d[k]).trim() : !String(d[k] || '').trim()) ? 'Vyplňte pole „' + k.replace(/_/g, ' ') + '“.' : null).find(Boolean) ||
    def.cisla.map(k => d[k] !== undefined && d[k] !== '' && isNaN(Number(d[k])) ? 'Pole „' + k.replace(/_/g, ' ') + '“ musí být číslo.' : null).find(Boolean) ||
    def.data.map(k => d[k] && !/^\d{4}-\d{2}-\d{2}$/.test(String(d[k])) ? 'Neplatné datum v poli „' + k.replace(/_/g, ' ') + '“.' : null).find(Boolean) ||
    ((req.typ === 'stavMajetku' || req.typ === 'stavVypujcky') && d['Barva'] && !/^#[0-9a-fA-F]{6}$/.test(d['Barva']) ? 'Barvu zadejte jako #RRGGBB.' : null);
  if (chyba) return { ok: false, chyba: chyba };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = mjList_(def.soubor, def.list), h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    if (req.typ === 'majetek') { // jen číselníky, ne celá evidence
      if (d['Kategorie'] && !mjNacist_(mjList_(MJ.kategorie.soubor, MJ.kategorie.list)).rows.some(x => x._id === d['Kategorie'])) return { ok: false, chyba: 'Neznámá kategorie.' };
      if (d['Aktuální_stav'] && !mjNacist_(mjList_(MJ.stavMajetku.soubor, MJ.stavMajetku.list)).rows.some(x => x._id === d['Aktuální_stav'])) return { ok: false, chyba: 'Neznámý stav majetku.' };
    }
    if (!req.id) {
      // nový řádek v pořadí sloupců listu
      const id = def.slug ? (() => { const s = mjSlug_(d[def.slug]), ex = mjNacist_(sh).rows.map(r => r._id); let n = s, i = 2; while (ex.indexOf(n) >= 0) n = s + '_' + i++; return n; })() : mjId_(def.prefix);
      const hod = Object.assign({}, def.nove);
      def.pole.forEach(k => { if (d[k] !== undefined && d[k] !== '') hod[k] = mjHodnota_(def, k, d[k]); });
      sh.appendRow(h.map((k, j) => j === 0 ? id : k in hod ? hod[k] : ''));
      mjAudit_(def.soubor, o.email, 'PŘIDAT', def.entita, id, def.nazev(Object.assign({}, d)), 'vytvořeno');
      return { ok: true, id: id };
    }
    const r = mjRadek_(sh, req.id);
    if (r < 0) return { ok: false, chyba: 'Záznam už v evidenci není (možná ho někdo smazal ve staré aplikaci). Načtěte znovu.' };
    const akt = mjRadekObjekt_(sh, h, r);
    if (mjKolize_(akt, req.puvodni)) return { ok: false, chyba: MJ_KOLIZE, kolize: true };
    const zmeny = [];
    def.pole.forEach(k => {
      if (d[k] === undefined || h.indexOf(k) < 0) return;
      const nova = mjHodnota_(def, k, d[k]);
      if (String(akt[k]) === mjFmt_(nova).replace(/^'/, '')) return;
      sh.getRange(r, h.indexOf(k) + 1).setValue(nova);
      zmeny.push(k + ': ' + akt[k] + ' → ' + mjFmt_(nova));
    });
    if (zmeny.length) mjAudit_(def.soubor, o.email, 'UPRAVIT', def.entita, req.id, def.nazev(Object.assign({}, akt, d)) + ' (' + zmeny.join('; ') + ')');
    return { ok: true, id: req.id, zmen: zmeny.length };
  } finally { lock.releaseLock(); }
}

/** Vyřazení bez mazání: majetek → Aktivní_záznam NE (+ stav VYRAZENO, ať ho stará aplikace ukáže jako vyřazený), osoba → Aktivní NE. */
function mjVyradit_(o, req) {
  const def = MJ[req.typ];
  if (!def || (req.typ !== 'majetek' && req.typ !== 'osoba')) return { ok: false, chyba: 'Vyřadit jde jen majetek nebo osobu.' };
  const data = req.typ === 'majetek' ? { 'Aktivní_záznam': 'NE' } : { 'Aktivní': 'NE' };
  if (req.typ === 'majetek') {
    const vyp = mjNacist_(mjList_(MJ_VYP.soubor, MJ_VYP.list)).rows;
    if (vyp.some(v => v['ID_Majetku'] === req.id && MJ_AKTIVNI_VYP.indexOf(v['Stav_výpůjčky']) >= 0)) return { ok: false, chyba: 'Majetek je půjčený – nejdřív výpůjčku ukončete.' };
    if (mjNacist_(mjList_(MJ.stavMajetku.soubor, MJ.stavMajetku.list)).rows.some(x => x._id === 'VYRAZENO')) data['Aktuální_stav'] = 'VYRAZENO';
  }
  return mjUlozit_(o, { typ: req.typ, id: req.id, data: data, puvodni: req.puvodni });
}

/** Nová výpůjčka – jen majetek aktivní a K_DISPOZICI. */
function mjVypujcka_(o, req) {
  const d = req.data || {};
  const chyba = kontrolaTextu_(d, { 'Jméno_příjmení': 200, 'SDH_příjemce': 200, 'Účel_použití': 300, 'Místo_použití': 300, 'Stav_při_půjčení': 300, 'Poznámka': 2000 }) ||
    (!d['ID_Majetku'] ? 'Vyberte majetek.' : null) || (!String(d['Jméno_příjmení'] || '').trim() ? 'Vyplňte jméno a příjmení.' : null) ||
    (!/^\d{4}-\d{2}-\d{2}$/.test(String(d['Datum_půjčení'] || '')) ? 'Vyplňte datum půjčení.' : null) ||
    (d['Plánované_vrácení'] && (!/^\d{4}-\d{2}-\d{2}$/.test(d['Plánované_vrácení']) || d['Plánované_vrácení'] < d['Datum_půjčení']) ? 'Plánované vrácení musí být po datu půjčení.' : null);
  if (chyba) return { ok: false, chyba: chyba };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const shM = mjList_(MJ.majetek.soubor, MJ.majetek.list), hM = shM.getRange(1, 1, 1, shM.getLastColumn()).getValues()[0].map(String);
    const rM = mjRadek_(shM, d['ID_Majetku']);
    if (rM < 0) return { ok: false, chyba: 'Majetek v evidenci není.' };
    const m = mjRadekObjekt_(shM, hM, rM);
    if (m['Aktivní_záznam'] === 'NE') return { ok: false, chyba: 'Majetek je vyřazený.' };
    if (m['Aktuální_stav'] !== 'K_DISPOZICI') return { ok: false, chyba: 'Majetek není k dispozici (stav ' + (m['Aktuální_stav'] || 'neuveden') + '). ' + MJ_KOLIZE, kolize: true };
    let osoba = null;
    if (d['ID_Osoby']) {
      osoba = mjNacist_(mjList_(MJ.osoba.soubor, MJ.osoba.list)).rows.find(x => x._id === d['ID_Osoby']);
      if (!osoba) return { ok: false, chyba: 'Osoba v evidenci není.' };
    }
    const shV = mjList_(MJ_VYP.soubor, MJ_VYP.list), hV = shV.getRange(1, 1, 1, shV.getLastColumn()).getValues()[0].map(String);
    const id = mjId_('V'), t = v => bezVzorce_(String(v || '').trim());
    const hod = { 'ID_Majetku': m._id, 'Název_věci': t(m['Název']), 'ID_Osoby': osoba ? osoba._id : '', 'Jméno_příjmení': t(d['Jméno_příjmení']), 'SDH_příjemce': t(d['SDH_příjemce']),
      'Datum_půjčení': d['Datum_půjčení'], 'Plánované_vrácení': d['Plánované_vrácení'] || '', 'Skutečné_vrácení': '', 'Stav_výpůjčky': 'AKTIVNÍ',
      'Účel_použití': t(d['Účel_použití']), 'Místo_použití': t(d['Místo_použití']), 'Stav_při_půjčení': t(d['Stav_při_půjčení']), 'Stav_při_vrácení': '',
      'Poznámka': t(d['Poznámka']), 'Schválil': o.email };
    shV.appendRow(hV.map((k, j) => j === 0 ? id : k in hod ? hod[k] : ''));
    shM.getRange(rM, hM.indexOf('Aktuální_stav') + 1).setValue('PUJCENO');
    mjAudit_(MJ_VYP.soubor, o.email, 'VÝPŮJČKA', 'Výpůjčky', id, m['Název'] + ' → ' + hod['Jméno_příjmení'], 'vytvořeno');
    mjAudit_(MJ.majetek.soubor, o.email, 'STAV', 'Majetek', m._id, 'PUJCENO');
    return { ok: true, id: id };
  } finally { lock.releaseLock(); }
}

/** Vrácení: Skutečné_vrácení = dnes, VRÁCENO, Stav_při_vrácení; majetek K_DISPOZICI (nebo zvolený stav). */
function mjVratit_(o, req) {
  const d = req.data || {}, stavPo = String(req.stavMajetku || 'K_DISPOZICI');
  const chyba = kontrolaTextu_(d, { 'Stav_při_vrácení': 300, 'Poznámka': 2000 });
  if (chyba) return { ok: false, chyba: chyba };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (!mjNacist_(mjList_(MJ.stavMajetku.soubor, MJ.stavMajetku.list)).rows.some(x => x._id === stavPo)) return { ok: false, chyba: 'Neznámý stav majetku.' };
    const shV = mjList_(MJ_VYP.soubor, MJ_VYP.list), hV = shV.getRange(1, 1, 1, shV.getLastColumn()).getValues()[0].map(String);
    const rV = mjRadek_(shV, req.id);
    if (rV < 0) return { ok: false, chyba: 'Výpůjčka v evidenci není. Načtěte znovu.' };
    const v = mjRadekObjekt_(shV, hV, rV);
    if (mjKolize_(v, req.puvodni) || MJ_AKTIVNI_VYP.indexOf(v['Stav_výpůjčky']) < 0) return { ok: false, chyba: MJ_KOLIZE, kolize: true };
    const set = (k, x) => { if (hV.indexOf(k) >= 0) shV.getRange(rV, hV.indexOf(k) + 1).setValue(x); };
    set('Skutečné_vrácení', mjDnes_()); set('Stav_výpůjčky', 'VRÁCENO');
    if (d['Stav_při_vrácení'] !== undefined) set('Stav_při_vrácení', bezVzorce_(String(d['Stav_při_vrácení']).trim()));
    if (d['Poznámka'] !== undefined && String(d['Poznámka']) !== v['Poznámka']) set('Poznámka', bezVzorce_(String(d['Poznámka']).trim()));
    if (v['ID_Majetku']) {
      const shM = mjList_(MJ.majetek.soubor, MJ.majetek.list), hM = shM.getRange(1, 1, 1, shM.getLastColumn()).getValues()[0].map(String), rM = mjRadek_(shM, v['ID_Majetku']);
      if (rM > 0) { shM.getRange(rM, hM.indexOf('Aktuální_stav') + 1).setValue(stavPo); mjAudit_(MJ.majetek.soubor, o.email, 'STAV', 'Majetek', v['ID_Majetku'], stavPo); }
    }
    mjAudit_(MJ_VYP.soubor, o.email, 'VRÁCENÍ_POTVRZENO', 'Výpůjčky', req.id, 'Potvrdil: ' + o.email + (d['Stav_při_vrácení'] ? ' – ' + d['Stav_při_vrácení'] : ''));
    return { ok: true };
  } finally { lock.releaseLock(); }
}

/* ---------- fotky ---------- */

function mjFotoId_(url) { const m = String(url || '').match(/(?:\/d\/|id=)([\w-]{20,})/); return m ? m[1] : ''; }

/** Náhled fotky jako data: URL (funguje i bez přihlášení do Google a bez úpravy CSP). */
function mjFoto_(req) {
  const m = mjNacist_(mjList_(MJ.majetek.soubor, MJ.majetek.list)).rows.find(x => x._id === req.id);
  const fid = m && mjFotoId_(m['Foto_URL']);
  if (!fid) return { ok: true, foto: '' };
  try {
    const f = DriveApp.getFileById(fid);
    let b = f.getThumbnail();
    if (!b && /^image\//.test(f.getMimeType()) && f.getSize() < 3 * 1024 * 1024) b = f.getBlob();
    return { ok: true, foto: b ? 'data:' + (b.getContentType() || 'image/png') + ';base64,' + Utilities.base64Encode(b.getBytes()) : '', url: f.getUrl() };
  } catch (e) { return { ok: true, foto: '', chybaFoto: 'Fotku se nepodařilo otevřít (' + e.message + ').' }; }
}

/** Nová fotka do složky „Foto majetku“ na sdíleném disku evidence (MAJETEK_FOTO_DISK) a odkaz do Foto_URL. */
function mjFotoNahrat_(o, req) {
  let bajty;
  try { bajty = Utilities.base64Decode(String(req.data || '')); } catch (e) { return { ok: false, chyba: 'Soubor se nepodařilo přečíst.' }; }
  const mime = String(req.mime || ''), nazev = String(req.nazev || 'foto').trim();
  if (!/^image\//.test(mime)) return { ok: false, chyba: 'Fotka musí být obrázek (JPG, PNG, HEIC, WEBP).' };
  const chyba = overitSoubor_(nazev, mime, bajty.length);
  if (chyba) return { ok: false, chyba: chyba };
  const disk = DriveApp.getFolderById(nastaveniWeb_('MAJETEK_FOTO_DISK') || '0AFpVxmNLBZyoUk9PVA');
  const it = disk.getFoldersByName('Foto majetku'), slozka = it.hasNext() ? it.next() : disk.createFolder('Foto majetku');
  const f = slozka.createFile(Utilities.newBlob(bajty, mime, req.id + ' ' + nazev));
  const r = mjUlozitFotoUrl_(o, req.id, f.getUrl(), req.puvodni);
  if (!r.ok) { try { f.setTrashed(true); } catch (e) {} }
  return r;
}
function mjUlozitFotoUrl_(o, id, url, puvodni) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = mjList_(MJ.majetek.soubor, MJ.majetek.list), h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String), r = mjRadek_(sh, id);
    if (r < 0) return { ok: false, chyba: 'Majetek v evidenci není.' };
    if (mjKolize_(mjRadekObjekt_(sh, h, r), puvodni)) return { ok: false, chyba: MJ_KOLIZE, kolize: true };
    sh.getRange(r, h.indexOf('Foto_URL') + 1).setValue(url);
    mjAudit_(MJ.majetek.soubor, o.email, 'UPRAVIT', 'Majetek', id, 'Foto_URL: ' + url);
    return { ok: true, url: url };
  } finally { lock.releaseLock(); }
}

/* ---------- denní souhrn výpůjček po termínu ---------- */

/** Časovač každý den v 7:30: výpůjčky po termínu → role Majetek (jinak spravci@). V režimu TEST jen TEST_EMAIL. */
function souhrnVypujcekPoTerminu() {
  const dnes = mjDnes_();
  const po = mjNacist_(mjList_(MJ_VYP.soubor, MJ_VYP.list)).rows
    .filter(v => MJ_AKTIVNI_VYP.indexOf(v['Stav_výpůjčky']) >= 0 && v['Plánované_vrácení'] && v['Plánované_vrácení'] < dnes)
    .sort((a, b) => a['Plánované_vrácení'].localeCompare(b['Plánované_vrácení']));
  if (!po.length) return 0;
  const dnu = d => Math.round((new Date(dnes) - new Date(d)) / 864e5);
  const pol = po.map(v => [v['Název_věci'] || v['ID_Majetku'], (v['Jméno_příjmení'] || '?') + (v['SDH_příjemce'] ? ', ' + v['SDH_příjemce'] : '') + ' – mělo se vrátit ' + v['Plánované_vrácení'] + ' (' + dnu(v['Plánované_vrácení']) + ' dní po termínu)']);
  const dom = '@' + (nastaveniWeb_('DOMENA') || 'oshpz.cz');
  let komu = radkyRychle_('Uživatelé').filter(u => ano_(u['Aktivní']) && ano_(u['Majetek'])).map(u => normEmail_(u['E-mail']));
  if (!komu.length) komu = ['spravci' + dom];
  const predmet = 'Výpůjčky po termínu: ' + po.length;
  const url = (nastaveniWeb_('WEB_URL') || '') + '/Aplikace%20OSH.dc.html';
  const html = sablona_(predmet, 'Tyto výpůjčky z evidence majetku jsou po termínu vrácení. Kontaktujte prosím příjemce.', pol, ['Otevřít evidenci majetku', url]);
  const text = pol.map(p => '• ' + p[0] + ' – ' + p[1]).join('\n') + '\n\n' + url;
  komu.forEach(e => { try { posta_(e, predmet, text, html); } catch (x) { console.error(x); } });
  return po.length;
}
