/**
 * OSH data – vybavení okresu pro žádosti sborů (MajetekSbory.gs).
 *
 * Nabídka: list „Nabídka majetku“ v OSH data (Majetek – ID, Název, Nabízet sborům, Poznámka pro sbory).
 *   Nastavuje role Majetek v detailu majetku. Sbor vidí jen věci s Nabízet sborům = ANO – nikdy celou evidenci.
 *   Tabulky Evidence majetku (stará aplikace) se kvůli tomu nemění.
 * Rezervace: list „Rezervace“ – jeden řádek = jedna věc pro jednu žádost sboru:
 *   žádost (sbor požádal) → potvrzeno (okres schválil žádost) → vydáno (role Majetek zapsala výpůjčku) → vráceno;
 *   jinak zamítnuto (okres věc nepotvrdil) / zrušeno (sbor věc odebral, žádost stáhl, nebo rezervaci zrušil okres).
 * Termín drží jen potvrzená rezervace a aktivní výpůjčka; o čekající žádosti jiného sboru se jen upozorní (rozhodne okres).
 * Sbor u obsazených termínů nevidí, kdo věc má. Zámek drží vždy volající (zadostUlozit_, zadostRozhodnout_, mjVypujcka_…).
 */

const LIST_NABIDKA = 'Nabídka majetku', LIST_REZERVACE = 'Rezervace';
const REZ_DRZI = ['potvrzeno', 'vydáno'];
const REZ_AKTIVNI = ['žádost', 'potvrzeno', 'vydáno'];
const REZ_MAX_VECI = 30;

/** Nabízené věci: { ID majetku: poznámka pro sbory }. */
function mjNabidka_() {
  const m = {};
  radky_(LIST_NABIDKA).forEach(r => { const id = String(r['Majetek – ID'] || '').trim(); if (id && ano_(r['Nabízet sborům'])) m[id] = String(r['Poznámka pro sbory'] || ''); });
  return m;
}

/** Řádky Rezervací jako objekty (data yyyy-MM-dd). */
function rezervace_() {
  return radky_(LIST_REZERVACE).filter(r => r['ID']).map(r => ({ id: String(r['ID']), mid: String(r['Majetek – ID'] || ''), zadost: String(r['Žádost – ID'] || ''),
    sbor: String(r['Sbor'] || ''), od: denZ_(r['Od']), do: denZ_(r['Do'] || r['Od']), ucel: String(r['Účel'] || ''), stav: String(r['Stav'] || ''),
    vypujcka: String(r['Výpůjčka – ID'] || ''), potvrdil: String(r['Potvrdil'] || ''), poznamka: String(r['Poznámka'] || '') }));
}

/**
 * Co brání půjčit věc mid v termínu od–doo (yyyy-MM-dd), bez rezervací žádosti kromeZadosti.
 * tvrde = termín je obsazený (výpůjčka s plánovaným vrácením, potvrzená rezervace); mekke = jen upozornění.
 */
