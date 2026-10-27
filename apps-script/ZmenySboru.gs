/**
 * OSH data – Můj sbor: kontakty a údaje sboru v portálu, změny vždy schvaluje okres (role Sbory nebo Správce).
 * Nový soubor „ZmenySboru“ ve stejném projektu.
 *
 * Sbor (portál): vidí lidi ve skupině sdh-…@ (s jménem a funkcí z listu Kontakty sborů) a údaje sboru; připraví změny
 *   (přidat / upravit / odebrat člověka, MH, JSDH, Sport, IČO, web, účet) a pošle je jako jednu žádost do listu Změny sborů.
 * Okres: Schválit a provést = přidá / odebere lidi ve skupině přes Admin SDK (vlastníky a správce skupiny nikdy),
 *   zapíše Kontakty sborů a list Sbory (tady i v tabulce Skupiny OSH – SKUPINY_TABULKA_ID), přeřadí sbor v souhrnných
 *   skupinách sbory-mh@ / sbory-jsdh@ / sbory-sport@ a hned obnoví Členství skupin (přístup do aplikace).
 * Skript běží jako správce Workspace (nasazení „spustit jako já“), proto smí měnit skupiny. Vše do Záznamu změn.
 */

const LIST_KONTAKTY_SBORU = 'Kontakty sborů', LIST_ZMENY_SBORU = 'Změny sborů';
const FUNKCE_SBORU = ['Starosta', 'Velitel sboru', 'Jednatel', 'Pokladník', 'Velitel jednotky (JSDH)', 'Vedoucí mladých hasičů',
  'Vedoucí / instruktor MH', 'Člen výboru', 'Člen sboru'];
// pole údajů sboru: klíč v aplikaci → sloupec listu Sbory
const UDAJE_SBORU = { mh: 'MH', jsdh: 'JSDH', sport: 'Sport', ico: 'IČO', web: 'Web', ucet: 'Číslo účtu' };
const SOUHRNNE_PODLE = { MH: 'sbory-mh', JSDH: 'sbory-jsdh', Sport: 'sbory-sport' };
const ZMENA_EMAIL = /^[^@\s<>"',;]+@[^@\s<>"',;]+\.[^@\s<>"',;]{2,}$/;

function smiSbory_(o) { return !!(o && (o.role['Sbory'] || o.role['Správce'])); }
const domena_ = () => nastaveniWeb_('DOMENA') || 'oshpz.cz';

function apiZmenySboru_(req) {
  const o = prihlaseny_(req.token);
  if (!o) return { ok: false, chyba: 'Nepřihlášen', odhlasen: true };
  if (req.akce === 'kontaktySboru') {
    if (!smiSbory_(o)) return { ok: false, chyba: 'Kontakty sborů vidí jen role Sbory nebo Správce.' };
    return kontaktyOkres_();
  }
  if (req.akce === 'zmenySboru' || req.akce === 'zmenaSboruRozhodnout') {
    if (!smiSbory_(o)) return { ok: false, chyba: 'Změny sborů schvaluje role Sbory nebo Správce.' };
    return req.akce === 'zmenySboru' ? zmenyOkres_() : zmenaRozhodnout_(o, req);
  }
  const u = pohledSboru_(o, req.sbor);
  if (!u) return { ok: false, chyba: 'Ke sboru ' + (req.sbor || '(nevybrán)') + ' nemáte přístup. Odhlaste se a přihlaste znovu, nebo požádejte okres o zařazení do skupiny sboru.' };
  if (req.akce === 'mujSbor') return mujSbor_(u);
  if (req.akce === 'zmenaSboruPodat') return zmenaPodat_(o, u, req);
  if (req.akce === 'zmenaSboruStahnout') return zmenaStahnout_(o, u, String(req.id || ''));
  return { ok: false, chyba: 'Neznámá akce' };
}

/* ---------- čtení ---------- */

/** Kontakty sborů pro okres (role Sbory / Správce): kdo je kdo ve všech sborech – aktivní řádky Kontakty sborů
 *  + členové skupin sdh-…@ bez řádku (bez jména a funkce). Jen čtení; telefony v listu nejsou. */
