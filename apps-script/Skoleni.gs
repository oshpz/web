/**
 * OSH data – školení a odbornosti (B18, návrh docs/skoleni.md). Nový soubor „Skoleni“ ve stejném projektu.
 *
 * Školení = řádek Akce (Typ školení → kalendář, web, oznámení sborům) + řádek listu Školení (klíč Akce – ID), stejně jako soutěže.
 *   Druh: kurz (nová kvalifikace), obnova (prodloužení platnosti), seminář (bez kvalifikace), zkouška (odbornosti a specializace MH).
 *   Stavy: koncept → přihlášky → uzavřeno → vyhodnoceno; zrušeno. Akce je zveřejněná od stavu přihlášky.
 * Sbor (portál → Členové → Školení) přihlásí členy ze Seznamu členů (B17), výjimečně ručně (není v seznamu), do uzávěrky a kapacity.
 * Přihlášky z webu (sloupec Přihlášky z webu = ANO, jen školení pro veřejnost): kdokoli i bez portálu – Turnstile, limity, e-mail povinný
 *   (potvrzení), Přihlásil = web; vybraný sbor z okresu dostane e-mail a účastníka vidí v portálu (bez kontaktu), okres ho může odhlásit.
 * Okres (role Školení = všechny / MH / dospělí, nebo Správce) vede prezenci (PDF), zapíše výsledky; vyhodnocení u „absolvoval“
 *   založí kvalifikaci v listu Kvalifikace (Platí do = konec školení + Platnost z listu Druhy kvalifikací), u obnovy starou ukončí.
 * Druhy kvalifikací (katalog) jsou v tabulce, ne v kódu – platnosti potvrdí odborné rady (OORM, OORS, OORV, OORB).
 * Noční údržba (skUdrzba_): upozornění sborům před koncem platnosti (SKOLENI_UPOZORNIT_DNY) a výmaz po lhůtách (SKOLENI_VYMAZ_*).
 * Bez rodného čísla a adresy – jen jméno, datum narození a sbor (jako list Členové).
 */

const LIST_SKOLENI = 'Školení', LIST_UCASTNICI = 'Účastníci školení', LIST_KVALIFIKACE = 'Kvalifikace', LIST_DRUHY_KVAL = 'Druhy kvalifikací';
const SK_DRUHY = ['kurz', 'obnova', 'seminář', 'zkouška'];
const SK_STAVY = ['koncept', 'přihlášky', 'uzavřeno', 'vyhodnoceno', 'zrušeno'];
const SK_UCAST = ['přihlášeno', 'odhlášeno', 'absolvoval', 'neuspěl', 'nepřišel'];
const SK_ORGANY = ['OORM', 'OORS', 'OORB', 'OORV', 'VV'];
const SK_OBLASTI = ['mládež', 'sport', 'represe', 'prevence', 'organizace'];
const SK_MAX_UCASTNIKU = 200;
const SK_LIMIT_WEB = 30, SK_LIMIT_EMAIL = 5; // přihlášky z webu: za 10 min celý web, za hodinu jeden e-mail

// Výchozí katalog pro Založit / doplnit strukturu (jen když je list prázdný). [kód, název, oblast, pro, platnost (roky, 0 = bez omezení), orgán, poznámka, min. věk]
// Platnosti a seznam odborností MH jsou NÁVRH – potvrdí je odborné rady (docs/skoleni.md, otázky Q2–Q4).
const SK_VYCHOZI_DRUHY = [
  ['VM3', 'Vedoucí mládeže III. stupně', 'mládež', 'dospělí', 5, 'OORM', 'Vstupní kvalifikace vedoucího (od 18 let) a instruktora (15–18 let). Platnost ověří OORM.', 15],
  ['VM2', 'Vedoucí mládeže II. stupně', 'mládež', 'dospělí', 5, 'OORM', 'Platnost ověří OORM.', 18],
  ['VM1', 'Vedoucí mládeže I. stupně', 'mládež', 'dospělí', 5, 'OORM', 'Platnost ověří OORM.', 18],
  ['RM', 'Rozhodčí soutěží mládeže', 'mládež', 'dospělí', 5, 'OORM', 'Průkaz má datum platnosti, obnovuje se školením. Délku platnosti ověří OORM.', 18],
  ['HVT', 'Hlavní vedoucí zotavovacích akcí', 'mládež', 'dospělí', 0, 'OORM', 'Osvědčení podle NSK – bez omezení platnosti.', 18],
  ['RPS', 'Rozhodčí požárního sportu', 'sport', 'dospělí', 5, 'OORS', 'Platnost ověří OORS.', 18],
  ['TR3', 'Trenér požárního sportu III. třídy', 'sport', 'dospělí', 0, 'OORS', 'Ověří OORS.', 18],
  ['STR', 'Strojník SH ČMS', 'represe', 'dospělí', 0, 'VV', 'Ověří VV / OORR.'],
  ['VEL', 'Velitel SH ČMS', 'represe', 'dospělí', 0, 'VV', 'Ověří VV / OORR.'],
  ['H1', 'Hasič I. stupně', 'represe', 'dospělí', 0, 'VV', 'Specializace SH ČMS. Ověří VV.'],
  ['PRE', 'Preventista SH ČMS', 'prevence', 'dospělí', 0, 'OORB', 'Ověří OORB.'],
  ['MH-STR', 'Odbornost MH – Strojník', 'mládež', 'MH', 0, 'OORM', 'Seznam odborností a specializací MH ověří OORM.'],
  ['MH-ZDR', 'Odbornost MH – Zdravotník', 'mládež', 'MH', 0, 'OORM', ''],
  ['MH-PRE', 'Odbornost MH – Preventista', 'mládež', 'MH', 0, 'OORM', ''],
  ['MH-KRO', 'Odbornost MH – Kronikář', 'mládež', 'MH', 0, 'OORM', ''],
  ['MH-CVI', 'Odbornost MH – Cvičitel', 'mládež', 'MH', 0, 'OORM', ''],
  ['MH-SPO', 'Odbornost MH – Spojař', 'mládež', 'MH', 0, 'OORM', ''],
  ['MH-TOP', 'Odbornost MH – Topograf', 'mládež', 'MH', 0, 'OORM', '']];

/* ---------- role ---------- */

function skRole_(o) {
  if (!o) return '';
  if (o.role['Správce']) return 'všechny';
  const r = o.role['Školení'];
  return r === true ? 'všechny' : ['všechny', 'MH', 'dospělí'].indexOf(r) >= 0 ? r : '';
}
function smiSkoleni_(o, pro) { const r = skRole_(o); return !!r && (!pro || r === 'všechny' || r === pro); }

/* ---------- čtení ---------- */

function skTab_(nazev) {
  const sh = dataSs_().getSheetByName(nazev);
  if (!sh) throw new Error('Chybí list „' + nazev + '“ – spusťte v tabulce OSH data → Založit / doplnit strukturu.');
  const h = hlavicka_(sh), col = k => h.indexOf(k);
  const v = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues() : [];
  return { sh, h, col, v };
}
const skObj_ = (h, r) => h.reduce((x, k, j) => (k && (x[k] = r[j]), x), {});
const skIso_ = v => v instanceof Date && !isNaN(v) ? v.toISOString() : String(v || '');
function skNoveId_(p) { return p + Utilities.formatDate(new Date(), 'Europe/Prague', 'yyMMddHHmmss') + Math.floor(Math.random() * 900 + 100); }
/** Datum bez času (začátek dne v Praze). */
function skDnes_() { const d = new Date(Utilities.formatDate(new Date(), 'Europe/Prague', 'yyyy-MM-dd') + 'T00:00:00'); return d; }

function skDruhy_() {
  if (!dataSs_().getSheetByName(LIST_DRUHY_KVAL)) return [];
  return radky_(LIST_DRUHY_KVAL).filter(r => String(r['Kód'] || '').trim()).map(r => {
    const m = String(r['Materiály'] || '').trim();
    return { kod: String(r['Kód']).trim(), nazev: String(r['Název'] || ''), oblast: String(r['Oblast'] || ''), pro: String(r['Pro'] || 'dospělí'), platnost: Number(r['Platnost (roky)']) || 0, minVek: Number(r['Min. věk']) || 0,
      organ: String(r['Orgán'] || ''), materialy: /^https:\/\/\S{3,490}$/i.test(m) ? m : '', aktivni: String(r['Aktivní'] || 'ANO').toUpperCase() !== 'NE', poznamka: String(r['Poznámka'] || '') };
  });
}
function skDruh_(kod) { return skDruhy_().find(d => d.kod === String(kod || '')) || null; }

/** Stav akce v kalendáři podle stavu školení: koncept a zrušené se nezveřejní. */
function skAkceStav_(stav) { return stav === 'koncept' ? 'koncept' : stav === 'zrušeno' ? 'zrušeno' : 'zveřejněno'; }