function mjObsazenost_(md, rez, mid, od, doo, kromeZadosti) {
  const tvrde = [], mekke = [], dnes = md.dnes, prekryv = (a, b) => a <= doo && od <= b;
  const m = md.majetek.find(x => x._id === mid);
  if (!m || m['Aktivní_záznam'] === 'NE') return { tvrde: [{ druh: 'vyřazeno', text: 'už není v evidenci' }], mekke };
  md.vypujcky.filter(v => v['ID_Majetku'] === mid && MJ_AKTIVNI_VYP.indexOf(v['Stav_výpůjčky']) >= 0).forEach(v => {
    if (kromeZadosti && rez.some(r => r.vypujcka === v._id && r.zadost === kromeZadosti)) return;
    const p = v['Datum_půjčení'], k = v['Plánované_vrácení'], kdo = v['SDH_příjemce'] || v['Jméno_příjmení'] || '';
    if (!k) mekke.push({ druh: 'výpůjčka', kdo, od: p, text: 'půjčené od ' + p + ' bez data vrácení' });
    else if (k < dnes) mekke.push({ druh: 'výpůjčka', kdo, od: p, do: k, text: 'půjčené a po termínu vrácení (' + k + ')' });
    else if (prekryv(p, k)) tvrde.push({ druh: 'výpůjčka', kdo, od: p, do: k });
  });
  rez.filter(r => r.mid === mid && !(kromeZadosti && r.zadost === kromeZadosti) && prekryv(r.od, r.do)).forEach(r => {
    if (r.stav === 'potvrzeno') tvrde.push({ druh: 'rezervace', kdo: r.sbor, od: r.od, do: r.do, zadost: r.zadost });
    else if (r.stav === 'žádost') mekke.push({ druh: 'žádost', kdo: r.sbor, od: r.od, do: r.do, zadost: r.zadost, text: 'o stejný termín žádá i jiný sbor' });
  });
  if (m['Aktuální_stav'] !== 'K_DISPOZICI' && m['Aktuální_stav'] !== 'PUJCENO') mekke.push({ druh: 'stav', text: 'teď mimo provoz (' + (m['Aktuální_stav'] || 'bez stavu') + ')' });
  return { tvrde, mekke };
}

function textObsazeni_(x) {
  return x.text || ((x.druh === 'výpůjčka' ? 'půjčené' : 'rezervované') + (x.kdo ? ' – ' + x.kdo : '') + ' ' + x.od + (x.do && x.do !== x.od ? ' až ' + x.do : ''));
}

/** Nabídka pro portál sboru: jen nabízené aktivní věci, u každé obsazené termíny bez jmen jiných sborů. */
function nabidkaProSbor_(nazevSboru) {
  const nab = mjNabidka_();
  if (!Object.keys(nab).length) return [];
  const md = mjDataCache_(false), rez = rezervace_(), dnes = md.dnes;
  const kat = id => ((md.kategorie.find(k => k._id === id) || {})['Název_Kategorie']) || '';
  return md.majetek.filter(m => m._id in nab && m['Aktivní_záznam'] !== 'NE').map(m => {
    const obsazeno = [];
    md.vypujcky.filter(v => v['ID_Majetku'] === m._id && MJ_AKTIVNI_VYP.indexOf(v['Stav_výpůjčky']) >= 0 && v['Plánované_vrácení'] >= dnes)
      .forEach(v => { const r = rez.find(x => x.vypujcka === v._id); obsazeno.push({ od: v['Datum_půjčení'], do: v['Plánované_vrácení'], pevne: true, zadost: r && r.sbor === nazevSboru ? r.zadost : '' }); });
    rez.filter(r => r.mid === m._id && (r.stav === 'potvrzeno' || r.stav === 'žádost') && r.do >= dnes)
      .forEach(r => obsazeno.push({ od: r.od, do: r.do, pevne: r.stav === 'potvrzeno', zadost: r.sbor === nazevSboru ? r.zadost : '' }));
    const nevraceno = md.vypujcky.some(v => v['ID_Majetku'] === m._id && MJ_AKTIVNI_VYP.indexOf(v['Stav_výpůjčky']) >= 0 && (!v['Plánované_vrácení'] || v['Plánované_vrácení'] < dnes));
    const st = m['Aktuální_stav'], stNazev = ((md.stavMajetku.find(x => x._id === st) || {})['Název_Stavu']) || st;
    return { id: m._id, nazev: m['Název'] || '(bez názvu)', kategorie: kat(m['Kategorie']), popis: m['Popis'] || '', kusu: Number(m['Kusů']) || 1, poznamka: nab[m._id],
      mimoProvoz: st !== 'K_DISPOZICI' && st !== 'PUJCENO' ? stNazev || 'bez stavu' : '', nevraceno, obsazeno };
  }).sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs'));
}