function kontaktyOkres_() {
  const sk = x => String(x || '').split('@')[0].trim().toLowerCase();
  const sbory = radky_('Sbory').filter(r => sk(r['Skupina'])).map(r => ({ sbor: String(r['Sbor'] || '').trim(), skupina: sk(r['Skupina']), okrsek: String(r['Okrsek'] || '').trim() }));
  const znam = {}; sbory.forEach(x => { znam[x.skupina] = true; });
  const clen = {};
  radky_(LIST_CLENSTVI).forEach(c => { const g = sk(c['Skupina']); if (znam[g] && String(c['Role ve skupině'] || 'Člen') === 'Člen') (clen[g] = clen[g] || {})[normEmail_(c['E-mail'])] = true; });
  const lide = [], videno = {}; // jeden člověk ve sboru = jeden řádek, víc funkcí v poli funkce
  radky_(LIST_KONTAKTY_SBORU).forEach(r => {
    const g = sk(r['Skupina']), e = normEmail_(r['E-mail']), f = String(r['Funkce'] || '').trim(), jm = String(r['Jméno'] || '').trim();
    if (!znam[g] || !e || String(r['Aktivní']).trim().toUpperCase() === 'NE') return;
    const x = videno[g + ' ' + e];
    if (x) { if (f && x.funkce.indexOf(f) < 0) x.funkce.push(f); if (!x.jmeno) x.jmeno = jm; return; }
    lide.push(videno[g + ' ' + e] = { skupina: g, jmeno: jm, funkce: f ? [f] : [], email: e, veSkupine: !!(clen[g] || {})[e] });
  });
  Object.keys(clen).forEach(g => Object.keys(clen[g]).forEach(e => { if (e && !videno[g + ' ' + e]) lide.push({ skupina: g, jmeno: '', funkce: [], email: e, veSkupine: true }); }));
  return { ok: true, sbory: sbory, lide: lide, funkce: FUNKCE_SBORU, domena: domena_() };
}

function listSbory_() { const sh = dataSs_().getSheetByName('Sbory'); return { sh, h: hlavicka_(sh) }; }

/** Údaje sboru z listu Sbory (podle skupiny). */
function udajeSboru_(skupina) {
  const r = radky_('Sbory').find(x => String(x['Skupina'] || '').split('@')[0].toLowerCase() === skupina) || {};
  const txt = k => String(r[k] == null ? '' : r[k]).trim();
  return { sbor: txt('Sbor'), okrsek: r['Okrsek'] || '', mh: ano_(r['MH']) ? 'ANO' : 'NE', jsdh: ano_(r['JSDH']) ? 'ANO' : 'NE', sport: ano_(r['Sport']) ? 'ANO' : 'NE',
    ico: txt('IČO'), web: txt('Web'), ucet: txt('Číslo účtu') };
}

/** Lidé sboru: členové skupiny (Členství skupin) + aktivní řádky Kontakty sborů (jméno, funkce). */
function lideSboru_(skupina) {
  const kontakty = radky_(LIST_KONTAKTY_SBORU).filter(r => String(r['Skupina'] || '').split('@')[0].toLowerCase() === skupina && String(r['Aktivní']).trim().toUpperCase() !== 'NE');
  // jen běžní členové skupiny – vlastníci a správci (účty okresu) do seznamu sboru nepatří
  const clen = radky_(LIST_CLENSTVI).filter(c => String(c['Skupina']).toLowerCase() === skupina && String(c['Role ve skupině'] || 'Člen') === 'Člen').map(c => normEmail_(c['E-mail']));
  const out = {};
  kontakty.forEach(r => { const e = normEmail_(r['E-mail']); if (e) out[e] = { email: e, jmeno: String(r['Jméno'] || ''), funkce: String(r['Funkce'] || ''), veSkupine: clen.indexOf(e) >= 0 }; });
  clen.forEach(e => { if (!out[e]) out[e] = { email: e, jmeno: '', funkce: '', veSkupine: true }; });
  const poradi = f => { const i = FUNKCE_SBORU.indexOf(f); return i < 0 ? 99 : i; };
  return Object.keys(out).map(e => out[e]).sort((a, b) => (poradi(a.funkce) - poradi(b.funkce)) || a.email.localeCompare(b.email));
}