/** Kódy kvalifikací školení: u zkoušky odborností jich může být víc (oddělené čárkou), jinak jeden. */
const skKody_ = v => (Array.isArray(v) ? v : String(v || '').split(',')).map(x => String(x).trim()).filter((x, i, a) => x && a.indexOf(x) === i);
function skJson_(s, a, druhy) {
  const kody = skKody_(s['Kvalifikace']), dr = kody.map(k => (druhy || []).find(d => d.kod === k) || { kod: k, nazev: k, platnost: 0 });
  return { id: String(s['Akce – ID']), nazev: String(a['Název'] || ''), od: skIso_(a['Od']), do: skIso_(a['Do']), misto: String(a['Místo'] || ''), poradatel: String(a['Pořadatel'] || ''),
    popis: String(a['Popis'] || ''), proKoho: String(a['Pro koho'] || ''), okrsek: a['Okrsek'] === '' || a['Okrsek'] == null ? '' : Number(a['Okrsek']),
    druh: String(s['Druh'] || 'kurz'), kvalifikace: kody[0] || '', kody: kody, kvalifikaceSeznam: dr.map(d => ({ kod: d.kod, nazev: d.nazev })),
    kvalifikaceNazev: dr.map(d => d.nazev).join(', '), platnost: dr.length ? dr[0].platnost : 0, minVek: dr.reduce((m, d) => Math.min(m, d.minVek || 0), dr.length ? 99 : 0), pro: String(s['Pro'] || 'dospělí'), organ: String(s['Orgán'] || ''),
    kapacita: Number(s['Kapacita']) || 0, uzaverka: cleDen_(s['Uzávěrka']), poplatek: Number(s['Poplatek']) || 0, lektor: String(s['Lektor'] || ''), materialy: String(s['Materiály'] || ''),
    web: ano_(s['Přihlášky z webu']), stav: String(s['Stav'] || 'koncept'), vyhodnotil: String(s['Vyhodnotil'] || ''), vyhodnoceno: skIso_(s['Vyhodnoceno']), poznamka: String(s['Poznámka'] || '') };
}
/** Všechna školení (spojení listů Školení a Akce). */
function skSkoleni_() {
  if (!dataSs_().getSheetByName(LIST_SKOLENI)) return [];
  const akce = {}; radky_('Akce').forEach(a => { if (a['ID']) akce[String(a['ID'])] = a; });
  const druhy = skDruhy_();
  return radky_(LIST_SKOLENI).filter(s => s['Akce – ID'] && akce[String(s['Akce – ID'])]).map(s => skJson_(s, akce[String(s['Akce – ID'])], druhy))
    .sort((a, b) => String(b.od).localeCompare(String(a.od)));
}
function skUcastJson_(r, kontakt) {
  return Object.assign(kontakt ? { email: String(r['E-mail'] || ''), telefon: String(r['Telefon'] || '') } : {}, { web: String(r['Přihlásil'] || '') === 'web', id: String(r['ID']), skoleni: String(r['Akce – ID'] || ''), sbor: String(r['Sbor'] || ''), skupina: String(r['Skupina'] || ''), clen: String(r['Člen – ID'] || ''),
    jmeno: String(r['Jméno'] || ''), prijmeni: String(r['Příjmení'] || ''), narozen: cleDen_(r['Datum narození']), stav: String(r['Stav'] || 'přihlášeno'), kod: String(r['Kód'] || ''),
    poznamka: String(r['Poznámka'] || ''), cislo: String(r['Číslo osvědčení'] || ''), prihlasil: String(r['Přihlásil'] || ''), prihlaseno: skIso_(r['Přihlášeno']), kvalifikace: String(r['Kvalifikace – ID'] || '') });
}
/** kontakt = i e-mail a telefon přihlášek z webu (jen pro okres). */
function skUcastnici_(id, skupina, kontakt) {
  if (!dataSs_().getSheetByName(LIST_UCASTNICI)) return [];
  return radky_(LIST_UCASTNICI).filter(r => r['ID'] && (!id || String(r['Akce – ID']) === id) && (!skupina || String(r['Skupina']) === skupina)).map(r => skUcastJson_(r, kontakt))
    .sort((a, b) => a.sbor.localeCompare(b.sbor, 'cs') || a.prijmeni.localeCompare(b.prijmeni, 'cs') || a.jmeno.localeCompare(b.jmeno, 'cs'));
}
/** Stav platnosti kvalifikace k dnešku: platná / končí (do SKOLENI_UPOZORNIT_DNY – první číslo) / propadlá / bez omezení / ukončená. */
function skPlatnost_(k, dnes, dny) {
  if (!k.aktivni) return 'ukončená';
  if (!k.platiDo) return 'bez omezení';
  const d = new Date(k.platiDo + 'T00:00:00');
  return d < dnes ? 'propadlá' : d - dnes <= dny * 864e5 ? 'končí' : 'platná';
}
function skUpozornitDny_() {
  const t = String(nastaveniWeb_('SKOLENI_UPOZORNIT_DNY') || '90,30');
  return t.split(/[,; ]+/).map(Number).filter(n => n > 0 && n < 1000).sort((a, b) => b - a);
}
function skKvalJson_(r, druhy, dnes, dny) {
  const kod = String(r['Kód'] || ''), dr = druhy.find(d => d.kod === kod);
  const k = { id: String(r['ID']), kod: kod, nazev: dr ? dr.nazev : String(r['Kvalifikace'] || kod), pro: dr ? dr.pro : '', clen: String(r['Člen – ID'] || ''),
    jmeno: String(r['Jméno'] || ''), prijmeni: String(r['Příjmení'] || ''), narozen: cleDen_(r['Datum narození']), sbor: String(r['Sbor'] || ''), skupina: String(r['Skupina'] || ''),
    ziskano: cleDen_(r['Získáno']), platiDo: cleDen_(r['Platí do']), cislo: String(r['Číslo osvědčení'] || ''), zdroj: String(r['Zdroj'] || ''), skoleni: String(r['Akce – ID'] || ''),
    aktivni: String(r['Aktivní'] || 'ANO').toUpperCase() !== 'NE', poznamka: String(r['Poznámka'] || '') };
  k.platnost = skPlatnost_(k, dnes, dny);
  return k;
}
function skKvalifikace_(skupina) {
  if (!dataSs_().getSheetByName(LIST_KVALIFIKACE)) return [];
  const druhy = skDruhy_(), dnes = skDnes_(), dny = skUpozornitDny_()[0] || 90;
  return radky_(LIST_KVALIFIKACE).filter(r => r['ID'] && (!skupina || String(r['Skupina']) === skupina)).map(r => skKvalJson_(r, druhy, dnes, dny))
    .sort((a, b) => a.prijmeni.localeCompare(b.prijmeni, 'cs') || a.jmeno.localeCompare(b.jmeno, 'cs') || String(b.ziskano).localeCompare(String(a.ziskano)));
}

/* ---------- API ---------- */

function apiSkoleni_(req) {
  const o = prihlaseny_(req.token);
  if (!o) return { ok: false, chyba: 'Nepřihlášen', odhlasen: true };
  if (['skoleniOkres', 'skoleni', 'skoleniUlozit', 'skoleniStav', 'skoleniVysledky', 'skoleniPrezence', 'skoleniOdhlasitOkres', 'kvalifikaceOkres', 'kvalifikaceUlozit', 'testSpustit', 'testUkoncit'].indexOf(req.akce) >= 0) {
    if (!smiSkoleni_(o)) return { ok: false, chyba: 'Školení a kvalifikace spravuje role Školení nebo Správce.' };
    if (req.akce === 'skoleniOkres') return skOkres_(o);
    if (req.akce === 'skoleni') return skDetail_(o, String(req.id || ''));
    if (req.akce === 'skoleniUlozit') return skUlozit_(o, req);
    if (req.akce === 'skoleniStav') return skZmenitStav_(o, req);
    if (req.akce === 'skoleniVysledky') return skVysledky_(o, req);
    if (req.akce === 'skoleniPrezence') return skPrezence_(o, String(req.id || ''));
    if (req.akce === 'skoleniOdhlasitOkres') return skOdhlasitOkres_(o, req);
    if (req.akce === 'kvalifikaceOkres') return skKvalOkres_(o);
    if (req.akce === 'testSpustit' || req.akce === 'testUkoncit') return tsSpustit_(o, req, req.akce === 'testUkoncit');
    return skKvalUlozit_(o, req);
  }
  const u = pohledSboru_(o, req.sbor);
  if (!u) return { ok: false, chyba: 'Ke sboru ' + (req.sbor || '(nevybrán)') + ' nemáte přístup.' };
  if (req.akce === 'skoleniSbor') return skSbor_(u);
  if (req.akce === 'skoleniPrihlasit') return skPrihlasit_(o, u, req);
  if (req.akce === 'skoleniOdhlasit') return skOdhlasit_(o, u, req);
  return { ok: false, chyba: 'Neznámá akce' };
}

/* ---------- okres ---------- */

function skOkres_(o) {
  const role = skRole_(o), uc = skUcastnici_(null, null);
  const data = skSkoleni_().filter(s => role === 'všechny' || s.pro === role).map(s => {
    const x = uc.filter(u => u.skoleni === s.id && u.stav !== 'odhlášeno');
    return Object.assign(s, { prihlaseno: x.length, absolvovalo: x.filter(u => u.stav === 'absolvoval').length, sboru: x.map(u => u.skupina).filter((v, i, a) => a.indexOf(v) === i).length });
  });
  return { ok: true, data: data, druhy: skDruhy_(), role: role };
}
function skNajit_(id) {
  const t = skTab_(LIST_SKOLENI), i = t.v.findIndex(r => String(r[t.col('Akce – ID')]) === id);
  return i < 0 ? null : { t: t, r: t.v[i], n: i + 2 };
}
function skAkce_(id) {
  const t = skTab_('Akce'), i = t.v.findIndex(r => String(r[t.col('ID')]) === id);
  return i < 0 ? null : { t: t, r: t.v[i], n: i + 2 };
}
function skNacist_(id) {
  const x = skNajit_(id), a = x && skAkce_(id);
  return x && a ? skJson_(skObj_(x.t.h, x.r), skObj_(a.t.h, a.r), skDruhy_()) : null;
}
function skDetail_(o, id) {
  const s = skNacist_(id);
  if (!s) return { ok: false, chyba: 'Školení nenalezeno.' };
  if (!smiSkoleni_(o, s.pro)) return { ok: false, chyba: 'Školení pro ' + s.pro + ' nespravujete.' };
  const test = tsSkoleni_(s, skNajit_(id)), sou = test.ma ? tsSouhrn_(id) : {};
  return { ok: true, data: s, test: test, ucastnici: skUcastnici_(id, null, true).map(u => test.ma ? Object.assign(u, { test: sou[u.id] || { pokusu: 0 } }) : u) };
}

