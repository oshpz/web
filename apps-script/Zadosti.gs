/**
 * OSH data – žádosti sborů o pořádání akcí a soutěží (list Žádosti).
 * Nový soubor „Zadosti“ ve stejném projektu.
 *
 * Sbor (portál): podá, upraví nebo stáhne žádost za svůj sbor – jen ve stavu „podáno“ nebo „vráceno k doplnění“.
 *   Přílohy (PDF, obrázky; overitSoubor_) jdou do složky Žádosti/<ID> na sdíleném disku.
 * Okres (role Akce nebo Správce): seznam se souběhy, Schválit / Vrátit k doplnění / Zamítnout.
 *   Schválení vytvoří řádek v listu Akce (akce sboru / soutěž, pořadatel = sbor, zveřejněno) a propíše ho do kalendáře.
 * E-maily přes posta_ (režim TEST → jen TEST_EMAIL). Vše se zapisuje do Záznamu změn.
 */

const LIST_ZADOSTI = 'Žádosti';
const ZADOST_TYPY = ['pořádání akce', 'pořádání soutěže', 'jiné'];
const ZADOST_UPRAVITELNE = ['podáno', 'vráceno k doplnění'];
const ZADOST_AKTIVNI = ['podáno', 'vráceno k doplnění', 'schváleno'];
const CAS_VZOR = /^([01]\d|2[0-3]):[0-5]\d$/;
const ZADOST_MAX_PRILOH = 20, ZADOST_LIMIT_ZA_HODINU = 20;
/** Datum + čas „HH:MM“ (v časovém pásmu skriptu). Bez času = půlnoc → v kalendáři celodenní. */
/** Hodnota buňky Čas od/do jako „HH:MM“ (Tabulky ji občas převedou na čas). */
function casText_(v) { return v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'HH:mm') : String(v == null ? '' : v).trim(); }
function sCasem_(den, cas) { const x = new Date(den); if (cas && CAS_VZOR.test(String(cas))) { const [h, m] = String(cas).split(':'); x.setHours(+h, +m, 0, 0); } return x; }

function smiZadostiOkres_(o) { return !!(o && (o.role['Akce'] || o.role['Správce'])); }
const denZ_ = d => d instanceof Date ? Utilities.formatDate(d, 'Europe/Prague', 'yyyy-MM-dd') : (d ? String(d).slice(0, 10) : '');

/** Řádek žádosti pro aplikaci. prilohy = true → načte i seznam souborů ze složky. */
function zadostJson_(r, prilohy, sOdkazy) {
  const iso = v => v instanceof Date ? v.toISOString() : v;
  const o = {};
  ['ID', 'Sbor', 'Typ', 'Název', 'Datum', 'Do', 'Čas od', 'Čas do', 'Místo', 'Pro koho', 'Kontakt', 'Popis', 'Vybavení', 'Stav', 'Poznámka', 'Vyřídil', 'Vyřízeno', 'Akce – ID', 'Vytvořeno', 'Upraveno']
    .forEach(k => { o[k] = /^Čas /.test(k) ? casText_(r[k]) : iso(r[k] == null ? '' : r[k]); });
  o.prilohy = [];
  const slozka = String(r['Přílohy – složka'] || '').match(/folders\/([\w-]+)/);
  if (prilohy && slozka) {
    try { const it = DriveApp.getFolderById(slozka[1]).getFiles(); while (it.hasNext()) { const f = it.next(); o.prilohy.push(sOdkazy ? { nazev: f.getName(), url: f.getUrl() } : { nazev: f.getName() }); } }
    catch (e) { console.error(e); }
  }
  return o;
}