function zmenaJson_(r) {
  let zmeny = []; try { zmeny = JSON.parse(String(r['Změny'] || '[]')); } catch (e) {}
  const iso = v => v instanceof Date ? v.toISOString() : (v == null ? '' : v);
  return { ID: r['ID'], Sbor: r['Sbor'], Skupina: r['Skupina'], zmeny, Stav: r['Stav'], 'Poznámka sboru': r['Poznámka sboru'] || '', 'Poznámka': r['Poznámka'] || '',
    'Výsledek': r['Výsledek'] || '', Podal: r['Vytvořil'] || '', Podáno: iso(r['Vytvořeno']), Vyřídil: r['Vyřídil'] || '', Vyřízeno: iso(r['Vyřízeno']) };
}

function mujSbor_(u, lide, udaje) { // lide, udaje = už načtené (po podání se nemění – ušetří dvě čtení tabulky)
  const sk = u.sbor.skupina;
  const zadosti = radky_(LIST_ZMENY_SBORU).filter(r => r['ID'] && String(r['Skupina']).split('@')[0].toLowerCase() === sk).map(zmenaJson_).reverse().slice(0, 20);
  return { ok: true, skupina: sk + '@' + domena_(), lide: lide || lideSboru_(sk), udaje: udaje || udajeSboru_(sk), funkce: FUNKCE_SBORU, zadosti };
}

/* ---------- sbor: podání a stažení ---------- */