/** Vypsání / úprava školení: řádek Akce (Typ školení, kalendář) + řádek Školení. */
function skUlozit_(o, req) {
  const d = req.data || {}, id = String(req.id || '');
  const chyba = kontrolaTextu_({ 'Název': d.nazev, 'Místo': d.misto, 'Pořadatel': d.poradatel, 'Popis': d.popis, 'Lektor': d.lektor, 'Poznámka': d.poznamka },
      { 'Název': 200, 'Místo': 200, 'Pořadatel': 100, 'Popis': 5000, 'Lektor': 200, 'Poznámka': 1000 }) ||
    kontrolaVolby_(d.druh, SK_DRUHY, 'Druh') || kontrolaVolby_(d.pro, ['MH', 'dospělí'], 'Pro') || kontrolaVolby_(d.organ, SK_ORGANY, 'Orgán') ||
    kontrolaVolby_(d.proKoho, PRO_KOHO, 'Pro koho') || kontrolaData_(d.od, 'Od') || kontrolaData_(d.do, 'Do') || kontrolaData_(d.uzaverka, 'Uzávěrka') || kontrolaOdkazu_(d.materialy, 'Materiály') ||
    (d.kapacita !== undefined && d.kapacita !== '' && !(Number(d.kapacita) >= 1 && Number(d.kapacita) <= SK_MAX_UCASTNIKU) ? 'Kapacita: 1–' + SK_MAX_UCASTNIKU + ' (prázdné = bez omezení).' : null) ||
    (d.poplatek !== undefined && d.poplatek !== '' && !(Number(d.poplatek) >= 0 && Number(d.poplatek) <= 20000) ? 'Poplatek: 0–20 000 Kč.' : null) ||
    (d.proKoho === 'okrsek' && !(Number(d.okrsek) >= 1 && Number(d.okrsek) <= 30) ? 'Vyberte okrsek.' : null) ||
    (d.web === true && d.proKoho !== undefined && PRO_VEREJNOST.indexOf(d.proKoho || '') < 0 ? 'Přihlášky z webu jdou jen u školení pro veřejnost (na webu ostatní nejsou vidět).' : null);
  if (chyba) return { ok: false, chyba: chyba };
  const pro = d.pro || 'dospělí';
  if (!smiSkoleni_(o, pro)) return { ok: false, chyba: 'Školení pro ' + pro + ' nespravujete.' };
  const druh = d.druh || 'kurz', kody = druh === 'seminář' ? [] : skKody_(d.kvalifikace);
  if (druh !== 'seminář') {
    if (!kody.length) return { ok: false, chyba: druh === 'zkouška' ? 'Vyberte odbornosti, ze kterých se skládá zkouška.' : 'Vyberte kvalifikaci, kterou školení udělí nebo obnoví.' };
    if (kody.length > 1 && druh !== 'zkouška') return { ok: false, chyba: 'Víc kvalifikací najednou jde jen u zkoušky odborností.' };
    if (kody.length > 12) return { ok: false, chyba: 'Nejvýš 12 odborností na jedné zkoušce.' };
    for (let i = 0; i < kody.length; i++) {
      const dr = skDruh_(kody[i]);
      if (!dr) return { ok: false, chyba: 'Kvalifikace ' + kody[i] + ' není v listu Druhy kvalifikací.' };
      if (dr.pro !== pro) return { ok: false, chyba: 'Kvalifikace ' + dr.nazev + ' je pro ' + dr.pro + ', školení pro ' + pro + '.' };
    }
  }
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const ted = new Date(), x = id ? skNajit_(id) : null, a = id ? skAkce_(id) : null;
    if (id && (!x || !a)) return { ok: false, chyba: 'Školení nenalezeno.' };
    if (x) {
      const st = x.r[x.t.col('Stav')];
      if (st === 'vyhodnoceno' || st === 'zrušeno') return { ok: false, chyba: 'Školení je ve stavu „' + st + '“ – už ho nejde upravit.' };
      if (!smiSkoleni_(o, x.r[x.t.col('Pro')] || 'dospělí')) return { ok: false, chyba: 'Toto školení nespravujete.' };
    }
    const stav = x ? String(x.r[x.t.col('Stav')] || 'koncept') : 'koncept';
    // řádek Akce
    const ta = a ? a.t : skTab_('Akce'), ra = a ? a.r : ta.h.map(() => '');
    const seta = (k, v) => { if (ta.col(k) >= 0 && v !== undefined) ra[ta.col(k)] = v; };
    const pred = a ? JSON.stringify([ra[ta.col('Název')], skIso_(ra[ta.col('Od')])]) : '';
    seta('Název', d.nazev !== undefined ? bezVzorce_(String(d.nazev).trim()) : undefined);
    if (d.od) seta('Od', new Date(d.od));
    if (d.do !== undefined) seta('Do', d.do ? new Date(d.do) : '');
    seta('Místo', d.misto !== undefined ? bezVzorce_(String(d.misto).trim()) : undefined);
    seta('Pořadatel', d.poradatel !== undefined ? bezVzorce_(String(d.poradatel).trim()) : undefined);
    seta('Popis', d.popis !== undefined ? bezVzorce_(String(d.popis)) : undefined);
    if (d.proKoho !== undefined) { seta('Pro koho', d.proKoho || 'veřejnost'); seta('Okrsek', d.proKoho === 'okrsek' ? Number(d.okrsek) : ''); }
    if (!a) { seta('Typ', 'školení'); seta('Stav', skAkceStav_(stav)); seta('Vytvořeno', ted); seta('Vytvořil', o.email); if (d.proKoho === undefined) seta('Pro koho', 'veřejnost'); }
    seta('Upraveno', ted); seta('Upravil', o.email);
    if (!String(ra[ta.col('Název')] || '').trim()) return { ok: false, chyba: 'Chybí název školení.' };
    if (!(ra[ta.col('Od')] instanceof Date)) return { ok: false, chyba: 'Chybí datum školení.' };
    if (ra[ta.col('Do')] instanceof Date && ra[ta.col('Do')] < ra[ta.col('Od')]) return { ok: false, chyba: 'Konec je dřív než začátek.' };
    if (d.uzaverka && new Date(d.uzaverka) > ra[ta.col('Od')]) return { ok: false, chyba: 'Uzávěrka přihlášek musí být nejpozději v den školení.' };
    doplnitId_('Akce', ta.h, ra);
    try { syncRadek_(kalendar_(), 'Akce', ta.h, ra); } catch (e) { console.error('Kalendář: ' + e.message); }
    if (a) ta.sh.getRange(a.n, 1, 1, ta.h.length).setValues([ra.map(bezVzorce_)]); else ta.sh.appendRow(ra.map(bezVzorce_));
    const akceId = String(ra[ta.col('ID')]);
    if (!a) zaznamZmeny_(o.email, 'Akce', akceId, 'vytvořeno', '', 'školení');
    else zaznamZmeny_(o.email, 'Akce', akceId, 'upraveno', pred, JSON.stringify([ra[ta.col('Název')], skIso_(ra[ta.col('Od')])]));
    // řádek Školení
    const t = x ? x.t : skTab_(LIST_SKOLENI), r = x ? x.r : t.h.map(() => '');
    const set = (k, v) => { if (t.col(k) >= 0 && v !== undefined) r[t.col(k)] = v; };
    if (x && kody.join(',') !== skKody_(x.r[t.col('Kvalifikace')]).join(',') && skUcastnici_(akceId, null).some(u => u.stav !== 'odhlášeno' && u.kod && kody.indexOf(u.kod) < 0))
      return { ok: false, chyba: 'Někdo z přihlášených skládá odbornost, kterou chcete odebrat. Nejdřív mu ji změňte v detailu školení.' };
    set('Akce – ID', akceId); set('Druh', druh); set('Pro', pro); set('Kvalifikace', kody.join(', '));
    if (d.organ !== undefined) set('Orgán', d.organ || '');
    if (d.kapacita !== undefined) set('Kapacita', d.kapacita === '' || d.kapacita == null ? '' : Number(d.kapacita));
    if (d.uzaverka !== undefined) set('Uzávěrka', d.uzaverka ? new Date(String(d.uzaverka).slice(0, 10) + 'T00:00:00') : '');
    if (d.poplatek !== undefined) set('Poplatek', d.poplatek === '' || d.poplatek == null ? '' : Number(d.poplatek));
    if (d.lektor !== undefined) set('Lektor', bezVzorce_(String(d.lektor).trim()));
    if (d.materialy !== undefined) set('Materiály', String(d.materialy || '').trim());
    if (d.poznamka !== undefined) set('Poznámka', bezVzorce_(String(d.poznamka)));
    if (d.web !== undefined) set('Přihlášky z webu', d.web === true ? 'ANO' : 'NE');
    if (!x) { set('Stav', 'koncept'); set('Vytvořeno', ted); set('Vytvořil', o.email); }
    set('Upraveno', ted); set('Upravil', o.email);
    if (x) t.sh.getRange(x.n, 1, 1, t.h.length).setValues([r]); else t.sh.appendRow(r);
    zaznamZmeny_(o.email, LIST_SKOLENI, akceId, x ? 'upraveno' : 'vytvořeno', '', druh + (d.kvalifikace ? ' · ' + d.kvalifikace : ''));
    vycistitCache_();
    return skDetail_(o, akceId);
  } finally { lock.releaseLock(); }
}

/** Přechody stavu: koncept ↔ přihlášky ↔ uzavřeno; zrušit (e-mail sborům s přihlášenými). Vyhodnocení jen přes skoleniVysledky. */
function skZmenitStav_(o, req) {
  const id = String(req.id || ''), novy = String(req.stav || '');
  const povolene = { 'koncept': ['přihlášky', 'zrušeno'], 'přihlášky': ['koncept', 'uzavřeno', 'zrušeno'], 'uzavřeno': ['přihlášky', 'zrušeno'] };
  let s, uc = [];
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const x = skNajit_(id), a = skAkce_(id);
    if (!x || !a) return { ok: false, chyba: 'Školení nenalezeno.' };
    const c = x.t.col, pred = String(x.r[c('Stav')] || 'koncept');
    if (!smiSkoleni_(o, x.r[c('Pro')] || 'dospělí')) return { ok: false, chyba: 'Toto školení nespravujete.' };
    if ((povolene[pred] || []).indexOf(novy) < 0) return { ok: false, chyba: 'Ze stavu „' + pred + '“ nejde přejít na „' + novy + '“.' };
    uc = skUcastnici_(id, null, true).filter(u => u.stav === 'přihlášeno');
    if (novy === 'koncept' && uc.length) return { ok: false, chyba: 'Na školení jsou přihlášení účastníci – vrátit do konceptu nejde. Uzavřete přihlášky, nebo školení zrušte.' };
    const ted = new Date();
    x.r[c('Stav')] = novy; x.r[c('Upraveno')] = ted; x.r[c('Upravil')] = o.email;
    x.t.sh.getRange(x.n, 1, 1, x.t.h.length).setValues([x.r]);
    const ta = a.t; a.r[ta.col('Stav')] = skAkceStav_(novy); a.r[ta.col('Upraveno')] = ted; a.r[ta.col('Upravil')] = o.email;
    try { syncRadek_(kalendar_(), 'Akce', ta.h, a.r); } catch (e) { console.error('Kalendář: ' + e.message); }
    ta.sh.getRange(a.n, 1, 1, ta.h.length).setValues([a.r]);
    zaznamZmeny_(o.email, LIST_SKOLENI, id, 'upraveno', pred, novy);
    s = skJson_(skObj_(x.t.h, x.r), skObj_(ta.h, a.r), skDruhy_());
  } finally { lock.releaseLock(); }
  vycistitCache_();
  if (novy === 'zrušeno') {
    const pozn = String(req.poznamka || '').trim().slice(0, 500);
    skPoSborech_(uc).forEach(g => skPosta_(g.skupina, 'Školení zrušeno: ' + s.nazev,
      'Okres zrušil školení ' + s.nazev + ' (' + skDatum_(s.od) + ').' + (pozn ? ' Důvod: ' + pozn : '') + ' Přihlášení z vašeho sboru: ' + g.jmena.join(', ') + '.', 'sbor/' + g.skupina + '/skoleni'));
    uc.filter(u => u.web && u.email).forEach(u => { // přihlášky z webu: e-mail přímo účastníkovi
      try { posta_(u.email, 'Školení zrušeno: ' + s.nazev, 'Dobrý den,\n\nokres zrušil školení ' + s.nazev + ' (' + skDatum_(s.od) + '), na které jste byl(a) přihlášen(a).' + (pozn ? ' Důvod: ' + pozn : ''),
        sablona_('Školení zrušeno', 'Okres zrušil školení ' + s.nazev + ' (' + skDatum_(s.od) + '), na které jste byl(a) přihlášen(a).' + (pozn ? ' Důvod: ' + pozn : ''), [], null, 'Automatická zpráva Okresního sdružení hasičů Praha-západ.')); }
      catch (x) { console.error('E-mail o zrušení školení: ' + x.message); }
    });
  }
  return skDetail_(o, id);
}

/**
 * Výsledky účastníků: vysledky = [{ id, stav (přihlášeno / absolvoval / neuspěl / nepřišel), cislo, poznamka }]. Ukládat jde průběžně.
 * dokoncit = vyhodnotit: všichni musí mít výsledek; u „absolvoval“ vznikne kvalifikace (kurz, zkouška), u obnovy se stará ukončí a vznikne nová. E-mail sborům.
 */