/** Věci jedné žádosti (portál sboru i okres). md = data evidence (kvůli názvům); sKonflikty = jen okres – vidí, kdo věc v termínu má. */
function vybaveniZadosti_(rezZadosti, md, rez, od, doo, zadostId, sKonflikty) {
  return rezZadosti.map(r => {
    const m = md.majetek.find(x => x._id === r.mid) || {};
    const o = { rez: r.id, mid: r.mid, nazev: m['Název'] || r.mid, stav: r.stav };
    if (sKonflikty) {
      const ob = mjObsazenost_(md, rez, r.mid, od, doo, zadostId);
      o.tvrde = ob.tvrde.map(textObsazeni_); o.mekke = ob.mekke.map(textObsazeni_);
    }
    return o;
  });
}

/* ---------- zápisy (volající drží zámek) ---------- */

function rezList_() {
  const sh = dataSs_().getSheetByName(LIST_REZERVACE);
  if (!sh) throw new Error('V tabulce chybí list Rezervace – spusťte Založit / doplnit strukturu.');
  return { sh, h: hlavicka_(sh) };
}
function rezNoveId_(i) { return 'R' + Utilities.formatDate(new Date(), 'Europe/Prague', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10) + String(i || 0).padStart(2, '0'); }

/** Úprava řádků rezervací: zmeny = { ID: { Sloupec: hodnota } }. */
function rezUpravit_(zmeny, kdo) {
  const ids = Object.keys(zmeny);
  if (!ids.length) return;
  const { sh, h } = rezList_(), ted = new Date(), c = k => h.indexOf(k);
  if (sh.getLastRow() < 2) return;
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues();
  v.forEach((r, i) => {
    const z = zmeny[String(r[c('ID')])];
    if (!z) return;
    Object.keys(z).forEach(k => { if (c(k) >= 0) r[c(k)] = bezVzorce_(z[k]); });
    if (c('Upraveno') >= 0) { r[c('Upraveno')] = ted; r[c('Upravil')] = kdo; }
    sh.getRange(i + 2, 1, 1, h.length).setValues([r]);
    if (z['Stav']) zaznamZmeny_(kdo, LIST_REZERVACE, r[c('ID')], 'upraveno', '', 'Stav: ' + z['Stav'] + (r[c('Majetek – ID')] ? ' (' + r[c('Majetek – ID')] + ')' : ''));
  });
}

function rezPridat_(radky, kdo) {
  if (!radky.length) return;
  const { sh, h } = rezList_(), ted = new Date();
  radky.forEach((x, i) => {
    const o = Object.assign({ 'ID': rezNoveId_(i), 'Stav': 'žádost', 'Vytvořeno': ted, 'Vytvořil': kdo, 'Upraveno': ted, 'Upravil': kdo }, x);
    sh.appendRow(h.map(k => k in o ? bezVzorce_(o[k]) : ''));
    zaznamZmeny_(kdo, LIST_REZERVACE, o['ID'], 'vytvořeno', '', o['Majetek – ID'] + ' pro ' + o['Sbor'] + (o['Žádost – ID'] ? ' (žádost ' + o['Žádost – ID'] + ')' : ''));
  });
}

/**
 * Kontrola věcí, o které sbor žádá (před uložením žádosti). Vrací chybu, nebo null.
 * ids = ID majetku; od, doo = yyyy-MM-dd; zadostId = upravovaná žádost (její rezervace se nepočítají).
 */