function kontrolaZmeny_(z, lide) {
  const e = normEmail_(z.email), je = e && lide.some(x => x.email === e);
  if (z.typ === 'pridat' || z.typ === 'zmenit' || z.typ === 'odebrat') {
    if (!ZMENA_EMAIL.test(e) || e.length > 254) return 'Neplatný e-mail: ' + (z.email || '(prázdný)');
    if (z.typ === 'pridat' && je) return e + ' už u sboru je – použijte Upravit.';
    if (z.typ !== 'pridat' && !je) return e + ' u sboru není.';
    if (z.typ !== 'odebrat') {
      const ch = kontrolaTextu_({ 'Jméno': z.jmeno }, { 'Jméno': 120 });
      if (ch) return ch;
      if (z.funkce && FUNKCE_SBORU.indexOf(z.funkce) < 0) return 'Neznámá funkce: ' + z.funkce;
    }
    return null;
  }
  if (z.typ === 'udaje') {
    const pole = UDAJE_SBORU[z.pole], v = String(z.hodnota == null ? '' : z.hodnota).trim();
    if (!pole) return 'Neznámý údaj: ' + z.pole;
    if (/^(mh|jsdh|sport)$/.test(z.pole) && ['ANO', 'NE'].indexOf(v) < 0) return pole + ': jen ANO nebo NE.';
    if (z.pole === 'ico' && v && !/^\d{8}$/.test(v)) return 'IČO má 8 číslic.';
    if (z.pole === 'ucet' && v && !/^(\d{1,6}-)?\d{2,10}\/\d{4}$/.test(v)) return 'Číslo účtu ve tvaru [předčíslí-]číslo/kód banky, např. 123456789/0800.';
    if (z.pole === 'web' && v && !/^https?:\/\/[^\s<>"']{3,300}$/i.test(v)) return 'Web musí začínat https:// nebo http://';
    return null;
  }
  return 'Neznámý typ změny.';
}

function popisZmeny_(z) {
  if (z.typ === 'pridat') return 'Přidat: ' + [z.jmeno, z.funkce].filter(Boolean).join(', ') + ' <' + z.email + '>';
  if (z.typ === 'zmenit') return 'Upravit: ' + z.email + ' → ' + [z.jmeno, z.funkce].filter(Boolean).join(', ');
  if (z.typ === 'odebrat') return 'Odebrat: ' + [z.jmeno, z.email].filter(Boolean).join(' ');
  return UDAJE_SBORU[z.pole] + ': ' + (z.puvodne || '–') + ' → ' + (z.hodnota || '–');
}

function zmenaPodat_(o, u, req) {
  const sk = u.sbor.skupina;
  const zmeny = Array.isArray(req.zmeny) ? req.zmeny.slice(0, 31) : [];
  if (!zmeny.length) return { ok: false, chyba: 'Žádné změny k odeslání.' };
  if (zmeny.length > 30) return { ok: false, chyba: 'Najednou nejvýše 30 změn.' };
  const pozn = String(req.poznamka || '').trim();
  const chP = kontrolaTextu_({ 'Poznámka': pozn }, { 'Poznámka': 1000 });
  if (chP) return { ok: false, chyba: chP };
  if (limit_('zmena-sboru-podat', o.email, 20, 3600)) return { ok: false, chyba: 'Příliš mnoho žádostí za hodinu. Zkuste to později.' };
  mer_('zbytek');
  const lide = lideSboru_(sk), udaje = udajeSboru_(sk);
  mer_('čtení sboru');
  const ciste = [];
  for (const z0 of zmeny) {
    const z = { typ: String(z0.typ || ''), email: normEmail_(z0.email), jmeno: String(z0.jmeno || '').trim(), funkce: String(z0.funkce || '').trim(), pole: String(z0.pole || ''), hodnota: String(z0.hodnota == null ? '' : z0.hodnota).trim() };
    if (z.pole === 'ucet') z.hodnota = z.hodnota.replace(/\s+/g, '');
    if (z.pole === 'ico') z.hodnota = z.hodnota.replace(/\D/g, '');
    const ch = kontrolaZmeny_(z, lide);
    if (ch) return { ok: false, chyba: ch };
    const c = { typ: z.typ };
    if (z.typ === 'udaje') { c.pole = z.pole; c.hodnota = z.hodnota; c.puvodne = udaje[z.pole] || ''; if (c.hodnota === c.puvodne) continue; }
    else { c.email = z.email; if (z.typ !== 'odebrat') { c.jmeno = z.jmeno; c.funkce = z.funkce; } else { const p = lide.find(x => x.email === z.email); c.jmeno = p ? p.jmeno : ''; } }
    ciste.push(c);
  }
  if (!ciste.length) return { ok: false, chyba: 'Změny jsou stejné jako současný stav.' };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = dataSs_().getSheetByName(LIST_ZMENY_SBORU);
    if (!sh) throw new Error('Chybí list Změny sborů – spusťte zalozitStrukturu.');
    const h = hlavicka_(sh), ted = new Date(), id = 'ZS' + Utilities.formatDate(ted, 'Europe/Prague', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
    const v = { 'ID': id, 'Sbor': u.sbor.sbor, 'Skupina': sk, 'Změny': JSON.stringify(ciste), 'Popis': ciste.map(popisZmeny_).join('\n'), 'Stav': 'podáno',
      'Poznámka sboru': pozn, 'Vytvořeno': ted, 'Vytvořil': o.email, 'Upraveno': ted, 'Upravil': o.email };
    mer_('zbytek');
    sh.appendRow(h.map(k => k in v ? bezVzorce_(v[k]) : ''));
    mer_('zápis');
    zaznamZmeny_(o.email, LIST_ZMENY_SBORU, id, 'vytvořeno', '', u.sbor.sbor + ': ' + v['Popis'].slice(0, 400));
    upozornitNaZmenu_(v);
    mer_('zbytek');
    const data = mujSbor_(u, lide, udaje);
    mer_('odpověď');
    return { ok: true, id: id, data: data };
  } finally { lock.releaseLock(); }
}

function zmenaStahnout_(o, u, id) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = dataSs_().getSheetByName(LIST_ZMENY_SBORU), h = hlavicka_(sh), col = k => h.indexOf(k);
    const v = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues() : [];
    const i = v.findIndex(r => String(r[col('ID')]) === id);
    if (i < 0) return { ok: false, chyba: 'Žádost nenalezena.' };
    if (String(v[i][col('Skupina')]).split('@')[0].toLowerCase() !== u.sbor.skupina) return { ok: false, chyba: 'Žádost patří jinému sboru.' };
    if (v[i][col('Stav')] !== 'podáno') return { ok: false, chyba: 'Vyřízenou žádost už nejde zrušit.' };
    sh.getRange(i + 2, col('Stav') + 1).setValue('zrušeno');
    sh.getRange(i + 2, col('Upraveno') + 1, 1, 2).setValues([[new Date(), o.email]]);
    zaznamZmeny_(o.email, LIST_ZMENY_SBORU, id, 'upraveno', 'podáno', 'zrušeno sborem');
    return { ok: true, data: mujSbor_(u) };
  } finally { lock.releaseLock(); }
}