function skVysledky_(o, req) {
  const id = String(req.id || ''), vys = Array.isArray(req.vysledky) ? req.vysledky : [], dokoncit = !!req.dokoncit;
  if (vys.length > SK_MAX_UCASTNIKU) return { ok: false, chyba: 'Příliš mnoho řádků.' };
  for (let i = 0; i < vys.length; i++) {
    const v = vys[i] || {};
    const ch = kontrolaVolby_(v.stav, ['přihlášeno', 'absolvoval', 'neuspěl', 'nepřišel'], 'Výsledek') || (v.kod && !/^[\w-]{1,20}$/.test(String(v.kod)) ? 'Neplatná odbornost.' : null) || kontrolaTextu_({ 'Číslo osvědčení': v.cislo, 'Poznámka': v.poznamka }, { 'Číslo osvědčení': 40, 'Poznámka': 300 });
    if (ch) return { ok: false, chyba: ch };
  }
  let s, vysledek = [];
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    s = skNacist_(id);
    if (!s) return { ok: false, chyba: 'Školení nenalezeno.' };
    if (!smiSkoleni_(o, s.pro)) return { ok: false, chyba: 'Toto školení nespravujete.' };
    if (['přihlášky', 'uzavřeno'].indexOf(s.stav) < 0) return { ok: false, chyba: s.stav === 'vyhodnoceno' ? 'Školení je už vyhodnocené.' : 'Výsledky jdou zapsat jen u školení s přihláškami nebo uzavřeného.' };
    if (new Date(s.od) > new Date()) return { ok: false, chyba: 'Školení ještě nezačalo – výsledky jdou zapsat od jeho začátku.' };
    const t = skTab_(LIST_UCASTNICI), c = t.col, ted = new Date();
    const mapa = {}; vys.forEach(v => { mapa[String(v.id || '')] = v; });
    t.v.forEach((r, i) => {
      if (String(r[c('Akce – ID')]) !== id || r[c('Stav')] === 'odhlášeno') return;
      const v = mapa[String(r[c('ID')])]; if (!v) return;
      if (v.kod && s.kody.indexOf(String(v.kod)) >= 0 && c('Kód') >= 0) r[c('Kód')] = String(v.kod);
      r[c('Stav')] = v.stav; if (c('Číslo osvědčení') >= 0) r[c('Číslo osvědčení')] = bezVzorce_(String(v.cislo || '').trim());
      r[c('Poznámka')] = bezVzorce_(String(v.poznamka || '').trim()); r[c('Upraveno')] = ted; r[c('Upravil')] = o.email;
      t.sh.getRange(i + 2, 1, 1, t.h.length).setValues([r]);
    });
    const uc = skUcastnici_(id, null).filter(u => u.stav !== 'odhlášeno');
    if (!dokoncit) return Object.assign(skDetail_(o, id), { ulozeno: true });
    if (uc.some(u => u.stav === 'přihlášeno')) return { ok: false, chyba: 'U všech účastníků vyberte výsledek (absolvoval, neuspěl, nepřišel).' };
    // kvalifikace (u zkoušky ta odbornost, kterou účastník skládal)
    const druhy = s.kody.map(skDruh_), dr = druhy[0] || null, drU = u => (u.kod && druhy.find(d => d && d.kod === u.kod)) || dr;
    if (s.druh !== 'seminář' && druhy.some(d => !d)) return { ok: false, chyba: 'Kvalifikace ' + s.kody.join(', ') + ' už není (celá) v listu Druhy kvalifikací.' };
    const konec = cleDen_(s.do || s.od), kt = dr ? skTab_(LIST_KVALIFIKACE) : null;
    uc.filter(u => u.stav === 'absolvoval' && dr && !u.kvalifikace).forEach(u => {
      const dr = drU(u), kid = skKvalZapsat_(kt, o.email, { kod: dr.kod, nazev: dr.nazev, clen: u.clen, jmeno: u.jmeno, prijmeni: u.prijmeni, narozen: u.narozen, sbor: u.sbor, skupina: u.skupina,
        ziskano: konec, platiDo: skPlatiDo_(konec, dr.platnost), cislo: u.cislo, zdroj: 'školení', skoleni: id, obnova: s.druh === 'obnova' });
      const i = t.v.findIndex(r => String(r[c('ID')]) === u.id);
      if (i >= 0) { t.v[i][c('Kvalifikace – ID')] = kid; t.sh.getRange(i + 2, c('Kvalifikace – ID') + 1).setValue(kid); }
      vysledek.push(u.jmeno + ' ' + u.prijmeni);
    });
    const x = skNajit_(id), xc = x.t.col;
    x.r[xc('Stav')] = 'vyhodnoceno'; x.r[xc('Vyhodnotil')] = o.email; x.r[xc('Vyhodnoceno')] = ted; x.r[xc('Upraveno')] = ted; x.r[xc('Upravil')] = o.email;
    x.t.sh.getRange(x.n, 1, 1, x.t.h.length).setValues([x.r]);
    zaznamZmeny_(o.email, LIST_SKOLENI, id, 'upraveno', s.stav, 'vyhodnoceno – absolvovalo ' + uc.filter(u => u.stav === 'absolvoval').length + ' z ' + uc.length + (dr ? ', kvalifikace ' + dr.kod + ': ' + vysledek.length : ''));
    s.stav = 'vyhodnoceno';
    skPoSborech_(uc).forEach(g => skPosta_(g.skupina, 'Výsledky školení: ' + s.nazev,
      'Okres vyhodnotil školení ' + s.nazev + ' (' + skDatum_(s.od) + '). Váš sbor: ' + g.lide.map(u => u.jmeno + ' ' + u.prijmeni + ' – ' + u.stav).join(', ') + '.' +
      (dr ? ' Kvalifikace absolventů jsou zapsané v portálu → Členové → Školení → Kvalifikace členů' + (dr.platnost ? ' (platí ' + dr.platnost + ' let).' : '.') : ''), 'sbor/' + g.skupina + '/skoleni'));
  } finally { lock.releaseLock(); }
  return Object.assign(skDetail_(o, id), { kvalifikaci: vysledek.length });
}
function skPlatiDo_(od, roky) {
  if (!od || !roky) return '';
  const y = Number(od.slice(0, 4)) + roky;
  return y + od.slice(4);
}
/** Zapíše kvalifikaci (list Kvalifikace). U obnovy ukončí dosavadní aktivní kvalifikaci téhož kódu u téže osoby. Vrací ID. */
function skKvalZapsat_(t, kdo, k) {
  const c = t.col, ted = new Date();
  if (k.obnova) {
    const klic = cleKlicOsoby_(k.jmeno, k.prijmeni, k.narozen);
    t.v.forEach((r, i) => {
      if (String(r[c('Kód')]) !== k.kod || String(r[c('Aktivní')]).toUpperCase() === 'NE') return;
      if (!((k.clen && String(r[c('Člen – ID')]) === k.clen) || cleKlicOsoby_(r[c('Jméno')], r[c('Příjmení')], r[c('Datum narození')]) === klic)) return;
      r[c('Aktivní')] = 'NE'; r[c('Poznámka')] = bezVzorce_((String(r[c('Poznámka')] || '') + ' Obnoveno ' + Utilities.formatDate(ted, 'Europe/Prague', 'd. M. yyyy') + '.').trim());
      r[c('Upraveno')] = ted; r[c('Upravil')] = kdo;
      t.sh.getRange(i + 2, 1, 1, t.h.length).setValues([r]);
    });
  }
  const r = t.h.map(() => ''), set = (key, v) => { if (c(key) >= 0 && v !== undefined) r[c(key)] = v; }, id = k.id || skNoveId_('K');
  set('ID', id); set('Kód', k.kod); set('Kvalifikace', k.nazev); set('Člen – ID', k.clen || ''); set('Jméno', bezVzorce_(k.jmeno)); set('Příjmení', bezVzorce_(k.prijmeni));
  if (k.narozen) set('Datum narození', new Date(k.narozen + 'T00:00:00'));
  set('Sbor', k.sbor || ''); set('Skupina', k.skupina || '');
  if (k.ziskano) set('Získáno', new Date(k.ziskano + 'T00:00:00'));
  if (k.platiDo) set('Platí do', new Date(k.platiDo + 'T00:00:00'));
  set('Číslo osvědčení', bezVzorce_(String(k.cislo || ''))); set('Zdroj', k.zdroj); set('Akce – ID', k.skoleni || ''); set('Aktivní', 'ANO'); set('Poznámka', bezVzorce_(String(k.poznamka || '')));
  set('Vytvořeno', ted); set('Vytvořil', kdo); set('Upraveno', ted); set('Upravil', kdo);
  t.sh.appendRow(r); t.v.push(r);
  zaznamZmeny_(kdo, LIST_KVALIFIKACE, id, 'vytvořeno', '', k.kod + ' · ' + k.zdroj + (k.skoleni ? ' ' + k.skoleni : ''));
  return id;
}

