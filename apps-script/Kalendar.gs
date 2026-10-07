/**
 * OSH data – B5 Kalendář + B2 zápis akcí a termínů.
 * Nový soubor „Kalendar“ ve stejném projektu.
 *
 * Akce a termíny se stavem „zveřejněno“ se zapíšou do Google Kalendáře (Nastavení → KALENDAR_ID).
 * Změna řádku událost upraví, stav „zrušeno“ / „koncept“ nebo smazaný řádek ji odstraní.
 * Spouští se hned po úpravě v tabulce a pro jistotu každou hodinu celé.
 */

const KAL_LISTY = { 'Akce': 'A', 'Termíny': 'T' };

function kalendar_() {
  const id = nastaveniWeb_('KALENDAR_ID');
  const k = id && CalendarApp.getCalendarById(id);
  if (!k) throw new Error('Kalendář ' + id + ' nenalezen. Zkontrolujte KALENDAR_ID a sdílení kalendáře s tímto účtem (právo provádět změny).');
  return k;
}

function hlavicka_(sh) { return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String); }

/** Zapíše / upraví / smaže událost pro jeden řádek. Vrací true, když se řádek změnil. */
function syncRadek_(kal, list, h, r) {
  const col = k => h.indexOf(k), stav = r[col('Stav')], evId = r[col('Kalendář – událost')];
  let ev = null;
  if (evId) { try { ev = kal.getEventById(evId); } catch (e) {} }
  if (stav !== 'zveřejněno' || !r[col('Název')]) {
    if (ev) { try { ev.deleteEvent(); } catch (e) {} }
    if (evId) { r[col('Kalendář – událost')] = ''; return true; }
    return false;
  }
  const den = d => d instanceof Date && d.getHours() === 0 && d.getMinutes() === 0;
  let od, doo, celodenni;
  if (list === 'Termíny') { od = r[col('Datum')]; doo = od; celodenni = true; }
  else { od = r[col('Od')]; doo = r[col('Do')] || od; celodenni = den(od) && (!r[col('Do')] || den(doo)); }
  if (!(od instanceof Date)) return false;
  if (!celodenni && (!(doo instanceof Date) || doo <= od)) doo = new Date(od.getTime() + 2 * 3600e3);
  const pro = r[col('Pro koho')], okr = r[col('Okrsek')];
  const popis = [r[col('Popis')], pro ? 'Pro: ' + pro + (pro === 'okrsek' && okr ? ' ' + okr : '') : '',
    list === 'Akce' && r[col('Pořadatel')] ? 'Pořádá: ' + r[col('Pořadatel')] : '', r[col('Odkaz')] || ''].filter(Boolean).join('\n');
  const nazev = (list === 'Termíny' && r[col('Typ')] === 'uzávěrka' ? 'Uzávěrka: ' : '') + r[col('Název')];
  const misto = list === 'Akce' ? String(r[col('Místo')] || '') : '';
  const konecDne = d => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  if (ev && ev.isAllDayEvent() !== celodenni) { try { ev.deleteEvent(); } catch (e) {} ev = null; }
  if (!ev) {
    ev = celodenni
      ? kal.createAllDayEvent(nazev, od, konecDne(doo), { description: popis, location: misto })
      : kal.createEvent(nazev, od, doo, { description: popis, location: misto });
    ev.setTag('osh', r[col('ID')]);
    r[col('Kalendář – událost')] = ev.getId();
    return true;
  }
  ev.setTitle(nazev); ev.setDescription(popis); ev.setLocation(misto);
  if (celodenni) ev.setAllDayDates(od, konecDne(doo)); else ev.setTime(od, doo);
  return false;
}