/* ---------- okres ---------- */

function zmenyOkres_() {
  const data = radky_(LIST_ZMENY_SBORU).filter(r => r['ID']).map(zmenaJson_).reverse();
  // u nevyřízených i současný stav sboru (kontrola, co se mění)
  const cache = {};
  data.filter(z => z.Stav === 'podáno').forEach(z => {
    const sk = String(z.Skupina).split('@')[0].toLowerCase();
    if (!cache[sk]) cache[sk] = { lide: lideSboru_(sk), udaje: udajeSboru_(sk) };
    z.soucasne = cache[sk];
  });
  return { ok: true, data: data };
}

function zmenaRozhodnout_(o, req) {
  const id = String(req.id || ''), roz = String(req.rozhodnuti || ''), pozn = String(req.poznamka || '').trim();
  if (['schválit', 'zamítnout'].indexOf(roz) < 0) return { ok: false, chyba: 'Neznámé rozhodnutí.' };
  if (roz === 'zamítnout' && !pozn) return { ok: false, chyba: 'Napište sboru, proč změnu zamítáte.' };
  const chP = kontrolaTextu_({ 'Poznámka': pozn }, { 'Poznámka': 1000 });
  if (chP) return { ok: false, chyba: chP };
  mer_('zbytek');
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  mer_('zámek');
  try {
    const sh = dataSs_().getSheetByName(LIST_ZMENY_SBORU), h = hlavicka_(sh), col = k => h.indexOf(k);
    const v = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues() : [];
    const i = v.findIndex(r => String(r[col('ID')]) === id);
    if (i < 0) return { ok: false, chyba: 'Žádost nenalezena.' };
    const r = v[i];
    if (r[col('Stav')] !== 'podáno') return { ok: false, chyba: 'Žádost je ve stavu „' + r[col('Stav')] + '“.' };
    let vysledek = [];
    if (roz === 'schválit') {
      let zmeny = []; try { zmeny = JSON.parse(String(r[col('Změny')] || '[]')); } catch (e) {}
      vysledek = provestZmeny_(o, String(r[col('Sbor')]), String(r[col('Skupina')]).split('@')[0].toLowerCase(), zmeny);
    }
    const ted = new Date();
    r[col('Stav')] = roz === 'schválit' ? 'schváleno' : 'zamítnuto'; r[col('Poznámka')] = pozn; r[col('Výsledek')] = vysledek.join('\n');
    r[col('Vyřídil')] = o.email; r[col('Vyřízeno')] = ted; r[col('Upraveno')] = ted; r[col('Upravil')] = o.email;
    sh.getRange(i + 2, 1, 1, h.length).setValues([r.map(bezVzorce_)]);
    zaznamZmeny_(o.email, LIST_ZMENY_SBORU, id, roz === 'schválit' ? 'schváleno' : 'zamítnuto', 'podáno', (vysledek.join('; ') || pozn).slice(0, 450));
    oznamitZmenuSboru_(h.reduce((x, k, j) => (x[k] = r[j], x), {}));
    mer_('zbytek');
    const data = zmenyOkres_().data;
    mer_('odpověď');
    return { ok: true, vysledek: vysledek, data: data };
  } finally { lock.releaseLock(); }
}