function kontrolaVybaveni_(ids, od, doo, zadostId) {
  if (!Array.isArray(ids)) return 'Neplatný seznam vybavení.';
  if (ids.length > REZ_MAX_VECI) return 'Najednou jde požádat nejvýš o ' + REZ_MAX_VECI + ' věcí.';
  if (!ids.length) return null;
  const nab = mjNabidka_(), md = mjDataCache_(true), rez = rezervace_(), puvodni = rez.filter(r => r.zadost === zadostId && REZ_AKTIVNI.indexOf(r.stav) >= 0).map(r => r.mid);
  for (let i = 0; i < ids.length; i++) {
    const id = String(ids[i]), m = md.majetek.find(x => x._id === id);
    if (!(id in nab) && puvodni.indexOf(id) < 0) return 'Vybraná věc se sborům nenabízí. Načtěte formulář znovu.';
    if (!m || m['Aktivní_záznam'] === 'NE') return 'Věc ' + id + ' už v evidenci není. Odeberte ji ze žádosti.';
    const ob = mjObsazenost_(md, rez, id, od, doo, zadostId);
    if (ob.tvrde.length) return '„' + m['Název'] + '“ je v tomto termínu už obsazené' + (ob.tvrde[0].do ? ' (' + ob.tvrde[0].od + ' až ' + ob.tvrde[0].do + ')' : '') + '. Odeberte ho, nebo zvolte jiný termín.';
  }
  return null;
}

/** Po uložení žádosti: rezervace podle vybraných věcí (nové přidá, odebrané zruší, u ostatních upraví termín a účel). */
function rezSladitSeZadosti_(zadostId, nazevSboru, ids, od, doo, ucel, kdo) {
  const rez = rezervace_().filter(r => r.zadost === zadostId && r.stav === 'žádost'), zmeny = {}, nove = [];
  rez.forEach(r => { zmeny[r.id] = ids.indexOf(r.mid) < 0 ? { 'Stav': 'zrušeno', 'Poznámka': 'sbor věc odebral ze žádosti' } : { 'Od': new Date(od + 'T00:00:00'), 'Do': new Date(doo + 'T00:00:00'), 'Účel': ucel }; });
  ids.filter(id => !rez.some(r => r.mid === id)).forEach(id => nove.push({ 'Majetek – ID': id, 'Žádost – ID': zadostId, 'Sbor': nazevSboru, 'Od': new Date(od + 'T00:00:00'), 'Do': new Date(doo + 'T00:00:00'), 'Účel': ucel }));
  rezUpravit_(zmeny, kdo);
  rezPridat_(nove, kdo);
}

/** Stažení / zamítnutí žádosti: čekající rezervace → stav. */
function rezUkoncitZadost_(zadostId, stav, duvod, kdo) {
  const zmeny = {};
  rezervace_().filter(r => r.zadost === zadostId && r.stav === 'žádost').forEach(r => { zmeny[r.id] = { 'Stav': stav, 'Poznámka': duvod }; });
  rezUpravit_(zmeny, kdo);
}

/**
 * Schválení žádosti: věci v potvrdit → potvrzeno (předem kontrola, že termín je pořád volný), ostatní → zamítnuto.
 * Vrací { chyba } nebo { potvrzeno: [názvy], zamitnuto: [názvy] }. zapsat = false → jen kontrola.
 */
function rezSchvalit_(zadostId, potvrdit, od, doo, kdo, zapsat) {
  const rez = rezervace_(), moje = rez.filter(r => r.zadost === zadostId && r.stav === 'žádost');
  if (!moje.length) return { potvrzeno: [], zamitnuto: [] };
  const md = mjDataCache_(!zapsat), nazev = mid => ((md.majetek.find(x => x._id === mid) || {})['Název']) || mid;
  const ano = potvrdit == null ? moje.map(r => r.mid) : potvrdit.map(String);
  for (let i = 0; i < moje.length; i++) {
    if (ano.indexOf(moje[i].mid) < 0) continue;
    const ob = mjObsazenost_(md, rez, moje[i].mid, od, doo, zadostId);
    if (ob.tvrde.length) return { chyba: '„' + nazev(moje[i].mid) + '“ je v termínu už obsazené (' + textObsazeni_(ob.tvrde[0]) + '). Odškrtněte ho, nebo žádost vraťte sboru.' };
  }
  if (zapsat) {
    const zmeny = {};
    moje.forEach(r => { zmeny[r.id] = ano.indexOf(r.mid) >= 0 ? { 'Stav': 'potvrzeno', 'Potvrdil': kdo, 'Od': new Date(od + 'T00:00:00'), 'Do': new Date(doo + 'T00:00:00') } : { 'Stav': 'zamítnuto', 'Poznámka': 'okres nepotvrdil' }; });
    rezUpravit_(zmeny, kdo);
  }
  return { potvrzeno: moje.filter(r => ano.indexOf(r.mid) >= 0).map(r => nazev(r.mid)), zamitnuto: moje.filter(r => ano.indexOf(r.mid) < 0).map(r => nazev(r.mid)) };
}