/** Prezenční listina (PDF, neukládá se): přihlášení účastníci podle sborů, sloupec na podpis. */
function skPrezence_(o, id) {
  const det = skDetail_(o, id);
  if (!det.ok) return det;
  const s = det.data, uc = det.ucastnici.filter(u => u.stav !== 'odhlášeno');
  const e = t => String(t == null ? '' : t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const vic = s.kody.length > 1, odb = k => { const x = s.kvalifikaceSeznam.find(y => y.kod === k); return x ? x.nazev.replace(/^Odbornost MH – /, '') : k; };
  const radky = uc.map((u, i) => '<tr><td class="c">' + (i + 1) + '</td><td>' + e(u.prijmeni + ' ' + u.jmeno) + '</td><td>' + e(skDatum_(u.narozen)) + '</td><td>' + e(String(u.sbor).replace(/^SDH\s+/i, '')) + '</td>' + (vic ? '<td>' + e(odb(u.kod)) + '</td>' : '') + '<td class="p"></td></tr>').join('');
  const prazdne = Array.from({ length: Math.max(3, Math.min(10, (s.kapacita || 0) - uc.length)) }, (_, i) => '<tr><td class="c">' + (uc.length + i + 1) + '</td><td></td><td></td><td></td>' + (vic ? '<td></td>' : '') + '<td class="p"></td></tr>').join('');
  const hlavicka = String(nastaveniWeb_('OZ_HLAVICKA') || 'SH ČMS – Okresní sdružení hasičů Praha-západ').split('\\n').map(e).join('<br>');
  const html = '<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;font-size:10.5pt;color:#201e1d;margin:26px 30px;}.hl{font-size:9pt;color:#555;margin-bottom:10px;}' +
    'h1{font-size:17pt;margin:0 0 4px;}.m{font-size:10pt;margin:0 0 12px;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #201e1d;padding:6px 6px;text-align:left;vertical-align:top;}' +
    'th{background:#eee;font-size:9.5pt;}td.c{width:28px;text-align:right;}td.p{width:34%;}.pata{margin-top:16px;font-size:9pt;color:#555;}.pod{margin-top:30px;display:flex;justify-content:space-between;}.pod div{border-top:1px solid #201e1d;width:40%;padding-top:3px;font-size:9pt;}</style></head><body>' +
    '<div class="hl">' + hlavicka + '</div><h1>Prezenční listina – ' + e(s.nazev) + '</h1>' +
    '<div class="m">' + e(skDatum_(s.od) + (s.do && cleDen_(s.do) !== cleDen_(s.od) ? ' – ' + skDatum_(s.do) : '')) + (s.misto ? ' · ' + e(s.misto) : '') + (s.lektor ? ' · lektor ' + e(s.lektor) : '') +
    (s.kvalifikaceNazev && s.druh !== 'seminář' ? '<br>' + e(({ kurz: 'Kurz', obnova: 'Obnova kvalifikace', zkouška: 'Zkouška' })[s.druh] || '') + ': ' + e(s.kvalifikaceNazev) : '') + '</div>' +
    '<table><tr><th>č.</th><th>Příjmení a jméno</th><th>Datum narození</th><th>SDH</th>' + (vic ? '<th>Odbornost</th>' : '') + '<th>Podpis</th></tr>' + radky + prazdne + '</table>' +
    '<div class="pod"><div>Lektor / zkušební komisař</div><div>Za OSH Praha-západ</div></div>' +
    '<div class="pata">Vytvořeno v aplikaci OSH Praha-západ ' + e(skDatum_(new Date().toISOString())) + ' · přihlášeno ' + uc.length + (s.kapacita ? ' z ' + s.kapacita : '') + '. Údaje slouží jen k doložení účasti.</div></body></html>';
  const pdf = Utilities.newBlob(html, 'text/html', 'prezence.html').getAs('application/pdf');
  zaznamZmeny_(o.email, LIST_UCASTNICI, id, 'export', '', 'prezenční listina (' + uc.length + ')');
  return { ok: true, nazev: 'Prezencni listina ' + s.nazev.replace(/[\\/:*?"<>|]/g, '') + '.pdf', data: Utilities.base64Encode(pdf.getBytes()) };
}

function skKvalOkres_(o) {
  const role = skRole_(o), druhy = skDruhy_();
  const pro = k => { const d = druhy.find(x => x.kod === k.kod); return d ? d.pro : 'dospělí'; };
  const sbory = radkyRychle_('Sbory').filter(r => r['Sbor'] && r['Skupina'] && String(r['Aktivní']).trim().toUpperCase() !== 'NE')
    .map(r => ({ sbor: String(r['Sbor']), skupina: String(r['Skupina']).split('@')[0].toLowerCase() })).sort((a, b) => a.sbor.localeCompare(b.sbor, 'cs'));
  return { ok: true, data: skKvalifikace_(null).filter(k => role === 'všechny' || pro(k) === role), druhy: druhy, sbory: sbory, upozornit: skUpozornitDny_() };
}
/**
 * Ruční zápis kvalifikace (kurz u kraje nebo ústředí, starší osvědčení) nebo úprava / ukončení existující.
 * data = { kod, jmeno, prijmeni, narozen, skupina, ziskano, platiDo (prázdné = podle Platnosti), cislo, poznamka, aktivni }.
 * Osobu páruje se Seznamem členů podle jména a data narození ve sboru (Člen – ID).
 */
function skKvalUlozit_(o, req) {
  const d = req.data || {}, id = String(req.id || '');
  const ch = kontrolaTextu_({ 'Jméno': d.jmeno, 'Příjmení': d.prijmeni, 'Číslo osvědčení': d.cislo, 'Poznámka': d.poznamka }, { 'Jméno': 60, 'Příjmení': 60, 'Číslo osvědčení': 40, 'Poznámka': 500 }) ||
    kontrolaData_(d.ziskano, 'Získáno') || kontrolaData_(d.platiDo, 'Platí do') ||
    (d.narozen && !/^\d{4}-\d{2}-\d{2}$/.test(String(d.narozen)) ? 'Datum narození má tvar RRRR-MM-DD.' : null);
  if (ch) return { ok: false, chyba: ch };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const t = skTab_(LIST_KVALIFIKACE), c = t.col, ted = new Date();
    if (id) { // úprava: číslo osvědčení, platí do, poznámka, ukončení / obnovení
      const i = t.v.findIndex(r => String(r[c('ID')]) === id);
      if (i < 0) return { ok: false, chyba: 'Kvalifikace nenalezena.' };
      const r = t.v[i], dr = skDruh_(r[c('Kód')]);
      if (!smiSkoleni_(o, dr ? dr.pro : 'dospělí')) return { ok: false, chyba: 'Tuto kvalifikaci nespravujete.' };
      const pred = JSON.stringify([cleDen_(r[c('Platí do')]), r[c('Aktivní')]]);
      if (d.cislo !== undefined) r[c('Číslo osvědčení')] = bezVzorce_(String(d.cislo).trim());
      if (d.ziskano) r[c('Získáno')] = new Date(String(d.ziskano).slice(0, 10) + 'T00:00:00');
      if (d.platiDo !== undefined) r[c('Platí do')] = d.platiDo ? new Date(String(d.platiDo).slice(0, 10) + 'T00:00:00') : '';
      if (d.poznamka !== undefined) r[c('Poznámka')] = bezVzorce_(String(d.poznamka).trim());
      if (d.aktivni !== undefined) r[c('Aktivní')] = d.aktivni ? 'ANO' : 'NE';
      if (c('Upozorněno') >= 0 && d.platiDo !== undefined) r[c('Upozorněno')] = ''; // nové datum → upozornit znovu
      r[c('Upraveno')] = ted; r[c('Upravil')] = o.email;
      t.sh.getRange(i + 2, 1, 1, t.h.length).setValues([r]);
      zaznamZmeny_(o.email, LIST_KVALIFIKACE, id, 'upraveno', pred, JSON.stringify([cleDen_(r[c('Platí do')]), r[c('Aktivní')]]));
      return skKvalOkres_(o);
    }
    const dr = skDruh_(d.kod);
    if (!dr) return { ok: false, chyba: 'Vyberte druh kvalifikace.' };
    if (!smiSkoleni_(o, dr.pro)) return { ok: false, chyba: 'Kvalifikace pro ' + dr.pro + ' nespravujete.' };
    const jmeno = String(d.jmeno || '').trim(), prijmeni = String(d.prijmeni || '').trim(), narozen = String(d.narozen || '').trim(), ziskano = String(d.ziskano || '').slice(0, 10);
    if (!jmeno || !prijmeni) return { ok: false, chyba: 'Vyplňte jméno a příjmení.' };
    if (!narozen) return { ok: false, chyba: 'Vyplňte datum narození (rozliší osoby se stejným jménem).' };
    if (!ziskano) return { ok: false, chyba: 'Vyplňte, kdy kvalifikaci získal(a).' };
    const sk = String(d.skupina || '').split('@')[0].toLowerCase(), sbory = cleSboryPodleSkupiny_();
    if (sk && !sbory[sk]) return { ok: false, chyba: 'Sbor nenalezen.' };
    let clen = '';
    try { const klic = cleKlicOsoby_(jmeno, prijmeni, narozen), m = cleClenove_(sk || null).find(x => x.aktivni && cleKlicOsoby_(x.jmeno, x.prijmeni, x.narozen) === klic); if (m) clen = m.id; } catch (e) {}
    if (t.v.some(r => String(r[c('Kód')]) === dr.kod && String(r[c('Aktivní')]).toUpperCase() !== 'NE' && cleKlicOsoby_(r[c('Jméno')], r[c('Příjmení')], r[c('Datum narození')]) === cleKlicOsoby_(jmeno, prijmeni, narozen) && cleDen_(r[c('Získáno')]) === ziskano))
      return { ok: false, chyba: 'Tuto kvalifikaci už má zapsanou se stejným datem.' };
    skKvalZapsat_(t, o.email, { kod: dr.kod, nazev: dr.nazev, clen: clen, jmeno: jmeno, prijmeni: prijmeni, narozen: narozen, sbor: sk ? sbory[sk] : '', skupina: sk,
      ziskano: ziskano, platiDo: d.platiDo ? String(d.platiDo).slice(0, 10) : skPlatiDo_(ziskano, dr.platnost), cislo: d.cislo, zdroj: 'ručně', poznamka: d.poznamka, obnova: !!d.obnova });
    return Object.assign(skKvalOkres_(o), { sparovano: !!clen });
  } finally { lock.releaseLock(); }
}

/* ---------- sbor ---------- */

/** Školení, která sbor vidí (Pro koho), od stavu přihlášky; k tomu všechna, kam má účastníky. Naši účastníci a kvalifikace našich členů. */
function skSbor_(u) {
  const sk = u.sbor.skupina, uc = skUcastnici_(null, sk), maNase = {}; uc.forEach(x => { maNase[x.skoleni] = true; });
  const vsechny = skUcastnici_(null, null), obsazeno = {}; vsechny.forEach(x => { if (x.stav !== 'odhlášeno') obsazeno[x.skoleni] = (obsazeno[x.skoleni] || 0) + 1; });
  const dnes = skDnes_();
  const data = skSkoleni_().filter(s => maNase[s.id] || (['přihlášky', 'uzavřeno', 'vyhodnoceno'].indexOf(s.stav) >= 0 && smiVidet_(u, { 'Pro koho': s.proKoho, 'Okrsek': s.okrsek })))
    .filter(s => maNase[s.id] || s.stav !== 'vyhodnoceno') // cizí proběhlá školení sbor nepotřebuje
    .map(s => Object.assign(s, { obsazeno: obsazeno[s.id] || 0, lzePrihlasit: s.stav === 'přihlášky' && (!s.uzaverka || new Date(s.uzaverka + 'T00:00:00') >= dnes) && new Date(s.od) > new Date() && (!s.kapacita || (obsazeno[s.id] || 0) < s.kapacita) }));
  return { ok: true, skupina: sk, data: data, ucastnici: uc, kvalifikace: skKvalifikace_(sk), druhy: skDruhy_().filter(d => d.aktivni), upozornit: skUpozornitDny_() };
}
/** Kdo smí na školení podle Pro: MH = mladí hasiči a dorost, dospělí = od 15 let (instruktor mládeže může být dorostenec). */
function skVhodny_(s, narozen) {
  const kat = cleKategorie_(narozen, new Date(s.od));
  if (!kat) return 'chybí datum narození';
  if (s.pro === 'MH' && kat === 'dospělý') return 'školení je pro mladé hasiče a dorost';
  if (s.pro === 'dospělí' && kat === 'mladý hasič') return 'školení je pro dospělé a dorost od 15 let';
  if (s.minVek && s.minVek < 99) { // nejnižší věk kvalifikace (Druhy kvalifikací, Min. věk) v den začátku školení
    const n = cleDen_(narozen), od = cleDen_(s.od), vek = Number(od.slice(0, 4)) - Number(n.slice(0, 4)) - (od.slice(5) < n.slice(5) ? 1 : 0);
    if (vek < s.minVek) return 'kvalifikace je od ' + s.minVek + ' let';
  }
  return '';
}
/** Přihlášení členů: data = { id, clenove: [ID ze Seznamu členů], rucne: [{ jmeno, prijmeni, narozen }] }. */
function skPrihlasit_(o, u, req) {
  const d = req.data || {}, id = String(d.id || req.id || ''), sk = u.sbor.skupina;
  const ids = (Array.isArray(d.clenove) ? d.clenove : []).map(String).filter(Boolean), rucne = Array.isArray(d.rucne) ? d.rucne : [], kodyCl = d.kody || {}; // kody = { ID člena: odbornost } u zkoušky
  if (!ids.length && !rucne.length) return { ok: false, chyba: 'Vyberte aspoň jednoho člena.' };
  if (ids.length + rucne.length > 30) return { ok: false, chyba: 'Najednou nejvýš 30 lidí.' };
  for (let i = 0; i < rucne.length; i++) {
    const x = rucne[i] || {};
    const ch = kontrolaTextu_({ 'Jméno': x.jmeno, 'Příjmení': x.prijmeni }, { 'Jméno': 60, 'Příjmení': 60 });
    if (ch) return { ok: false, chyba: ch };
    if (!String(x.jmeno || '').trim() || !String(x.prijmeni || '').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(x.narozen || ''))) return { ok: false, chyba: 'U člena mimo seznam vyplňte jméno, příjmení a datum narození.' };
  }
  if (limit_('skoleni-prihlaska', o.email, 60, 3600)) return { ok: false, chyba: 'Příliš mnoho přihlášek za hodinu. Zkuste to později.' };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const s = skNacist_(id);
    if (!s || !(s.stav !== 'koncept' && smiVidet_(u, { 'Pro koho': s.proKoho, 'Okrsek': s.okrsek }))) return { ok: false, chyba: 'Školení nenalezeno.' };
    if (s.stav !== 'přihlášky') return { ok: false, chyba: 'Přihlášky na toto školení nejsou otevřené.' };
    if (s.uzaverka && new Date(s.uzaverka + 'T00:00:00') < skDnes_()) return { ok: false, chyba: 'Uzávěrka přihlášek byla ' + skDatum_(s.uzaverka) + '.' };
    if (new Date(s.od) <= new Date()) return { ok: false, chyba: 'Školení už začalo.' };
    const t = skTab_(LIST_UCASTNICI), c = t.col, ted = new Date();
    const zde = t.v.filter(r => String(r[c('Akce – ID')]) === id && r[c('Stav')] !== 'odhlášeno');
    const clenove = cleClenove_(sk), lide = [];
    for (let i = 0; i < ids.length; i++) {
      const m = clenove.find(x => x.id === ids[i] && x.aktivni);
      if (!m) return { ok: false, chyba: 'Člen nenalezen v seznamu vašeho sboru.' };
      lide.push({ clen: m.id, jmeno: m.jmeno, prijmeni: m.prijmeni, narozen: m.narozen, kod: String(kodyCl[m.id] || '') });
    }
    rucne.forEach(x => lide.push({ clen: '', jmeno: String(x.jmeno).trim(), prijmeni: String(x.prijmeni).trim(), narozen: String(x.narozen), kod: String(x.kod || '') }));
    for (let i = 0; i < lide.length; i++) { // odbornost: u zkoušky s víc odbornostmi povinná volba, jinak jediná
      if (!lide[i].kod) lide[i].kod = s.kody.length === 1 ? s.kody[0] : '';
      if (s.kody.length > 1 && s.kody.indexOf(lide[i].kod) < 0) return { ok: false, chyba: lide[i].jmeno + ' ' + lide[i].prijmeni + ': vyberte odbornost, kterou bude skládat.' };
    }
    for (let i = 0; i < lide.length; i++) {
      const l = lide[i], duvod = skVhodny_(s, l.narozen);
      if (duvod) return { ok: false, chyba: l.jmeno + ' ' + l.prijmeni + ': ' + duvod + '.' };
      const klic = cleKlicOsoby_(l.jmeno, l.prijmeni, l.narozen);
      if (zde.some(r => (l.clen && String(r[c('Člen – ID')]) === l.clen) || cleKlicOsoby_(r[c('Jméno')], r[c('Příjmení')], r[c('Datum narození')]) === klic))
        return { ok: false, chyba: l.jmeno + ' ' + l.prijmeni + ' už je na školení přihlášen(a).' };
      if (lide.slice(0, i).some(x => cleKlicOsoby_(x.jmeno, x.prijmeni, x.narozen) === klic)) return { ok: false, chyba: l.jmeno + ' ' + l.prijmeni + ' je ve výběru dvakrát.' };
    }
    if (s.kapacita && zde.length + lide.length > s.kapacita) return { ok: false, chyba: 'Volných míst: ' + Math.max(0, s.kapacita - zde.length) + '. Vyberte méně lidí, nebo se domluvte s okresem.' };
    const nove = lide.map((l, i) => {
      const r = t.h.map(() => ''), set = (k, v) => { if (c(k) >= 0) r[c(k)] = v; };
      set('ID', skNoveId_('U') + i); set('Akce – ID', id); set('Sbor', u.sbor.sbor); set('Skupina', sk); set('Člen – ID', l.clen);
      set('Jméno', bezVzorce_(l.jmeno)); set('Příjmení', bezVzorce_(l.prijmeni)); set('Datum narození', new Date(l.narozen + 'T00:00:00'));
      set('Stav', 'přihlášeno'); set('Kód', l.kod); set('Poznámka', l.clen ? '' : 'není v seznamu členů'); set('Přihlásil', o.email); set('Přihlášeno', ted);
      set('Vytvořeno', ted); set('Vytvořil', o.email); set('Upraveno', ted); set('Upravil', o.email);
      return r;
    });
    t.sh.getRange(t.sh.getLastRow() + 1, 1, nove.length, t.h.length).setValues(nove);
    zaznamZmeny_(o.email, LIST_UCASTNICI, id, 'vytvořeno', '', u.sbor.sbor + ': ' + nove.length + (rucne.length ? ' (mimo seznam ' + rucne.length + ')' : ''));
  } finally { lock.releaseLock(); }
  return skSbor_(u);
}
/** Odhlášení účastníka sborem – dokud je školení v přihláškách nebo uzavřené a nezačalo. */
function skOdhlasit_(o, u, req) {
  const uid = String((req.data || {}).ucastnik || req.ucastnik || ''), sk = u.sbor.skupina;
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const t = skTab_(LIST_UCASTNICI), c = t.col, i = t.v.findIndex(r => String(r[c('ID')]) === uid && String(r[c('Skupina')]) === sk);
    if (i < 0) return { ok: false, chyba: 'Přihláška nenalezena.' };
    const r = t.v[i];
    if (r[c('Stav')] !== 'přihlášeno') return { ok: false, chyba: 'Přihláška je už vyřízená (' + r[c('Stav')] + ').' };
    const s = skNacist_(String(r[c('Akce – ID')]));
    if (s && (['přihlášky', 'uzavřeno'].indexOf(s.stav) < 0 || new Date(s.od) <= new Date())) return { ok: false, chyba: 'Školení už začalo nebo je vyřízené – odhlášení jen přes okres.' };
    r[c('Stav')] = 'odhlášeno'; r[c('Upraveno')] = new Date(); r[c('Upravil')] = o.email;
    t.sh.getRange(i + 2, 1, 1, t.h.length).setValues([r]);
    zaznamZmeny_(o.email, LIST_UCASTNICI, uid, 'upraveno', 'přihlášeno', 'odhlášeno');
    if (s && s.stav === 'uzavřeno') skPosta_('', 'Odhlášení ze školení: ' + s.nazev, u.sbor.sbor + ' odhlásil ' + r[c('Jméno')] + ' ' + r[c('Příjmení')] + ' ze školení ' + s.nazev + ' (přihlášky už byly uzavřené).', 'okres/skoleni/' + s.id, s.pro);
  } finally { lock.releaseLock(); }
  return skSbor_(u);
}