/** Provedení schválených změn. Vrací seznam výsledků (pro sloupec Výsledek a hlášku okresu). */
function provestZmeny_(o, sbor, sk, zmeny) {
  if (typeof AdminDirectory === 'undefined') throw new Error('Chybí služba Admin SDK API (AdminDirectory).');
  const skupina = sk + '@' + domena_(), out = [];
  const shK = dataSs_().getSheetByName(LIST_KONTAKTY_SBORU);
  if (!shK) throw new Error('Chybí list Kontakty sborů – spusťte zalozitStrukturu.');
  const hK = hlavicka_(shK), cK = k => hK.indexOf(k);
  const ulozKontakt = (z, aktivni) => {
    const vK = shK.getLastRow() > 1 ? shK.getRange(2, 1, shK.getLastRow() - 1, hK.length).getValues() : [], ted = new Date();
    const i = vK.findIndex(x => String(x[cK('Skupina')]).split('@')[0].toLowerCase() === sk && normEmail_(x[cK('E-mail')]) === z.email);
    const r = i >= 0 ? vK[i] : hK.map(() => '');
    const set = (k, val) => { if (cK(k) >= 0 && val !== undefined) r[cK(k)] = val; };
    set('Sbor', sbor); set('Skupina', sk); set('E-mail', z.email); set('Aktivní', aktivni ? 'ANO' : 'NE');
    if (aktivni) { set('Jméno', z.jmeno || r[cK('Jméno')] || ''); set('Funkce', z.funkce || r[cK('Funkce')] || ''); set('Zdroj', 'aplikace'); }
    if (i < 0) { set('Vytvořeno', ted); set('Vytvořil', o.email); }
    set('Upraveno', ted); set('Upravil', o.email);
    if (i >= 0) shK.getRange(i + 2, 1, 1, hK.length).setValues([r.map(bezVzorce_)]); else shK.appendRow(r.map(bezVzorce_));
  };
  // údaje sboru najednou (list Sbory i tabulka Skupiny OSH se otevřou jednou, ne u každého údaje)
  mer_('zbytek');
  const udaje = zmeny.filter(z => z.typ === 'udaje');
  if (udaje.length) { try { zapsatUdaje_(sk, udaje.map(z => [UDAJE_SBORU[z.pole], z.hodnota])).forEach(t => out.push(t)); } catch (e) { out.push('CHYBA u údajů: ' + e.message); } }
  mer_('údaje + souhrnné skupiny');
  zmeny.filter(z => z.typ !== 'udaje').forEach(z => {
    try {
      if (z.typ === 'pridat') {
        try { AdminDirectory.Members.insert({ email: z.email, role: 'MEMBER' }, skupina); out.push('přidán ' + z.email); }
        catch (e) { if (/already exists|duplicate|Member already/i.test(e.message)) out.push(z.email + ' už ve skupině byl'); else throw e; }
        ulozKontakt(z, true);
      } else if (z.typ === 'zmenit') {
        ulozKontakt(z, true); out.push('upraven ' + z.email);
      } else if (z.typ === 'odebrat') {
        let m = null; try { m = AdminDirectory.Members.get(skupina, z.email); } catch (e) { m = null; }
        if (m && m.role !== 'MEMBER') { out.push(z.email + ' neodebrán – je vlastník nebo správce skupiny'); return; }
        if (m) AdminDirectory.Members.remove(skupina, z.email);
        ulozKontakt(z, false); out.push('odebrán ' + z.email);
      }
    } catch (e) { out.push('CHYBA u ' + (z.email || z.pole) + ': ' + e.message); }
    if (z.typ !== 'zmenit') Utilities.sleep(150); // jen mezi voláními Admin SDK
  });
  // Google po přidání / odebrání chvíli vrací starý seznam členů – co jsme právě udělali, započítat ručně
  const pridani = zmeny.filter(z => z.typ === 'pridat').map(z => z.email), odebrani = zmeny.filter(z => z.typ === 'odebrat' && out.some(t => t === 'odebrán ' + z.email)).map(z => z.email);
  // seznam členů z Google (sloupec Kontakty, Členství skupin) jen když se členové opravdu měnili – je to nejpomalejší část
  mer_('členové skupiny');
  if (pridani.length || odebrani.length) { try { out.push(obnovitKontaktySboru_(sk, pridani, odebrani)); } catch (e) { out.push('CHYBA při obnově seznamu Kontakty: ' + e.message); } mer_('seznam členů z Google'); }
  zaznamZmeny_(o.email, 'Sbory', sbor, 'upraveno', '', 'změny sboru provedeny: ' + out.join('; ').slice(0, 400));
  return out;
}