function apiZadosti_(req) {
  const o = prihlaseny_(req.token);
  if (!o) return { ok: false, chyba: 'Nepřihlášen', odhlasen: true };
  if (req.akce === 'zadostiOkres' || req.akce === 'zadostRozhodnout' || req.akce === 'zadostPrilohy') {
    if (!smiZadostiOkres_(o)) return { ok: false, chyba: 'Žádosti sborů vyřizuje role Akce nebo Správce.' };
    if (req.akce === 'zadostPrilohy') { // přílohy vyřízené žádosti až v detailu (seznam je bez nich – S5 revize)
      const z = radky_(LIST_ZADOSTI).find(r => String(r['ID']) === String(req.id || ''));
      return z ? { ok: true, id: z['ID'], prilohy: zadostJson_(z, true, true).prilohy } : { ok: false, chyba: 'Žádost nenalezena.' };
    }
    return req.akce === 'zadostiOkres' ? zadostiOkres_() : zadostRozhodnout_(o, req);
  }
  // portál sboru: vždy jen vlastní sbor (pohledSboru_ ověří členství)
  const u = pohledSboru_(o, req.sbor);
  if (!u) return { ok: false, chyba: 'Ke sboru ' + (req.sbor || '(nevybrán)') + ' nemáte přístup. Odhlaste se a přihlaste znovu, nebo požádejte okres o zařazení do skupiny sboru.' };
  const nazevSboru = u.sbor.sbor;
  if (req.akce === 'zadostiSbor') {
    const data = radky_(LIST_ZADOSTI).filter(r => r['Sbor'] === nazevSboru && r['ID']).map(r => zadostJson_(r, true, false)).reverse();
    let nabidka = [];
    try { // vybavení okresu: jen věci nabízené sborům (MajetekSbory.gs); bez evidence majetku žádosti fungují dál
      nabidka = nabidkaProSbor_(nazevSboru);
      const rez = rezervace_().filter(r => r.sbor === nazevSboru), md = rez.length ? mjDataCache_(false) : null;
      data.forEach(z => { const moje = rez.filter(r => r.zadost === z['ID']); z.vybaveni = moje.length ? vybaveniZadosti_(moje, md, rez, '', '', z['ID'], false) : []; });
    } catch (e) { console.error('Vybavení pro sbor: ' + e.message); }
    return { ok: true, data: data, nabidka: nabidka };
  }
  if (req.akce === 'zadostUlozit') return zadostUlozit_(o, nazevSboru, req);
  if (req.akce === 'zadostStahnout') return zadostZmenitStav_(o, nazevSboru, String(req.id || ''), 'staženo');
  if (req.akce === 'zadostPriloha') return zadostPriloha_(o, nazevSboru, req);
  return { ok: false, chyba: 'Neznámá akce' };
}

/* ---------- sbor ---------- */

function kontrolaZadosti_(d) {
  return kontrolaTextu_(d, { 'Název': 200, 'Místo': 200, 'Popis': 5000, 'Vybavení': 1000, 'Kontakt': 254 }) ||
    kontrolaVolby_(d['Typ'], ZADOST_TYPY, 'Typ') || kontrolaVolby_(d['Pro koho'], PRO_KOHO.filter(x => x !== 'jen okres'), 'Pro koho') ||
    kontrolaData_(d['Datum'], 'Datum od') || kontrolaData_(d['Do'], 'Datum do') ||
    (!String(d['Název'] || '').trim() ? 'Vyplňte název.' : null) || (!d['Typ'] ? 'Vyberte typ žádosti.' : null) || (!d['Datum'] ? 'Vyplňte datum.' : null) ||
    (d['Do'] && new Date(d['Do']) < new Date(d['Datum']) ? 'Konec je před začátkem.' : null) ||
    (d['Čas od'] && !CAS_VZOR.test(d['Čas od']) ? 'Čas začátku zadejte jako HH:MM.' : null) || (d['Čas do'] && !CAS_VZOR.test(d['Čas do']) ? 'Čas konce zadejte jako HH:MM.' : null) ||
    (d['Čas do'] && !d['Čas od'] ? 'Vyplňte i čas začátku.' : null) ||
    (d['Čas do'] && d['Čas od'] && (!d['Do'] || denZ_(new Date(d['Do'])) === denZ_(new Date(d['Datum']))) && d['Čas do'] <= d['Čas od'] ? 'Konec musí být po začátku.' : null) ||
    (!/^[^@\s<>"']+@[^@\s<>"']+\.[^@\s<>"']+$/.test(String(d['Kontakt'] || '')) ? 'Vyplňte platný kontaktní e-mail.' : null);
}