/* ---------- role Majetek ---------- */

/** Rezervace pro evidenci majetku: aktivní a za posledních 12 měsíců, s údaji ze žádosti (místo, kontakt). */
function rezervaceProMajetek_() {
  const rok = Utilities.formatDate(new Date(Date.now() - 365 * 864e5), 'Europe/Prague', 'yyyy-MM-dd');
  const zad = {}; radky_(LIST_ZADOSTI).forEach(z => { if (z['ID']) zad[z['ID']] = z; });
  return rezervace_().filter(r => REZ_AKTIVNI.indexOf(r.stav) >= 0 || r.do >= rok).map(r => {
    const z = zad[r.zadost] || {};
    return Object.assign(r, { nazevAkce: String(z['Název'] || r.ucel), misto: String(z['Místo'] || ''), kontakt: String(z['Kontakt'] || ''), stavZadosti: String(z['Stav'] || '') });
  });
}

/** Zapnutí / vypnutí nabídky sborům u jedné věci. req: id, nabizet (bool), poznamka. */
function mjNabidkaUlozit_(o, req) {
  const id = String(req.id || ''), pozn = String(req.poznamka || '').trim();
  const chyba = kontrolaTextu_({ 'Poznámka': pozn }, { 'Poznámka': 500 });
  if (chyba) return { ok: false, chyba: chyba };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const m = mjNacist_(mjList_(MJ.majetek.soubor, MJ.majetek.list)).rows.find(x => x._id === id);
    if (!m) return { ok: false, chyba: 'Majetek v evidenci není. Načtěte znovu.' };
    if (req.nabizet && m['Aktivní_záznam'] === 'NE') return { ok: false, chyba: 'Vyřazený majetek nejde nabízet sborům.' };
    let sh = dataSs_().getSheetByName(LIST_NABIDKA);
    if (!sh) return { ok: false, chyba: 'V tabulce chybí list Nabídka majetku – spusťte Založit / doplnit strukturu.' };
    const h = hlavicka_(sh), c = k => h.indexOf(k), ted = new Date();
    const v = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues() : [];
    const i = v.findIndex(r => String(r[c('Majetek – ID')]).trim() === id);
    const r = i >= 0 ? v[i] : h.map(() => '');
    const pred = i >= 0 ? (ano_(r[c('Nabízet sborům')]) ? 'ANO' : 'NE') : '';
    const set = (k, x) => { if (c(k) >= 0) r[c(k)] = x; };
    set('Majetek – ID', id); set('Název', bezVzorce_(String(m['Název'] || ''))); set('Nabízet sborům', req.nabizet ? 'ANO' : 'NE'); set('Poznámka pro sbory', bezVzorce_(pozn));
    if (i < 0) { set('Vytvořeno', ted); set('Vytvořil', o.email); }
    set('Upraveno', ted); set('Upravil', o.email);
    if (i >= 0) sh.getRange(i + 2, 1, 1, h.length).setValues([r]); else sh.appendRow(r);
    zaznamZmeny_(o.email, LIST_NABIDKA, id, i >= 0 ? 'upraveno' : 'vytvořeno', pred ? 'Nabízet sborům: ' + pred : '', 'Nabízet sborům: ' + (req.nabizet ? 'ANO' : 'NE') + (pozn ? ' – ' + pozn : ''));
    return { ok: true };
  } finally { lock.releaseLock(); }
}