/** Jeden údaj do listu Sbory (tady i v tabulce Skupiny OSH), u MH / JSDH / Sport i souhrnná skupina. */
function zapsatUdaj_(sk, sloupec, hodnota) { return zapsatUdaje_(sk, [[sloupec, hodnota]])[0]; }

/** Víc údajů jednoho sboru najednou: list Sbory se čte jednou, tabulka Skupiny OSH se otevře jednou. polozky = [[sloupec, hodnota], …]. */
function zapsatUdaje_(sk, polozky) {
  const { sh, h } = listSbory_(), cS = h.indexOf('Skupina');
  const v = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), h.length).getValues();
  const i = v.findIndex(r => String(r[cS]).split('@')[0].toLowerCase() === sk);
  if (i < 0) return polozky.map(() => 'sbor ' + sk + ' v listu Sbory chybí');
  const out = [], doSkupin = [];
  polozky.forEach(([sloupec, hodnota]) => {
    const col = h.indexOf(sloupec);
    if (col < 0) { out.push('sloupec ' + sloupec + ' v listu Sbory chybí'); return; }
    const bunka = sh.getRange(i + 2, col + 1);
    if (/^(IČO|Číslo účtu)$/.test(sloupec)) bunka.setNumberFormat('@');
    bunka.setValue(hodnota);
    doSkupin.push([sloupec, hodnota]);
    let s = sloupec + ' = ' + (hodnota || '(prázdné)');
    if (SOUHRNNE_PODLE[sloupec]) {
      try {
        const souhrnna = SOUHRNNE_PODLE[sloupec] + '@' + domena_(), clen = sk + '@' + domena_(), chci = hodnota === 'ANO';
        let je = false; try { AdminDirectory.Members.get(souhrnna, clen); je = true; } catch (e) {}
        if (chci && !je) { AdminDirectory.Members.insert({ email: clen, role: 'MEMBER' }, souhrnna); s += ', přidán do ' + souhrnna; }
        if (!chci && je) { AdminDirectory.Members.remove(souhrnna, clen); s += ', odebrán z ' + souhrnna; }
      } catch (e) { s += ', CHYBA souhrnné skupiny: ' + e.message; }
    }
    out.push(s);
  });
  zapsatDoSkupinOshVice_(sk, doSkupin);
  vycistitMezipamet_('Sbory'); vycistitCache_();
  return out;
}

/** Tabulka Skupiny OSH (skript skupin čte svůj list Sbory) – stejný údaj, ať se seznamy nerozejdou. */
function zapsatDoSkupinOsh_(sk, sloupec, hodnota) { zapsatDoSkupinOshVice_(sk, [[sloupec, hodnota]]); }
function zapsatDoSkupinOshVice_(sk, polozky) {
  const id = nastaveniWeb_('SKUPINY_TABULKA_ID');
  if (!id || !polozky.length) return;
  try {
    const sh = SpreadsheetApp.openById(id).getSheetByName('Sbory'), v = sh.getDataRange().getValues(), h = v[0].map(x => String(x).trim().toLowerCase());
    const cS = h.indexOf('skupina');
    const i = cS < 0 ? -1 : v.findIndex((r, j) => j > 0 && String(r[cS]).split('@')[0].trim().toLowerCase() === sk);
    if (i <= 0) return;
    polozky.forEach(([sloupec, hodnota]) => {
      const col = h.indexOf(sloupec.toLowerCase());
      if (col < 0) return;
      const b = sh.getRange(i + 1, col + 1); if (/^(IČO|Číslo účtu)$/.test(sloupec)) b.setNumberFormat('@'); b.setValue(hodnota);
    });
  } catch (e) { console.warn('Tabulka Skupiny OSH: ' + e.message); }
}