/** Okres odhlásí účastníka (hlavně přihlášky z webu – člověk napíše kanceláři), dokud školení není vyhodnocené. Sbor dostane e-mail. */
function skOdhlasitOkres_(o, req) {
  const uid = String(req.ucastnik || '');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  let s, r, c;
  try {
    const t = skTab_(LIST_UCASTNICI); c = t.col;
    const i = t.v.findIndex(x => String(x[c('ID')]) === uid);
    if (i < 0) return { ok: false, chyba: 'Účastník nenalezen.' };
    r = t.v[i]; s = skNacist_(String(r[c('Akce – ID')]));
    if (!s || !smiSkoleni_(o, s.pro)) return { ok: false, chyba: 'Toto školení nespravujete.' };
    if (['přihlášky', 'uzavřeno'].indexOf(s.stav) < 0) return { ok: false, chyba: 'Školení je ve stavu „' + s.stav + '“ – odhlásit už nejde.' };
    if (r[c('Stav')] !== 'přihlášeno') return { ok: false, chyba: 'Účastník má už výsledek (' + r[c('Stav')] + ').' };
    r[c('Stav')] = 'odhlášeno'; r[c('Upraveno')] = new Date(); r[c('Upravil')] = o.email;
    t.sh.getRange(i + 2, 1, 1, t.h.length).setValues([r]);
    zaznamZmeny_(o.email, LIST_UCASTNICI, uid, 'upraveno', 'přihlášeno', 'odhlášeno okresem');
  } finally { lock.releaseLock(); }
  if (r[c('Skupina')]) skPosta_(String(r[c('Skupina')]), 'Odhlášení ze školení: ' + s.nazev, 'Okres odhlásil ' + r[c('Jméno')] + ' ' + r[c('Příjmení')] + ' ze školení ' + s.nazev + ' (' + skDatum_(s.od) + ').', 'sbor/' + r[c('Skupina')] + '/skoleni');
  return skDetail_(o, s.id);
}

/**
 * Veřejná přihláška z webu (bez přihlášení, Turnstile „skoleni“ + limity): jen školení pro veřejnost s Přihlášky z webu = ANO a otevřenými přihláškami.
 * data = { id, jmeno, prijmeni, narozen, sbor (slug sboru z okresu nebo ''), sborJiny (text – jiný okres / nejsem člen), email, telefon, kod (odbornost u zkoušky), souhlas }.
 */