function zadostUlozit_(o, nazevSboru, req) {
  const d = req.data || {}, chyba = kontrolaZadosti_(d);
  if (chyba) return { ok: false, chyba: chyba };
  // každé uložení posílá e-mail okresu – limit proti zahlcení
  if (limit_('zadost-ulozit', o.email, ZADOST_LIMIT_ZA_HODINU, 3600)) return { ok: false, chyba: 'Příliš mnoho uložení žádostí za hodinu. Zkuste to později.' };
  // věci z nabídky okresu (pole chybí = starší aplikace → rezervace beze změny)
  const vyb = Array.isArray(d['Vybavení – ID']) ? d['Vybavení – ID'].map(String).filter((x, i, a) => x && a.indexOf(x) === i) : null;
  const odV = denZ_(new Date(d['Datum'])), doV = d['Do'] ? denZ_(new Date(d['Do'])) : odV;
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = dataSs_().getSheetByName(LIST_ZADOSTI), h = hlavicka_(sh), col = k => h.indexOf(k), ted = new Date();
    const ids = sh.getLastRow() > 1 ? sh.getRange(2, col('ID') + 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
    const i = req.id ? ids.indexOf(String(req.id)) : -1;
    if (req.id && i < 0) return { ok: false, chyba: 'Žádost nenalezena.' };
    const r = i >= 0 ? sh.getRange(i + 2, 1, 1, h.length).getValues()[0] : h.map(() => '');
    if (i >= 0 && r[col('Sbor')] !== nazevSboru) return { ok: false, chyba: 'Žádost patří jinému sboru.' };
    const pred = i >= 0 ? r[col('Stav')] : '';
    if (i >= 0 && ZADOST_UPRAVITELNE.indexOf(pred) < 0) return { ok: false, chyba: 'Žádost ve stavu „' + pred + '“ už nejde upravit.' };
    const chybaV = vyb ? kontrolaVybaveni_(vyb, odV, doV, i >= 0 ? String(req.id) : '') : null;
    if (chybaV) return { ok: false, chyba: chybaV };
    const set = (k, v) => { if (col(k) >= 0) r[col(k)] = v; };
    set('Typ', d['Typ']); set('Název', bezVzorce_(String(d['Název']).trim())); set('Datum', new Date(d['Datum'])); set('Do', d['Do'] ? new Date(d['Do']) : '');
    set('Čas od', d['Čas od'] || ''); set('Čas do', d['Čas od'] ? d['Čas do'] || '' : '');
    set('Místo', bezVzorce_(String(d['Místo'] || '').trim())); set('Pro koho', d['Pro koho'] || 'veřejnost'); set('Kontakt', normEmail_(d['Kontakt']));
    set('Popis', bezVzorce_(String(d['Popis'] || '').trim())); set('Vybavení', bezVzorce_(String(d['Vybavení'] || '').trim()));
    set('Stav', 'podáno');
    if (i < 0) { set('ID', 'Z' + Utilities.formatDate(ted, 'Europe/Prague', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10)); set('Sbor', nazevSboru); set('Vytvořeno', ted); set('Vytvořil', o.email); }
    set('Upraveno', ted); set('Upravil', o.email);
    if (i >= 0) sh.getRange(i + 2, 1, 1, h.length).setValues([r]); else sh.appendRow(r);
    const id = r[col('ID')];
    zaznamZmeny_(o.email, LIST_ZADOSTI, id, i >= 0 ? 'upraveno' : 'vytvořeno', pred, i >= 0 ? 'upraveno, znovu podáno' : 'podáno');
    if (vyb) rezSladitSeZadosti_(id, nazevSboru, vyb, odV, doV, r[col('Název')], o.email);
    upozornitOkresNaZadost_(h, r, i >= 0, vyb ? nazvyMajetku_(vyb) : null);
    return { ok: true, data: zadostJson_(h.reduce((x, k, j) => (x[k] = r[j], x), {}), false) };
  } finally { lock.releaseLock(); }
}