/** Po změně členů: sloupec Kontakty (Sbory – tady i ve Skupinách OSH) a Členství skupin podle skutečných členů skupiny. */
function obnovitKontaktySboru_(sk, pridani, odebrani) {
  const skupina = sk + '@' + domena_();
  let lide = [];
  let t;
  do {
    const res = AdminDirectory.Members.list(skupina, { maxResults: 200, pageToken: t });
    (res.members || []).filter(m => m.type !== 'GROUP' && m.email && m.status !== 'SUSPENDED').forEach(m => lide.push({ e: normEmail_(m.email), role: m.role }));
    t = res.nextPageToken;
  } while (t);
  (pridani || []).forEach(e => { if (!lide.some(m => m.e === e)) lide.push({ e: e, role: 'MEMBER' }); });
  lide = lide.filter(m => (odebrani || []).indexOf(m.e) < 0);
  const kontakty = lide.filter(m => m.role === 'MEMBER').map(m => m.e).join(', ');
  const { sh, h } = listSbory_(), cS = h.indexOf('Skupina'), cK = h.indexOf('Kontakty');
  if (cK >= 0) {
    const v = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), h.length).getValues();
    const i = v.findIndex(r => String(r[cS]).split('@')[0].toLowerCase() === sk);
    if (i >= 0) sh.getRange(i + 2, cK + 1).setValue(kontakty);
  }
  zapsatDoSkupinOsh_(sk, 'Kontakty', kontakty);
  // Členství skupin: řádky této skupiny nahradit (přístup do aplikace platí hned, ne až po hodinové obnově)
  const shC = dataSs_().getSheetByName(LIST_CLENSTVI);
  if (shC && shC.getLastRow() > 1) {
    const vC = shC.getRange(2, 1, shC.getLastRow() - 1, 5).getValues();
    const nazev = (vC.find(r => r[1] === sk) || [])[2] || '';
    const zbytek = vC.filter(r => r[1] !== sk), ted = new Date();
    const nove = zbytek.concat(lide.map(m => [m.e, sk, nazev, ({ MEMBER: 'Člen', MANAGER: 'Správce', OWNER: 'Vlastník' })[m.role] || m.role, ted]));
    shC.getRange(2, 1, shC.getLastRow() - 1, 5).clearContent();
    if (nove.length) shC.getRange(2, 1, nove.length, 5).setValues(nove);
    CacheService.getScriptCache().remove('clenstvi');
  }
  vycistitMezipamet_('Sbory');
  return 'skupina má ' + lide.filter(m => m.role === 'MEMBER').length + ' členů';
}

/* ---------- e-maily ---------- */

function upozornitNaZmenu_(v) {
  let komu = radkyRychle_('Uživatelé').filter(u => ano_(u['Aktivní']) && (ano_(u['Sbory']) || ano_(u['Správce']))).map(u => normEmail_(u['E-mail']));
  if (!komu.length) komu = ['spravci@' + domena_()];
  const predmet = 'Změna údajů sboru ke schválení: ' + v['Sbor'];
  const uvod = v['Vytvořil'] + ' navrhuje změny u ' + v['Sbor'] + '. Schvalte je ve správě okresu → Změny sborů.';
  const url = (nastaveniWeb_('WEB_URL') || '') + '/Aplikace%20OSH.dc.html';
  const pol = [['Změny', v['Popis']], ['Poznámka sboru', v['Poznámka sboru']]];
  komu.filter((x, i, a) => a.indexOf(x) === i).forEach(e => { try { posta_(e, predmet, uvod + '\n\n' + v['Popis'] + '\n\n' + url, sablona_(predmet, uvod, pol, ['Otevřít změny sborů', url], 'Automatická zpráva.')); } catch (x) { console.error(x); } });
}

function oznamitZmenuSboru_(r) {
  const komu = normEmail_(r['Vytvořil']); if (!komu) return;
  const ok = r['Stav'] === 'schváleno';
  const predmet = (ok ? 'Změny sboru schváleny: ' : 'Změny sboru zamítnuty: ') + r['Sbor'];
  const uvod = ok ? 'Okres vaše změny schválil a provedl.' : 'Okres vaše změny zamítl.';
  const url = (nastaveniWeb_('WEB_URL') || '') + '/Aplikace%20OSH.dc.html';
  const pol = [['Změny', r['Popis']], ['Poznámka okresu', r['Poznámka']]];
  try { posta_(komu, predmet, uvod + '\n\n' + r['Popis'] + (r['Poznámka'] ? '\n\nPoznámka okresu: ' + r['Poznámka'] : '') + '\n\n' + url, sablona_(predmet, uvod, pol, ['Otevřít portál sboru', url])); } catch (x) { console.error(x); }
}