function skPrihlaskaWeb_(req) {
  try {
    const ts = overitTurnstile_(req.turnstile, 'skoleni');
    if (ts) return { ok: false, chyba: ts };
    const v = req.data || {}, t = k => String(v[k] == null ? '' : v[k]).trim();
    const d = { id: t('id'), jmeno: t('jmeno'), prijmeni: t('prijmeni'), narozen: t('narozen'), jiny: t('sborJiny'), email: normEmail_(t('email')), telefon: t('telefon'), kod: t('kod') };
    const ch = kontrolaTextu_({ 'Jméno': d.jmeno, 'Příjmení': d.prijmeni, 'Sbor': d.jiny }, { 'Jméno': 60, 'Příjmení': 60, 'Sbor': 120 });
    if (ch) return { ok: false, chyba: ch };
    if (!d.jmeno || !d.prijmeni) return { ok: false, chyba: 'Vyplňte jméno a příjmení.' };
    const dn = new Date(d.narozen + 'T00:00:00');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.narozen) || isNaN(dn) || dn.getFullYear() < 1900 || dn > new Date()) return { ok: false, chyba: 'Vyplňte datum narození.' };
    if (!d.email || d.email.length > 254 || !/^[^@\s<>"']+@[^@\s<>"']+\.[^@\s<>"']+$/.test(d.email)) return { ok: false, chyba: 'Vyplňte platný e-mail – pošleme na něj potvrzení přihlášky.' };
    if (d.telefon && !/^\+?[\d ()-]{9,20}$/.test(d.telefon)) return { ok: false, chyba: 'Vyplňte platný telefon (nebo nechte prázdné).' };
    if (v.souhlas !== true) return { ok: false, chyba: 'Potvrďte souhlas se zpracováním osobních údajů.' };
    const sb = t('sbor') ? prhSbor_(t('sbor')) : null;
    if (t('sbor') && !sb) return { ok: false, chyba: 'Sbor nenalezen – vyberte ho ze seznamu.' };
    if (!sb && !d.jiny) return { ok: false, chyba: 'Vyberte svůj sbor, nebo napište, odkud jste (sbor z jiného okresu, nejsem členem SH ČMS…).' };
    if (limit_('skoleni-web', 'web', SK_LIMIT_WEB, 600)) return { ok: false, chyba: 'Služba je teď přetížená. Zkuste to za 10 minut.' };
    if (limit_('skoleni-email', d.email, SK_LIMIT_EMAIL, 3600)) return { ok: false, chyba: 'Z tohoto e-mailu už přišlo několik přihlášek. Zkuste to za hodinu.' };
    let s;
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      s = skNacist_(d.id);
      if (!s || !s.web || PRO_VEREJNOST.indexOf(s.proKoho) < 0 || s.stav === 'koncept') return { ok: false, chyba: 'Na toto školení se z webu přihlásit nejde.' };
      if (s.stav !== 'přihlášky') return { ok: false, chyba: 'Přihlášky na toto školení jsou uzavřené.' };
      if (s.uzaverka && new Date(s.uzaverka + 'T00:00:00') < skDnes_()) return { ok: false, chyba: 'Uzávěrka přihlášek byla ' + skDatum_(s.uzaverka) + '.' };
      if (new Date(s.od) <= new Date()) return { ok: false, chyba: 'Školení už začalo.' };
      if (!d.kod) d.kod = s.kody.length === 1 ? s.kody[0] : '';
      if (s.kody.length > 1 && s.kody.indexOf(d.kod) < 0) return { ok: false, chyba: 'Vyberte odbornost, kterou budete skládat.' };
      const duvod = skVhodny_(s, d.narozen);
      if (duvod) return { ok: false, chyba: 'Na toto školení se přihlásit nejde: ' + duvod + '.' };
      const tu = skTab_(LIST_UCASTNICI), c = tu.col, ted = new Date();
      if (c('E-mail') < 0) return { ok: false, chyba: 'Přihlášky z webu se teď nastavují – zkuste to prosím později.' };
      const zde = tu.v.filter(r => String(r[c('Akce – ID')]) === d.id && r[c('Stav')] !== 'odhlášeno');
      if (zde.some(r => cleKlicOsoby_(r[c('Jméno')], r[c('Příjmení')], r[c('Datum narození')]) === cleKlicOsoby_(d.jmeno, d.prijmeni, d.narozen))) return { ok: false, chyba: 'Na toto školení už jste přihlášen(a).' };
      if (s.kapacita && zde.length >= s.kapacita) return { ok: false, chyba: 'Školení je obsazené.' };
      const r = tu.h.map(() => ''), set = (k, x) => { if (c(k) >= 0) r[c(k)] = x; };
      set('ID', skNoveId_('U')); set('Akce – ID', d.id); set('Sbor', bezVzorce_(sb ? sb.sbor : d.jiny)); set('Skupina', sb ? sb.skupina : '');
      set('Jméno', bezVzorce_(d.jmeno)); set('Příjmení', bezVzorce_(d.prijmeni)); set('Datum narození', dn); set('Stav', 'přihlášeno'); set('Kód', d.kod);
      set('Poznámka', 'přihláška z webu'); set('Přihlásil', 'web'); set('Přihlášeno', ted); set('E-mail', d.email); set('Telefon', bezVzorce_(d.telefon));
      set('Vytvořeno', ted); set('Vytvořil', 'web'); set('Upraveno', ted); set('Upravil', 'web');
      tu.sh.appendRow(r);
      zaznamZmeny_('web (' + d.email + ')', LIST_UCASTNICI, d.id, 'vytvořeno', '', 'přihláška z webu: ' + (sb ? sb.sbor : d.jiny));
    } finally { lock.releaseLock(); }
    const jm = d.jmeno + ' ' + d.prijmeni, kdy = skDatum_(s.od) + (s.misto ? ', ' + s.misto : '');
    const pol = [['Školení', s.nazev], ['Kdy a kde', kdy], ['Účastník', jm + ', nar. ' + skDatum_(d.narozen)], ['Sbor', sb ? sb.sbor : d.jiny], ['Poplatek', s.poplatek ? s.poplatek + ' Kč' : ''], ['Lektor', s.lektor]];
    try { posta_(d.email, 'Přihláška na školení: ' + s.nazev, 'Dobrý den,\n\npřihláška na školení ' + s.nazev + ' (' + kdy + ') je zapsaná. Podrobnosti a změny vám pošleme na tento e-mail.\n\nKdyž nemůžete přijít, odpovězte na tento e-mail – odhlásíme vás.',
      sablona_('Přihláška na školení přijata', 'Dobrý den, přihláška je zapsaná. Podrobnosti a případné změny pošleme na tento e-mail. Když nemůžete přijít, odpovězte na tento e-mail – odhlásíme vás.', pol, null,
        'Automatická zpráva Okresního sdružení hasičů Praha-západ. Odpověď přijde kanceláři okresu.')); } catch (x) { console.error('E-mail přihlášenému na školení: ' + x.message); }
    skPosta_('', 'Přihláška z webu: ' + s.nazev, jm + ' (' + (sb ? sb.sbor : d.jiny) + ') se přihlásil(a) z webu na školení ' + s.nazev + ' (' + skDatum_(s.od) + '). Kontakt je v detailu školení.', 'okres/skoleni/' + s.id, s.pro);
    if (sb && sb.skupina) skPosta_(sb.skupina, 'Přihláška na školení za váš sbor', jm + ' se přihlásil(a) z webu na školení ' + s.nazev + ' (' + kdy + ') jako člen vašeho sboru. Vidíte ho v portálu → Členové → Školení. Pokud ho neznáte, dejte vědět okresu.', 'sbor/' + sb.skupina + '/skoleni');
    return { ok: true, nazev: s.nazev };
  } catch (e) { console.error('Školení z webu: ' + e.message + '\n' + e.stack); return { ok: false, chyba: 'Přihlášku se nepodařilo uložit. Zkuste to prosím znovu.' + (ostryRezim_() ? '' : ' (TEST: ' + String(e.message).slice(0, 200) + ')') }; }
}

/* ---------- web, pošta, údržba ---------- */

/** Pro web (?co=web): vypsaná školení pro veřejnost (od dneška) a katalog kvalifikací s materiály. Bez jmen účastníků. */
function skoleniVerejne_() {
  if (!dataSs_().getSheetByName(LIST_SKOLENI)) return { skoleni: [], druhy: [] };
  const uc = skUcastnici_(null, null), obs = {}; uc.forEach(x => { if (x.stav !== 'odhlášeno') obs[x.skoleni] = (obs[x.skoleni] || 0) + 1; });
  const vcera = new Date(Date.now() - 864e5).toISOString();
  const skoleni = skSkoleni_().filter(s => ['přihlášky', 'uzavřeno'].indexOf(s.stav) >= 0 && PRO_VEREJNOST.indexOf(s.proKoho) >= 0 && String(s.do || s.od) >= vcera)
    .map(s => ({ id: s.id, nazev: s.nazev, od: s.od, do: s.do, misto: s.misto, popis: s.popis, druh: s.druh, kvalifikace: s.druh === 'seminář' ? '' : s.kvalifikaceNazev, pro: s.pro, organ: s.organ,
      uzaverka: s.uzaverka, kapacita: s.kapacita, volno: s.kapacita ? Math.max(0, s.kapacita - (obs[s.id] || 0)) : null, poplatek: s.poplatek, lektor: s.lektor, materialy: s.materialy, stav: s.stav,
      web: s.web, odbornosti: s.druh === 'zkouška' && s.kody.length > 1 ? s.kvalifikaceSeznam : [] }))
    .sort((a, b) => String(a.od).localeCompare(String(b.od)));
  const druhy = skDruhy_().filter(d => d.aktivni).map(d => ({ kod: d.kod, nazev: d.nazev, oblast: d.oblast, pro: d.pro, platnost: d.platnost, organ: d.organ, materialy: d.materialy }));
  return { skoleni: skoleni, druhy: druhy };
}

function skDatum_(v) { const d = cleDen_(v); return d ? Number(d.slice(8)) + '. ' + Number(d.slice(5, 7)) + '. ' + d.slice(0, 4) : ''; }
function skPoSborech_(uc) {
  const m = {}; uc.forEach(u => { if (!u.skupina) return; (m[u.skupina] = m[u.skupina] || { skupina: u.skupina, jmena: [], lide: [] }); m[u.skupina].jmena.push(u.jmeno + ' ' + u.prijmeni); m[u.skupina].lide.push(u); });
  return Object.keys(m).map(k => m[k]);
}
/** E-mail sboru (skupina) nebo okresu (skupina '' = role Školení pro dané Pro + Správci). V TESTu jen na TEST_EMAIL (posta_). */
function skPosta_(skupina, predmet, text, cesta, pro) {
  const url = (nastaveniWeb_('WEB_URL') || '') + '/Aplikace%20OSH.dc.html#' + cesta;
  const komu = skupina ? [skupina + '@' + (nastaveniWeb_('DOMENA') || 'oshpz.cz')]
    : radky_('Uživatelé').filter(u => ano_(u['Aktivní']) && (ano_(u['Správce']) || (String(u['Školení'] || '').trim() && String(u['Školení']).toUpperCase() !== 'NE' &&
      (!pro || ano_(u['Školení']) || ['všechny', pro].indexOf(String(u['Školení']).trim()) >= 0)))).map(u => normEmail_(u['E-mail']));
  const html = sablona_(predmet, text, [], ['Otevřít v aplikaci', url], 'Automatická zpráva aplikace OSH Praha-západ.');
  komu.filter(Boolean).forEach(e => { try { posta_(e, predmet, text + '\n\n' + url, html); } catch (x) { console.error('E-mail ke školení: ' + x.message); } });
}

/**
 * Noční údržba (nocniUdrzba): 1) sborům e-mail o kvalifikacích, kterým za SKOLENI_UPOZORNIT_DNY dní končí platnost (každý práh jednou – sloupec Upozorněno),
 * 2) výmaz účastníků školení po SKOLENI_VYMAZ_UCASTNICI_DNY od konání, 3) výmaz ukončených a propadlých kvalifikací po SKOLENI_VYMAZ_KVALIFIKACE_DNY.
 */