function doplnitId_(list, h, r) {
  const c = h.indexOf('ID');
  if (r[c]) return false;
  r[c] = KAL_LISTY[list] + Utilities.formatDate(new Date(), 'Europe/Prague', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
  return true;
}

/** Celá synchronizace obou listů. Každou hodinu + z menu. */
function synchronizovatKalendar() {
  const lock = LockService.getScriptLock(); if (!lock.tryLock(30000)) return;
  try {
    const kal = kalendar_(), ss = dataSs_(), platne = {};
    let zmen = 0;
    Object.keys(KAL_LISTY).forEach(list => {
      const sh = ss.getSheetByName(list); if (sh.getLastRow() < 2) return;
      const h = hlavicka_(sh), rng = sh.getRange(2, 1, sh.getLastRow() - 1, h.length), v = rng.getValues();
      let zmena = false;
      v.forEach(r => {
        if (!r.some(x => x !== '')) return;
        if (doplnitId_(list, h, r)) zmena = true;
        if (syncRadek_(kal, list, h, r)) zmena = true;
        const ev = r[h.indexOf('Kalendář – událost')]; if (ev) platne[ev] = true;
      });
      if (zmena) { rng.setValues(v); zmen++; }
    });
    // události z aplikace, jejichž řádek byl smazán
    const od = new Date(Date.now() - 400 * 864e5), doo = new Date(Date.now() + 800 * 864e5);
    let smazano = 0;
    kal.getEvents(od, doo).forEach(ev => { if (ev.getTag('osh') && !platne[ev.getId()]) { ev.deleteEvent(); smazano++; } });
    vycistitCache_();
    console.log('Kalendář synchronizován. Smazaných osiřelých událostí: ' + smazano);
    return { smazano };
  } finally { lock.releaseLock(); }
}

/** Instalovaný spouštěč při úpravě tabulky: doplní ID, kdo/kdy upravil a hned zapíše řádek do kalendáře. */
function priUprave(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet(), list = sh.getName();
  const sledovane = ['Akce', 'Termíny', 'Dokumenty', 'Žádosti', 'Majetek', 'Rezervace', 'Příspěvky', 'Sbory', 'Uživatelé'];
  if (sledovane.indexOf(list) < 0 || e.range.getRow() < 2) return;
  const h = hlavicka_(sh), kdo = (e.user && e.user.getEmail && e.user.getEmail()) || Session.getActiveUser().getEmail() || 'tabulka';
  const r1 = e.range.getRow(), n = e.range.getNumRows();
  const rng = sh.getRange(r1, 1, n, h.length), v = rng.getValues(), ted = new Date();
  // Záznam změn (G5): u jedné buňky sloupec a hodnota před → po, u většího výběru jen rozsah.
  const jednaBunka = n === 1 && e.range.getNumColumns() === 1, sloupec = h[e.range.getColumn() - 1] || ('sloupec ' + e.range.getColumn());
  const zaznamy = [], kratce = t => String(t == null ? '' : t).slice(0, 500);
  let kal = null;
  v.forEach((r, j) => {
    if (!r.some(x => x !== '')) return;
    const id = h.indexOf('ID') >= 0 && r[h.indexOf('ID')] ? r[h.indexOf('ID')] : 'řádek ' + (r1 + j);
    const novy = h.indexOf('Vytvořeno') >= 0 && !r[h.indexOf('Vytvořeno')];
    zaznamy.push([kdo, list, id, novy ? 'vytvořeno' : 'upraveno', jednaBunka ? kratce(sloupec + ': ' + (e.oldValue == null ? '' : e.oldValue)) : '',
      jednaBunka ? kratce(sloupec + ': ' + (e.value == null ? '(smazáno)' : e.value)) : 'ruční úprava ' + n + ' ř. × ' + e.range.getNumColumns() + ' sl.']);
    if (novy) { r[h.indexOf('Vytvořeno')] = ted; r[h.indexOf('Vytvořil')] = kdo; }
    if (h.indexOf('Upraveno') >= 0) { r[h.indexOf('Upraveno')] = ted; r[h.indexOf('Upravil')] = kdo; }
    if (KAL_LISTY[list]) {
      doplnitId_(list, h, r);
      try { kal = kal || kalendar_(); syncRadek_(kal, list, h, r); } catch (err) { console.error(err); }
    }
  });
  rng.setValues(v);
  vycistitCache_();
  try { zaznamZmenyHromadne_(zaznamy.length > 200 ? [[kdo, list, '', 'upraveno', '', 'ruční úprava ' + zaznamy.length + ' řádků (od řádku ' + r1 + ')']] : zaznamy); } catch (err) { console.error(err); }
}

/* ---------- zápis z aplikace (B2) ---------- */

const POLE_ZAPIS = {
  'Akce':    ['Název', 'Typ', 'Pořadatel', 'Od', 'Do', 'Místo', 'Pro koho', 'Okrsek', 'Popis', 'Odkaz', 'Připomenout (dny předem)', 'Stav'],
  'Termíny': ['Název', 'Datum', 'Typ', 'Pořadatel', 'Pro koho', 'Okrsek', 'Popis', 'Připomenout (dny předem)', 'Stav']
};
const radekJson_ = (h, r) => h.reduce((x, k, j) => (k && (x[k] = r[j] instanceof Date ? r[j].toISOString() : r[j]), x), {});
const DATUMOVA = ['Od', 'Do', 'Datum'];

function apiKalendar_(req) {
  const o = prihlaseny_(req.token);
  if (!o) return { ok: false, chyba: 'Nepřihlášen', odhlasen: true };
  const list = req.akce === 'ulozitTermin' || req.akce === 'zrusitTermin' ? 'Termíny' : 'Akce';
  if (!(o.role['Správce'] || o.role['Termíny'])) return { ok: false, chyba: 'Nemáte oprávnění spravovat kalendář okresu.' };
  // Celý kalendář pro správu včetně konceptů (zrušené ne). Každý řádek má navíc „list“: Akce / Termíny.
  if (req.akce === 'kalendar') {
    const data = [];
    Object.keys(KAL_LISTY).forEach(l => radky_(l).filter(r => r['ID'] && r['Stav'] !== 'zrušeno')
      .forEach(r => data.push(Object.assign(Object.keys(r).reduce((x, k) => (x[k] = r[k] instanceof Date ? r[k].toISOString() : r[k], x), {}), { list: l }))));
    return { ok: true, data: data };
  }
  if (req.akce === 'zrusitAkci' || req.akce === 'zrusitTermin') return zrusitZaznam_(o, list, String(req.id || ''));
  const d = req.data || {};
  if (!String(d['Název'] || '').trim()) return { ok: false, chyba: 'Chybí název.' };
  if (list === 'Akce' && !d['Od']) return { ok: false, chyba: 'Chybí začátek akce.' };
  if (list === 'Termíny' && !d['Datum']) return { ok: false, chyba: 'Chybí datum.' };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = dataSs_().getSheetByName(list), h = hlavicka_(sh), col = k => h.indexOf(k), ted = new Date();
    const ids = sh.getLastRow() > 1 ? sh.getRange(2, col('ID') + 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
    const i = req.id ? ids.indexOf(String(req.id)) : -1;
    if (req.id && i < 0) return { ok: false, chyba: 'Záznam ' + req.id + ' nenalezen.' };
    const r = i >= 0 ? sh.getRange(i + 2, 1, 1, h.length).getValues()[0] : h.map(() => '');
    const pred = i >= 0 ? r[col('Stav')] : '';
    POLE_ZAPIS[list].forEach(k => {
      if (!(k in d) || col(k) < 0) return;
      let v = d[k];
      if (DATUMOVA.indexOf(k) >= 0) v = v ? new Date(v) : '';
      else if (k === 'Okrsek') v = v === '' || v == null ? '' : Number(v);
      else v = bezVzorce_(String(v).slice(0, 5000));
      r[col(k)] = v;
    });
    if (!r[col('Stav')]) r[col('Stav')] = 'zveřejněno';
    doplnitId_(list, h, r);
    if (i < 0) { r[col('Vytvořeno')] = ted; r[col('Vytvořil')] = o.email; }
    r[col('Upraveno')] = ted; r[col('Upravil')] = o.email;
    syncRadek_(kalendar_(), list, h, r);
    if (i >= 0) sh.getRange(i + 2, 1, 1, h.length).setValues([r]); else sh.appendRow(r);
    zaznamZmeny_(o.email, list, r[col('ID')], i >= 0 ? 'upraveno' : 'vytvořeno', pred, r[col('Stav')]);
    vycistitCache_();
    return { ok: true, data: Object.assign(radekJson_(h, r), { list: list }) };
  } finally { lock.releaseLock(); }
}

/** „Smazat“ z aplikace = Stav zrušeno: řádek zůstane v tabulce (dohledatelnost), událost zmizí z kalendáře i z webu. */
function zrusitZaznam_(o, list, id) {
  if (!id) return { ok: false, chyba: 'Chybí ID záznamu.' };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = dataSs_().getSheetByName(list), h = hlavicka_(sh), col = k => h.indexOf(k);
    const ids = sh.getLastRow() > 1 ? sh.getRange(2, col('ID') + 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
    const i = ids.indexOf(id);
    if (i < 0) return { ok: false, chyba: 'Záznam ' + id + ' nenalezen.' };
    const rng = sh.getRange(i + 2, 1, 1, h.length), r = rng.getValues()[0], pred = r[col('Stav')];
    r[col('Stav')] = 'zrušeno'; r[col('Upraveno')] = new Date(); r[col('Upravil')] = o.email;
    syncRadek_(kalendar_(), list, h, r);
    rng.setValues([r]);
    zaznamZmeny_(o.email, list, id, 'smazáno', pred, 'zrušeno');
    vycistitCache_();
    return { ok: true };
  } finally { lock.releaseLock(); }
}

function synchronizovatKalendarTed() {
  const r = synchronizovatKalendar() || {};
  SpreadsheetApp.getActive().toast('Kalendář synchronizován' + (r.smazano ? ', odstraněno ' + r.smazano + ' událostí' : '') + '.', 'Kalendář', 6);
}