function zadostZmenitStav_(o, nazevSboru, id, stav) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { return zadostZmenitStavBezZamku_(o, nazevSboru, id, stav); } finally { lock.releaseLock(); }
}
function zadostZmenitStavBezZamku_(o, nazevSboru, id, stav) {
  const sh = dataSs_().getSheetByName(LIST_ZADOSTI), h = hlavicka_(sh), col = k => h.indexOf(k);
  const ids = sh.getLastRow() > 1 ? sh.getRange(2, col('ID') + 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
  const i = ids.indexOf(id);
  if (i < 0) return { ok: false, chyba: 'Žádost nenalezena.' };
  const rng = sh.getRange(i + 2, 1, 1, h.length), r = rng.getValues()[0], pred = r[col('Stav')];
  if (r[col('Sbor')] !== nazevSboru) return { ok: false, chyba: 'Žádost patří jinému sboru.' };
  if (ZADOST_UPRAVITELNE.indexOf(pred) < 0) return { ok: false, chyba: 'Žádost ve stavu „' + pred + '“ už nejde zrušit.' };
  r[col('Stav')] = stav; r[col('Upraveno')] = new Date(); r[col('Upravil')] = o.email;
  rng.setValues([r]);
  zaznamZmeny_(o.email, LIST_ZADOSTI, id, 'upraveno', pred, stav);
  rezUkoncitZadost_(id, 'zrušeno', 'sbor žádost stáhl', o.email);
  return { ok: true };
}

/** Jedna příloha (base64) k žádosti ve stavu podáno / vráceno k doplnění. */
function zadostPriloha_(o, nazevSboru, req) {
  const id = String(req.id || ''), nazev = String(req.nazev || '').trim(), mime = String(req.mime || '');
  const sh = dataSs_().getSheetByName(LIST_ZADOSTI), h = hlavicka_(sh), col = k => h.indexOf(k);
  const ids = sh.getLastRow() > 1 ? sh.getRange(2, col('ID') + 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
  const i = ids.indexOf(id);
  if (i < 0) return { ok: false, chyba: 'Žádost nenalezena.' };
  const r = sh.getRange(i + 2, 1, 1, h.length).getValues()[0];
  if (r[col('Sbor')] !== nazevSboru) return { ok: false, chyba: 'Žádost patří jinému sboru.' };
  if (ZADOST_UPRAVITELNE.indexOf(r[col('Stav')]) < 0) return { ok: false, chyba: 'K vyřízené žádosti už nejde přidat přílohu.' };
  let bajty;
  try { bajty = Utilities.base64Decode(String(req.data || '')); } catch (e) { return { ok: false, chyba: 'Soubor se nepodařilo přečíst.' }; }
  const chyba = overitSoubor_(nazev, mime, bajty.length, null, bajty);
  if (chyba) return { ok: false, chyba: chyba };
  // složka Žádosti/<ID> na sdíleném disku
  const disk = DriveApp.getFolderById(nastaveniWeb_('DISK_ID'));
  const it = disk.getFoldersByName('Žádosti'), koren = it.hasNext() ? it.next() : disk.createFolder('Žádosti');
  const it2 = koren.getFoldersByName(id), slozka = it2.hasNext() ? it2.next() : koren.createFolder(id);
  let pocet = 0; const fs = slozka.getFiles(); while (fs.hasNext()) { fs.next(); pocet++; }
  if (pocet >= ZADOST_MAX_PRILOH) return { ok: false, chyba: 'Žádost už má ' + ZADOST_MAX_PRILOH + ' příloh. Další přidat nejde.' };
  slozka.createFile(Utilities.newBlob(bajty, mime, nazev));
  if (!r[col('Přílohy – složka')]) sh.getRange(i + 2, col('Přílohy – složka') + 1).setValue('https://drive.google.com/drive/folders/' + slozka.getId());
  zaznamZmeny_(o.email, LIST_ZADOSTI, id, 'upraveno', '', 'příloha: ' + nazev);
  const prilohy = []; const f = slozka.getFiles(); while (f.hasNext()) prilohy.push({ nazev: f.next().getName() });
  return { ok: true, prilohy: prilohy };
}

/* ---------- okres ---------- */

/** Okrsek sboru podle názvu („SDH X“ nebo „X“) z listu Sbory. */
function okrsekSboru_(nazev, sbory) {
  const n = String(nazev || '').replace(/^SDH\s+/i, '').trim().toLowerCase();
  const s = sbory.find(x => String(x['Sbor'] || '').replace(/^SDH\s+/i, '').trim().toLowerCase() === n);
  return s && s['Okrsek'] !== '' ? Number(s['Okrsek']) : null;
}

function zadostiOkres_() {
  const zadosti = radky_(LIST_ZADOSTI).filter(r => r['ID']), akce = radky_('Akce').filter(r => r['ID'] && r['Stav'] === 'zveřejněno'), sbory = radkyRychle_('Sbory');
  let rez = [], md = null;
  try { rez = rezervace_(); md = rez.length ? mjDataCache_(false) : null; } catch (e) { console.error('Vybavení u žádostí: ' + e.message); rez = []; }
  const interval = (od, doo) => [denZ_(od), denZ_(doo || od) || denZ_(od)];
  const prekryv = (a, b) => a[0] && b[0] && a[0] <= b[1] && b[0] <= a[1];
  const data = zadosti.map(z => {
    // přílohy (procházení složky na Disku) jen u nevyřízených; u ostatních je aplikace načte až v detailu (zadostPrilohy)
    const nevyrizena = ZADOST_UPRAVITELNE.indexOf(z['Stav']) >= 0;
    const o = zadostJson_(z, nevyrizena, true), iz = interval(z['Datum'], z['Do']), okr = okrsekSboru_(z['Sbor'], sbory);
    o.prilohyPozdeji = !nevyrizena && !!z['Přílohy – složka'];
    o.okrsek = okr;
    const moje = md ? rez.filter(r => r.zadost === z['ID']) : [];
    o.vybaveni = moje.length ? vybaveniZadosti_(moje, md, rez, iz[0], iz[1], z['ID'], ZADOST_UPRAVITELNE.indexOf(z['Stav']) >= 0) : [];
    o.soubeh = [];
    if (ZADOST_AKTIVNI.indexOf(z['Stav']) >= 0) {
      akce.filter(a => a['ID'] !== z['Akce – ID'] && prekryv(iz, interval(a['Od'], a['Do']))).forEach(a => {
        const ok = a['Okrsek'] !== '' && a['Okrsek'] != null ? Number(a['Okrsek']) : okrsekSboru_(a['Pořadatel'], sbory);
        o.soubeh.push({ druh: 'akce', nazev: a['Název'], kdo: String(a['Pořadatel'] || ''), od: denZ_(a['Od']), do: denZ_(a['Do'] || a['Od']), stejnyOkrsek: !!okr && ok === okr });
      });
      zadosti.filter(x => x['ID'] !== z['ID'] && ZADOST_AKTIVNI.indexOf(x['Stav']) >= 0 && !(x['Akce – ID'] && x['Akce – ID'] === z['Akce – ID']) && prekryv(iz, interval(x['Datum'], x['Do']))).forEach(x => {
        if (x['Stav'] === 'schváleno' && x['Akce – ID']) return; // schválená žádost už je mezi akcemi
        o.soubeh.push({ druh: 'žádost', nazev: x['Název'], kdo: String(x['Sbor'] || ''), od: denZ_(x['Datum']), do: denZ_(x['Do'] || x['Datum']), stejnyOkrsek: !!okr && okrsekSboru_(x['Sbor'], sbory) === okr });
      });
    }
    return o;
  }).reverse();
  return { ok: true, data: data };
}

function zadostRozhodnout_(o, req) {
  const id = String(req.id || ''), rozhodnuti = String(req.rozhodnuti || ''), poznamka = String(req.poznamka || '').trim();
  if (['schválit', 'vrátit', 'zamítnout'].indexOf(rozhodnuti) < 0) return { ok: false, chyba: 'Neznámé rozhodnutí.' };
  if (rozhodnuti !== 'schválit' && !poznamka) return { ok: false, chyba: 'Napište poznámku pro sbor – co doplnit nebo proč žádost zamítáte.' };
  const chyba = kontrolaTextu_({ 'Poznámka': poznamka }, { 'Poznámka': 2000 });
  if (chyba) return { ok: false, chyba: chyba };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const ss = dataSs_(), sh = ss.getSheetByName(LIST_ZADOSTI), h = hlavicka_(sh), col = k => h.indexOf(k), ted = new Date();
    const ids = sh.getLastRow() > 1 ? sh.getRange(2, col('ID') + 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
    const i = ids.indexOf(id);
    if (i < 0) return { ok: false, chyba: 'Žádost nenalezena.' };
    const rng = sh.getRange(i + 2, 1, 1, h.length), r = rng.getValues()[0], pred = r[col('Stav')];
    if (ZADOST_UPRAVITELNE.indexOf(pred) < 0) return { ok: false, chyba: 'Žádost je ve stavu „' + pred + '“, rozhodnutí už nejde změnit.' };
    // vybavení: req.vybaveni = ID majetku, které okres potvrzuje (chybí = všechny); nejdřív kontrola, že termín je pořád volný
    const odV = denZ_(r[col('Datum')]), doV = denZ_(r[col('Do')] || r[col('Datum')]) || odV;
    const potvrdit = Array.isArray(req.vybaveni) ? req.vybaveni : null;
    let vyb = { potvrzeno: [], zamitnuto: [] };
    if (rozhodnuti === 'schválit') {
      vyb = rezSchvalit_(id, potvrdit, odV, doV, o.email, false);
      if (vyb.chyba) return { ok: false, chyba: vyb.chyba };
    }
    let akceId = '';
    if (rozhodnuti === 'schválit') {
      // nová akce v listu Akce + kalendář (detail soutěže – propozice, přihlášky – doplní B8)
      const sa = ss.getSheetByName('Akce'), ha = hlavicka_(sa), ca = k => ha.indexOf(k), a = ha.map(() => '');
      const sbory = radkyRychle_('Sbory'), okr = okrsekSboru_(r[col('Sbor')], sbory);
      const seta = (k, v) => { if (ca(k) >= 0) a[ca(k)] = v; };
      // čas: prázdný = celodenní; jen začátek = jednodenní akce s časem (kalendář ji udělá na 2 h), vícedenní do konce posledního dne
      const casOd = col('Čas od') >= 0 ? casText_(r[col('Čas od')]) : '', casDo = col('Čas do') >= 0 ? casText_(r[col('Čas do')]) : '';
      const den1 = r[col('Datum')], den2 = r[col('Do')] || '';
      const od = sCasem_(den1, casOd);
      const doo = casDo ? sCasem_(den2 || den1, casDo) : den2 && denZ_(den2) !== denZ_(den1) ? sCasem_(den2, casOd ? '23:59' : '') : '';
      seta('Název', r[col('Název')]); seta('Typ', r[col('Typ')] === 'pořádání soutěže' ? 'soutěž' : 'akce sboru'); seta('Pořadatel', r[col('Sbor')]);
      seta('Od', od); seta('Do', doo); seta('Místo', r[col('Místo')]); seta('Pro koho', r[col('Pro koho')] || 'veřejnost');
      seta('Okrsek', r[col('Pro koho')] === 'okrsek' ? (okr || '') : ''); seta('Popis', r[col('Popis')]); seta('Stav', 'zveřejněno');
      seta('Vytvořeno', ted); seta('Vytvořil', o.email); seta('Upraveno', ted); seta('Upravil', o.email);
      doplnitId_('Akce', ha, a);
      try { syncRadek_(kalendar_(), 'Akce', ha, a); } catch (e) { console.error(e); }
      sa.appendRow(a.map(bezVzorce_));
      akceId = a[ca('ID')];
      // sborová soutěž (B8): soutěž vznikne hned, spravuje ji pořádající sbor v portálu (Soutěže → Spravovat)
      if (r[col('Typ')] === 'pořádání soutěže') { try { soZeZadosti_(akceId, id, r[col('Sbor')], o); } catch (e) { console.error('Soutěž ze žádosti: ' + e.message); } }
      r[col('Akce – ID')] = akceId;
      zaznamZmeny_(o.email, 'Akce', akceId, 'vytvořeno', '', 'ze žádosti ' + id);
      vycistitCache_();
      vyb = rezSchvalit_(id, potvrdit, odV, doV, o.email, true);
    }
    if (rozhodnuti === 'zamítnout') rezUkoncitZadost_(id, 'zamítnuto', 'žádost zamítnuta', o.email);
    r[col('Stav')] = rozhodnuti === 'schválit' ? 'schváleno' : rozhodnuti === 'vrátit' ? 'vráceno k doplnění' : 'zamítnuto';
    r[col('Poznámka')] = bezVzorce_(poznamka); r[col('Vyřídil')] = o.email; r[col('Vyřízeno')] = ted; r[col('Upraveno')] = ted; r[col('Upravil')] = o.email;
    rng.setValues([r]);
    zaznamZmeny_(o.email, LIST_ZADOSTI, id, rozhodnuti === 'schválit' ? 'schváleno' : rozhodnuti === 'zamítnout' ? 'zamítnuto' : 'upraveno', pred, r[col('Stav')] + (poznamka ? ': ' + poznamka.slice(0, 300) : ''));
    oznamitRozhodnuti_(h, r, vyb);
    if (vyb.potvrzeno.length) upozornitMajetek_(h.reduce((x, k, j) => (x[k] = r[j], x), {}), vyb.potvrzeno, odV, doV);
    return { ok: true, akceId: akceId, vybaveni: vyb, data: zadostJson_(h.reduce((x, k, j) => (x[k] = r[j], x), {}), true, true) };
  } finally { lock.releaseLock(); }
}

/**
 * Akce ze schválené žádosti byla zrušena (sborová soutěž zrušena pořadatelem nebo okresem, akce zrušena v kalendáři):
 * žádost → staženo (v aplikaci „Zrušeno“) s důvodem, rezervace vybavení k ní (žádost / potvrzeno) → zrušeno. Vrací ID žádosti nebo ''.
 */
function zadostPoZruseniAkce_(akceId, kdo, duvod) {
  if (!akceId) return '';
  const sh = dataSs_().getSheetByName(LIST_ZADOSTI), h = hlavicka_(sh), col = k => h.indexOf(k);
  if (sh.getLastRow() < 2 || col('Akce – ID') < 0) return '';
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues(), i = v.findIndex(r => String(r[col('Akce – ID')]) === String(akceId) && r[col('Stav')] === 'schváleno');
  if (i < 0) return '';
  const r = v[i], id = String(r[col('ID')]), ted = new Date();
  r[col('Stav')] = 'staženo'; r[col('Poznámka')] = bezVzorce_(String(duvod || 'Akce byla zrušena.')); r[col('Upraveno')] = ted; r[col('Upravil')] = kdo;
  sh.getRange(i + 2, 1, 1, h.length).setValues([r]);
  zaznamZmeny_(kdo, LIST_ZADOSTI, id, 'upraveno', 'schváleno', 'staženo – ' + String(duvod || '').slice(0, 200));
  try { // potvrzené vybavení uvolnit (MajetekSbory.gs)
    const zmeny = {};
    rezervace_().filter(x => x.zadost === id && ['žádost', 'potvrzeno'].indexOf(x.stav) >= 0).forEach(x => { zmeny[x.id] = { 'Stav': 'zrušeno', 'Poznámka': 'akce zrušena' }; });
    if (Object.keys(zmeny).length) rezUpravit_(zmeny, kdo);
  } catch (e) { console.error('Rezervace po zrušení akce: ' + e.message); }
  return id;
}

/* ---------- e-maily ---------- */

/** Názvy věcí z evidence (pro e-maily). */
function nazvyMajetku_(ids) {
  if (!ids || !ids.length) return [];
  try { const md = mjDataCache_(false); return ids.map(id => ((md.majetek.find(x => x._id === id) || {})['Název']) || id); } catch (e) { return ids; }
}

function upozornitOkresNaZadost_(h, r, uprava, veci) {
  const col = k => h.indexOf(k), dom = '@' + (nastaveniWeb_('DOMENA') || 'oshpz.cz');
  let komu = radkyRychle_('Uživatelé').filter(u => ano_(u['Aktivní']) && ano_(u['Akce'])).map(u => normEmail_(u['E-mail']));
  if (!komu.length) komu = ['spravci' + dom];
  const kdy = Utilities.formatDate(new Date(r[col('Datum')]), 'Europe/Prague', 'd. M. yyyy') + (r[col('Do')] && denZ_(r[col('Do')]) !== denZ_(r[col('Datum')]) ? ' – ' + Utilities.formatDate(new Date(r[col('Do')]), 'Europe/Prague', 'd. M. yyyy') : '') +
    (casText_(r[col('Čas od')]) ? ', ' + casText_(r[col('Čas od')]) + (casText_(r[col('Čas do')]) ? '–' + casText_(r[col('Čas do')]) : '') : ', celý den');
  const predmet = (uprava ? 'Upravená žádost: ' : 'Nová žádost: ') + r[col('Název')] + ' (' + r[col('Sbor')] + ')';
  const pol = [['Sbor', r[col('Sbor')]], ['Typ', r[col('Typ')]], ['Kdy', kdy], ['Kde', r[col('Místo')]], ['Pro koho', r[col('Pro koho')]], ['Vybavení okresu', (veci || []).join('\n')], ['Jiné vybavení', r[col('Vybavení')]], ['Kontakt', r[col('Kontakt')]], ['', r[col('Popis')]]];
  const url = (nastaveniWeb_('WEB_URL') || '') + '/Aplikace%20OSH.dc.html';
  const html = sablona_(predmet, uprava ? 'Sbor žádost upravil a znovu podal. Posuďte ji ve správě okresu.' : 'Sbor podal žádost o pořádání. Posuďte ji ve správě okresu.', pol, ['Otevřít žádosti', url]);
  const text = pol.filter(p => p[1]).map(p => (p[0] ? p[0] + ': ' : '') + p[1]).join('\n') + '\n\n' + url;
  komu.forEach(e => { try { posta_(e, predmet, text, html); } catch (x) { console.error(x); } });
}

function oznamitRozhodnuti_(h, r, vyb) {
  const col = k => h.indexOf(k), dom = '@' + (nastaveniWeb_('DOMENA') || 'oshpz.cz'), stav = r[col('Stav')];
  const s = radkyRychle_('Sbory').find(x => String(x['Sbor'] || '') === r[col('Sbor')]);
  const skupina = s && s['Skupina'] ? String(s['Skupina']).split('@')[0] + dom : '';
  const komu = [normEmail_(r[col('Kontakt')]), skupina].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);
  const nadpis = { 'schváleno': 'Žádost schválena', 'vráceno k doplnění': 'Žádost vrácena k doplnění', 'zamítnuto': 'Žádost zamítnuta' }[stav] + ': ' + r[col('Název')];
  const uvod = stav === 'schváleno' ? 'Okres schválil vaši žádost. Akce je v kalendáři okresu' + (r[col('Typ')] === 'pořádání soutěže' ? '; propozice a přihlášky soutěže doplní okres.' : '.')
    : stav === 'vráceno k doplnění' ? 'Okres žádost vrátil k doplnění. Upravte ji v portálu sboru a podejte znovu.' : 'Okres žádost zamítl.';
  const pol = [['Sbor', r[col('Sbor')]], ['Kdy', Utilities.formatDate(new Date(r[col('Datum')]), 'Europe/Prague', 'd. M. yyyy')],
    ['Vybavení potvrzeno', ((vyb && vyb.potvrzeno) || []).join('\n')], ['Vybavení nepotvrzeno', ((vyb && vyb.zamitnuto) || []).join('\n')], ['Poznámka okresu', r[col('Poznámka')]]];
  const url = (nastaveniWeb_('WEB_URL') || '') + '/Aplikace%20OSH.dc.html';
  const html = sablona_(nadpis, uvod, pol, ['Otevřít portál sboru', url]);
  const text = uvod + '\n\n' + pol.filter(p => p[1]).map(p => p[0] + ': ' + p[1]).join('\n') + '\n\n' + url;
  komu.forEach(e => { try { posta_(e, nadpis, text, html); } catch (x) { console.error(x); } });
}

/* ---------- test (režim TEST) ---------- */

/** Dvě testovací žádosti za SDH Kamenný Újezdec; ZT1 ve stejný den jako TEST-A1 (souběh). Podruhé nic nepřidá. */
function vlozitTestyZadosti() {
  const ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(LIST_ZADOSTI), h = hlavicka_(sh), ted = new Date(), ja = Session.getActiveUser().getEmail();
  const ids = sh.getLastRow() > 1 ? sh.getRange(2, h.indexOf('ID') + 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
  const a1 = radky_('Akce').find(r => r['ID'] === 'TEST-A1');
  const den = n => new Date(ted.getFullYear(), ted.getMonth(), ted.getDate() + n);
  const datumA1 = a1 && a1['Od'] instanceof Date ? new Date(a1['Od'].getFullYear(), a1['Od'].getMonth(), a1['Od'].getDate()) : den(14);
  const testy = [
    ['Z-TEST1', 'pořádání soutěže', 'TEST: Pohár Kamenného Újezdce v požárním útoku', datumA1, '', 'hřiště Kamenný Újezdec', 'všechny sbory', 'Soutěž pro mladší a starší žáky. (souběh s TEST-A1)', 'časomíra, 2× proudnice'],
    ['Z-TEST2', 'pořádání akce', 'TEST: Den otevřených dveří SDH Kamenný Újezdec', den(25), den(25), 'hasičská zbrojnice', 'veřejnost', 'Ukázky techniky pro veřejnost.', '']
  ].filter(t => ids.indexOf(t[0]) < 0);
  testy.forEach(([id, typ, nazev, od, doo, misto, pro, popis, vyb]) => {
    const v = { 'ID': id, 'Sbor': 'SDH Kamenný Újezdec', 'Typ': typ, 'Název': nazev, 'Datum': od, 'Do': doo, 'Místo': misto, 'Pro koho': pro, 'Kontakt': ja,
      'Popis': popis, 'Vybavení': vyb, 'Stav': 'podáno', 'Vytvořeno': ted, 'Vytvořil': ja };
    sh.appendRow(h.map(k => k in v ? v[k] : ''));
  });
  ss.toast(testy.length ? 'Přidány ' + testy.length + ' testovací žádosti (Z-TEST1, Z-TEST2).' : 'Testovací žádosti už v tabulce jsou.', 'Žádosti', 8);
}