function skUdrzba_() {
  if (!dataSs_().getSheetByName(LIST_KVALIFIKACE)) return;
  const dnes = skDnes_(), prahy = skUpozornitDny_(), t = skTab_(LIST_KVALIFIKACE), c = t.col, druhy = skDruhy_(), sbory = {};
  t.v.forEach((r, i) => {
    if (!r[c('ID')] || String(r[c('Aktivní')]).toUpperCase() === 'NE' || !(r[c('Platí do')] instanceof Date) || !r[c('Skupina')]) return;
    const zbyva = Math.round((r[c('Platí do')] - dnes) / 864e5); if (zbyva < 0) return;
    const hotove = String(r[c('Upozorněno')] || '').split(',').map(Number), prah = prahy.filter(p => zbyva <= p && hotove.indexOf(p) < 0).pop();
    if (prah == null) return;
    const sk = String(r[c('Skupina')]), dr = druhy.find(d => d.kod === String(r[c('Kód')]));
    (sbory[sk] = sbory[sk] || []).push(r[c('Jméno')] + ' ' + r[c('Příjmení')] + ' – ' + (dr ? dr.nazev : r[c('Kód')]) + ', platí do ' + skDatum_(r[c('Platí do')]));
    r[c('Upozorněno')] = prahy.filter(p => zbyva <= p).join(','); // nižší prahy, které už taky nastaly, se znovu neposílají
    t.sh.getRange(i + 2, c('Upozorněno') + 1).setValue(r[c('Upozorněno')]);
  });
  Object.keys(sbory).forEach(sk => skPosta_(sk, 'Končí platnost kvalifikace', 'Členům vašeho sboru brzy končí platnost kvalifikace: ' + sbory[sk].join('; ') +
    '. Obnovu nabízí vypsaná školení (portál → Členové → Školení). Když už kvalifikaci obnovili jinde, pošlete okresu osvědčení.', 'sbor/' + sk + '/skoleni'));
  // výmaz po lhůtách
  const dnyU = Number(nastaveniWeb_('SKOLENI_VYMAZ_UCASTNICI_DNY') || 0), dnyK = Number(nastaveniWeb_('SKOLENI_VYMAZ_KVALIFIKACE_DNY') || 0);
  let nU = 0, nK = 0;
  if (dnyK > 0) for (let i = t.v.length - 1; i >= 0; i--) {
    const r = t.v[i], konec = String(r[c('Aktivní')]).toUpperCase() === 'NE' ? r[c('Upraveno')] : r[c('Platí do')];
    if (r[c('ID')] && konec instanceof Date && dnes - konec > dnyK * 864e5) { t.sh.deleteRow(i + 2); nK++; }
  }
  if (dnyU > 0 && dataSs_().getSheetByName(LIST_UCASTNICI)) {
    const konani = {}; skSkoleni_().forEach(s => { konani[s.id] = new Date(s.do || s.od); });
    const tu = skTab_(LIST_UCASTNICI), cu = tu.col;
    for (let i = tu.v.length - 1; i >= 0; i--) { const k = konani[String(tu.v[i][cu('Akce – ID')])]; if (tu.v[i][cu('ID')] && (!k || dnes - k > dnyU * 864e5)) { tu.sh.deleteRow(i + 2); nU++; } }
    if (dataSs_().getSheetByName(LIST_POKUSY)) { // pokusy testů mažou se s účastníky
      const tp = skTab_(LIST_POKUSY), cp = tp.col;
      for (let i = tp.v.length - 1; i >= 0; i--) { const k = konani[String(tp.v[i][cp('Akce – ID')])]; if (tp.v[i][cp('ID')] && (!k || dnes - k > dnyU * 864e5)) tp.sh.deleteRow(i + 2); }
    }
  }
  if (nU || nK) zaznamZmeny_('noční údržba', LIST_KVALIFIKACE, '', 'smazáno', '', 'po lhůtě: účastníci školení ' + nU + ', kvalifikace ' + nK);
}

/** Výchozí katalog kvalifikací do prázdného listu Druhy kvalifikací (volá Založit / doplnit strukturu). Vrací počet vložených. */
function skDoplnitDruhy_() {
  const sh = dataSs_().getSheetByName(LIST_DRUHY_KVAL);
  if (!sh || sh.getLastRow() > 1) return 0;
  const h = hlavicka_(sh), ted = new Date();
  const radky = SK_VYCHOZI_DRUHY.map(([kod, nazev, oblast, pro, platnost, organ, pozn, minVek]) => h.map(k => ({ 'Kód': kod, 'Název': nazev, 'Oblast': oblast, 'Pro': pro, 'Platnost (roky)': platnost || '', 'Min. věk': minVek || '',
    'Orgán': organ, 'Aktivní': 'ANO', 'Poznámka': pozn, 'Vytvořeno': ted, 'Vytvořil': 'Založit strukturu' })[k]).map(v => v === undefined ? '' : v));
  sh.getRange(2, 1, radky.length, h.length).setValues(radky);
  return radky.length;
}

/* ---------- test (jen režim TEST) ---------- */

/**
 * Testovací školení (ID akce s „TEST“, uklidí je Úklid testů): kurz rozhodčích mládeže s otevřenými přihláškami (i z webu), včerejší zkouška odborností MH
 * (uzavřená, přihlášení testovací členové – k vyhodnocení), třídenní kurz vedoucích mládeže III. stupně od dneška (uzavřený, přihlášení dospělí
 * testovací členové – jde na něm hned spustit test) a kvalifikace testovacích členů, z nichž jedna končí do měsíce a jedna propadla.
 * Opakované spuštění doplní jen chybějící školení.
 * Potřebuje testovací členy (Členové: vložit testovací členy).
 */
function vlozitTestySkoleni() {
  if (String(nastaveniWeb_('REZIM') || '').toUpperCase() !== 'TEST') throw new Error('Testovací školení jde vložit jen v režimu TEST.');
  const cl = cleClenove_(null).filter(x => /TEST/.test(x.id) && x.aktivni);
  if (!cl.length) throw new Error('Nejdřív vložte testovací členy (OSH data → Členové: vložit testovací členy).');
  const ta = skTab_('Akce'), ts = skTab_(LIST_SKOLENI), tu = skTab_(LIST_UCASTNICI), tk = skTab_(LIST_KVALIFIKACE), ted = new Date(), kdo = 'test';
  const den = n => { const d = skDnes_(); d.setDate(d.getDate() + n); return d; }, iso = d => Utilities.formatDate(d, 'Europe/Prague', 'yyyy-MM-dd');
  const uz = {}; ta.v.forEach(r => { uz[String(r[ta.col('ID')])] = true; });
  const akce = [['ATEST-SK1', 'TEST: Školení rozhodčích soutěží mládeže', den(24), 'Zbraslav, K Výtopně 1224', 'kurz', 'RM', 'dospělí', 'OORM', 20, den(17), 'přihlášky', 'veřejnost'],
    ['ATEST-SK2', 'TEST: Zkouška odborností MH – strojník a zdravotník', den(-1), 'Kamenný Újezdec', 'zkouška', 'MH-STR, MH-ZDR', 'MH', 'OORM', 30, den(-8), 'uzavřeno', 'sbory s MH'],
    ['ATEST-SK3', 'TEST: Kurz vedoucích mládeže III. stupně', den(0), 'Jíloviště, hasičská zbrojnice', 'kurz', 'VM3', 'dospělí', 'OORM', 24, den(-7), 'uzavřeno', 'sbory s MH', 2]];
  akce.forEach(([id, nazev, od, misto, druh, kval, pro, organ, kap, uzav, stav, proKoho, dni]) => {
    if (uz[id]) return;
    const ra = ta.h.map(() => ''), sa = (k, v) => { if (ta.col(k) >= 0) ra[ta.col(k)] = v; };
    const od9 = new Date(od.getTime() + 9 * 36e5); // dni = kolik dní po prvním končí (vícedenní kurz)
    sa('ID', id); sa('Název', nazev); sa('Typ', 'školení'); sa('Pořadatel', 'OSH Praha-západ – ' + organ); sa('Od', od9); sa('Do', new Date(od9.getTime() + ((dni || 0) * 24 + 7) * 36e5)); sa('Místo', misto);
    sa('Pro koho', proKoho); sa('Popis', 'Testovací školení – vymyšlené údaje.'); sa('Stav', skAkceStav_(stav)); sa('Vytvořeno', ted); sa('Vytvořil', kdo);
    try { syncRadek_(kalendar_(), 'Akce', ta.h, ra); } catch (e) { console.error(e); }
    ta.sh.appendRow(ra);
    const rs = ts.h.map(() => ''), ss = (k, v) => { if (ts.col(k) >= 0) rs[ts.col(k)] = v; };
    ss('Akce – ID', id); ss('Druh', druh); ss('Kvalifikace', kval); ss('Pro', pro); ss('Orgán', organ); ss('Kapacita', kap); ss('Uzávěrka', uzav); ss('Poplatek', druh === 'kurz' ? 300 : '');
    ss('Lektor', 'Jan Ukázkový'); ss('Stav', stav); ss('Vytvořeno', ted); ss('Vytvořil', kdo); ss('Přihlášky z webu', id === 'ATEST-SK1' ? 'ANO' : 'NE');
    ts.sh.appendRow(rs);
  });
  // účastníci včerejší zkoušky: mladí hasiči a dorost z testovacích členů
  if (!uz['ATEST-SK2']) {
    const deti = cl.filter(x => x.kategorie !== 'dospělý').slice(0, 8);
    const nove = deti.map((x, i) => {
      const r = tu.h.map(() => ''), set = (k, v) => { if (tu.col(k) >= 0) r[tu.col(k)] = v; };
      set('ID', 'UTEST-' + i); set('Akce – ID', 'ATEST-SK2'); set('Sbor', x.sbor); set('Skupina', x.skupina); set('Člen – ID', x.id); set('Jméno', x.jmeno); set('Příjmení', x.prijmeni);
      set('Datum narození', new Date(x.narozen + 'T00:00:00')); set('Stav', 'přihlášeno'); set('Kód', i % 2 ? 'MH-ZDR' : 'MH-STR'); set('Přihlásil', kdo); set('Přihlášeno', ted); set('Vytvořeno', ted); set('Vytvořil', kdo);
      return r;
    });
    if (nove.length) tu.sh.getRange(tu.sh.getLastRow() + 1, 1, nove.length, tu.h.length).setValues(nove);
  }
  // účastníci kurzu VM III: dospělí testovací členové (okres na něm spustí test, kandidáti se ověří datem narození)
  if (!uz['ATEST-SK3']) {
    const nove = cl.filter(x => x.kategorie === 'dospělý').slice(0, 6).map((x, i) => {
      const r = tu.h.map(() => ''), set = (k, v) => { if (tu.col(k) >= 0) r[tu.col(k)] = v; };
      set('ID', 'UTEST-VM-' + i); set('Akce – ID', 'ATEST-SK3'); set('Sbor', x.sbor); set('Skupina', x.skupina); set('Člen – ID', x.id); set('Jméno', x.jmeno); set('Příjmení', x.prijmeni);
      set('Datum narození', new Date(x.narozen + 'T00:00:00')); set('Stav', 'přihlášeno'); set('Kód', 'VM3'); set('Přihlásil', kdo); set('Přihlášeno', ted); set('Vytvořeno', ted); set('Vytvořil', kdo);
      return r;
    });
    if (nove.length) tu.sh.getRange(tu.sh.getLastRow() + 1, 1, nove.length, tu.h.length).setValues(nove);
  }
  // kvalifikace dospělých testovacích členů: platná, končící do měsíce, propadlá
  const dosp = cl.filter(x => x.kategorie === 'dospělý').slice(0, 3);
  [['RM', -1805], ['VM3', -1000], ['RM', -2000]].forEach(([kod, posun], i) => {
    const x = dosp[i % dosp.length]; if (!x || tk.v.some(r => String(r[tk.col('ID')]) === 'KTEST-' + i)) return;
    const dr = skDruh_(kod) || { nazev: kod, platnost: 5 }, z = iso(den(posun));
    skKvalZapsat_(tk, kdo, { id: 'KTEST-' + i, kod: kod, nazev: dr.nazev, clen: x.id, jmeno: x.jmeno, prijmeni: x.prijmeni, narozen: x.narozen, sbor: x.sbor, skupina: x.skupina,
      ziskano: z, platiDo: skPlatiDo_(z, dr.platnost || 5), cislo: 'TEST-' + (100 + i), zdroj: 'ručně', poznamka: 'testovací' });
  });
  vycistitCache_();
  const text = 'Testovací školení vložena: kurz rozhodčích mládeže (přihlášky otevřené, ' + skDatum_(iso(den(24))) + '), včerejší zkouška odborností MH (uzavřená, k vyhodnocení), kurz vedoucích mládeže III. stupně ' + skDatum_(iso(den(0))) + ' – ' + skDatum_(iso(den(2))) + ' (test jde spustit) a 3 testovací kvalifikace. Co už v tabulce bylo, zůstalo beze změny. Uklidí je „Úklid testů“.';
  console.log(text); try { SpreadsheetApp.getActive().toast(text, 'Testovací školení', 15); } catch (e) {}
  return text;
}