/** Zrušení potvrzené rezervace (např. věc se rozbila). Sbor dostane e-mail. req: id, poznamka (povinná). */
function rezZrusitOkresem_(o, req) {
  const pozn = String(req.poznamka || '').trim();
  const chyba = kontrolaTextu_({ 'Poznámka': pozn }, { 'Poznámka': 1000 }) || (!pozn ? 'Napište sboru důvod zrušení.' : null);
  if (chyba) return { ok: false, chyba: chyba };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const r = rezervace_().find(x => x.id === String(req.id || ''));
    if (!r) return { ok: false, chyba: 'Rezervace nenalezena. Načtěte znovu.' };
    if (['žádost', 'potvrzeno'].indexOf(r.stav) < 0) return { ok: false, chyba: 'Rezervaci ve stavu „' + r.stav + '“ už nejde zrušit.', kolize: true };
    rezUpravit_({ [r.id]: { 'Stav': 'zrušeno', 'Poznámka': pozn } }, o.email);
    const z = radky_(LIST_ZADOSTI).find(x => x['ID'] === r.zadost), m = mjNacist_(mjList_(MJ.majetek.soubor, MJ.majetek.list)).rows.find(x => x._id === r.mid) || {};
    if (z) {
      const nadpis = 'Zrušená rezervace: ' + (m['Název'] || r.mid), url = (nastaveniWeb_('WEB_URL') || '') + '/Aplikace%20OSH.dc.html';
      const pol = [['Akce', z['Název']], ['Termín', r.od + (r.do !== r.od ? ' až ' + r.do : '')], ['Důvod', pozn]];
      const uvod = 'Okres musel zrušit rezervaci vybavení k vaší akci. Ozvěte se, pokud potřebujete náhradu.';
      komuSboru_(z).forEach(e => { try { posta_(e, nadpis, uvod + '\n\n' + pol.map(p => p[0] + ': ' + p[1]).join('\n'), sablona_(nadpis, uvod, pol, ['Otevřít portál sboru', url])); } catch (x) { console.error(x); } });
    }
    return { ok: true };
  } finally { lock.releaseLock(); }
}

/** Kontakt žádosti + skupina sboru (bez duplicit). */
function komuSboru_(z) {
  const dom = '@' + (nastaveniWeb_('DOMENA') || 'oshpz.cz');
  const s = radkyRychle_('Sbory').find(x => String(x['Sbor'] || '') === z['Sbor']);
  return [normEmail_(z['Kontakt']), s && s['Skupina'] ? String(s['Skupina']).split('@')[0] + dom : ''].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);
}

/** Po schválení žádosti s vybavením: e-mail lidem s rolí Majetek, ať věci připraví. */
function upozornitMajetek_(z, potvrzeno, od, doo) {
  if (!potvrzeno.length) return;
  let komu = radkyRychle_('Uživatelé').filter(u => ano_(u['Aktivní']) && ano_(u['Majetek'])).map(u => normEmail_(u['E-mail']));
  if (!komu.length) komu = ['spravci@' + (nastaveniWeb_('DOMENA') || 'oshpz.cz')];
  const nadpis = 'Rezervace vybavení: ' + z['Název'] + ' (' + z['Sbor'] + ')', url = (nastaveniWeb_('WEB_URL') || '') + '/Aplikace%20OSH.dc.html#okres/majetek';
  const pol = [['Sbor', z['Sbor']], ['Termín', od + (doo !== od ? ' až ' + doo : '')], ['Místo', z['Místo']], ['Kontakt', z['Kontakt']], ['Vybavení', potvrzeno.join('\n')]];
  const uvod = 'Okres schválil žádost sboru včetně vybavení. Připravte ho a při předání zapište výpůjčku (Majetek → Výpůjčky → Rezervace → Vydat).';
  komu.forEach(e => { try { posta_(e, nadpis, uvod + '\n\n' + pol.filter(p => p[1]).map(p => p[0] + ': ' + p[1]).join('\n') + '\n\n' + url, sablona_(nadpis, uvod, pol, ['Otevřít evidenci majetku', url])); } catch (x) { console.error(x); } });
}
