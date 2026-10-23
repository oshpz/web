/**
 * OSH data – přestupy členů mezi sbory (list Přestupy, předpona prs…).
 *
 * Žádost podá člen na webu (?stranka=prestup, u dítěte zákonný zástupce; Turnstile + limity), nebo ji za něj zadá přijímající sbor
 * v portálu (Přestupy). Oba sbory dají souhlas v aplikaci (kdo a kdy je v tabulce). Sbor z jiného okresu v aplikaci není – za něj
 * platí sken papírového přestupního lístku s jeho razítkem (nahraje žadatel přes osobní odkaz, nebo sbor z okresu).
 * Stavy: žádost → souhlasy (oba souhlasí) → provedeno (okres zapsal v evidencesdh.cz). Přijímající sbor nesouhlasí = zamítnuto;
 * domovský nesouhlasí = nesouhlas (rozhodne okres: provést přesto, nebo zamítnout). Zrušit může žadatel nebo přijímající sbor.
 *
 * Osobní údaje: jméno, datum narození, kontakt, číslo průkazu – bez rodného čísla a adresy (člen je v evidenci SH ČMS už zapsaný).
 * Sken lístku leží v důvěrné složce přihlášek (Můj disk účtu skriptu, Přestupy/<ID>), bez sdílení.
 * Osobní odkaz žadatele (?stranka=prestup&k=…) = HMAC z ID (tajný klíč ve Vlastnostech skriptu PRESTUPY_KLIC), v tabulce jen otisk.
 */

const LIST_PRESTUPY = 'Přestupy';
const PRS_STAVY_OTEVRENE = ['žádost', 'souhlasy', 'nesouhlas'];
const PRS_LIMIT_WEB = 20, PRS_LIMIT_EMAIL = 3;

function smiPrestupyOkres_(o) { return !!(o && (o.role['Přihlášky'] || o.role['Správce'])); }

/* ---------- osobní odkaz ---------- */

function prsTajemstvi_() {
  const p = PropertiesService.getScriptProperties();
  let k = p.getProperty('PRESTUPY_KLIC');
  if (!k) { k = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); p.setProperty('PRESTUPY_KLIC', k); }
  return k;
}
function prsKlic_(id) { return Utilities.computeHmacSha256Signature(String(id), prsTajemstvi_()).map(b => ((b + 256) % 256).toString(16).padStart(2, '0')).join(''); }
function prsOdkazUrl_(id) { return String(nastaveniWeb_('WEB_URL') || '').replace(/\/+$/, '') + '/?stranka=prestup&k=' + prsKlic_(id); }

/* ---------- řádky ---------- */

function prsRadek_(id) {
  const sh = dataSs_().getSheetByName(LIST_PRESTUPY);
  if (!sh) throw new Error('Chybí list „' + LIST_PRESTUPY + '“ – spusťte v tabulce OSH data → Založit / doplnit strukturu.');
  const h = hlavicka_(sh), col = k => h.indexOf(k);
  const ids = sh.getLastRow() > 1 ? sh.getRange(2, col('ID') + 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
  const i = ids.indexOf(String(id || ''));
  if (i < 0) return null;
  const rng = sh.getRange(i + 2, 1, 1, h.length), v = rng.getValues()[0];
  return { sh, h, col, rng, v, r: h.reduce((o, k, j) => (o[k] = v[j], o), {}) };
}
function prsZapsat_(x, zmeny, kdo) {
  Object.keys(zmeny).forEach(k => { if (x.col(k) >= 0) x.v[x.col(k)] = zmeny[k]; });
  x.v[x.col('Upraveno')] = new Date(); x.v[x.col('Upravil')] = kdo;
  x.rng.setValues([x.v]);
  x.r = x.h.reduce((o, k, j) => (o[k] = x.v[j], o), {});
}
function prsJson_(r) {
  const iso = v => v instanceof Date ? v.toISOString() : (v == null ? '' : v), o = {};
  ['ID', 'Jméno', 'Příjmení', 'Datum narození', 'Evidenční číslo', 'Zákonný zástupce', 'E-mail', 'Telefon', 'Z sboru', 'Z skupina', 'Z okresu', 'Do sboru', 'Do skupina', 'Do okresu',
    'Důvod', 'Stav', 'Stav od', 'Souhlas domovského', 'Souhlas domovského – kdo', 'Souhlas přijímajícího', 'Souhlas přijímajícího – kdo', 'Poznámka', 'Zdroj', 'Provedeno', 'Vytvořeno']
    .forEach(k => { o[k] = iso(r[k]); });
  o.maSken = !!r['Sken – ID'];
  return o;
}
const prsJmeno_ = r => String(r['Jméno'] || '') + ' ' + String(r['Příjmení'] || '');
const prsBezSdh_ = t => String(t || '').replace(/^SDH\s+/i, '');

/* ---------- kontrola a založení ---------- */

/**
 * Údaje žádosti. Sbor v okrese = název nebo skupina (prhSbor_); sbor z jiného okresu = jiny + nazev + okres.
 * zdroj 'web' vyžaduje souhlas se zpracováním; u člena do 18 let vždy zákonného zástupce.
 */
function prsKontrola_(v, zdroj) {
  const t = k => String(v[k] == null ? '' : v[k]).trim();
  const d = { jmeno: t('jmeno'), prijmeni: t('prijmeni'), narozeni: t('narozeni'), evCislo: t('evCislo'), zz: t('zz'), email: normEmail_(t('email')), telefon: t('telefon'), duvod: t('duvod') };
  const ch = kontrolaTextu_({ 'Jméno': d.jmeno, 'Příjmení': d.prijmeni, 'Číslo průkazu': d.evCislo, 'Zákonný zástupce': d.zz, 'Důvod': d.duvod, 'Sbor': t('zNazev') + t('doNazev'), 'Okres': t('zOkres') + t('doOkres') },
    { 'Jméno': 60, 'Příjmení': 60, 'Číslo průkazu': 30, 'Zákonný zástupce': 120, 'Důvod': 1000, 'Sbor': 200, 'Okres': 120 });
  if (ch) return { chyba: ch };
  if (!d.jmeno || !d.prijmeni) return { chyba: 'Vyplňte jméno a příjmení člena.' };
  const dn = new Date(d.narozeni + 'T00:00:00');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.narozeni) || isNaN(dn) || dn.getFullYear() < 1900 || dn > new Date()) return { chyba: 'Vyplňte datum narození člena.' };
  const vek = Math.floor((Date.now() - dn.getTime()) / (365.25 * 864e5));
  if (vek < 18 && !d.zz) return { chyba: 'Člen je mladší 18 let – vyplňte jméno zákonného zástupce (žádost podává on).' };
  if (vek >= 18) d.zz = '';
  if (d.evCislo && !/^[\w\/ .-]{1,30}$/.test(d.evCislo)) return { chyba: 'Číslo členského průkazu obsahuje nepovolené znaky.' };
  if (d.email && (d.email.length > 254 || !/^[^@\s<>"']+@[^@\s<>"']+\.[^@\s<>"']+$/.test(d.email))) return { chyba: 'Vyplňte platný e-mail.' };
  if (zdroj === 'web' && !d.email) return { chyba: 'Vyplňte e-mail – pošleme na něj odkaz, kde uvidíte stav přestupu.' };
  if (d.telefon && !/^\+?[\d ()-]{9,20}$/.test(d.telefon)) return { chyba: 'Vyplňte platný telefon (nebo nechte prázdné).' };
  const strana = (p, popis) => {
    if (v[p + 'Jiny'] === true) {
      const nazev = t(p + 'Nazev'), okres = t(p + 'Okres');
      if (!nazev || !okres) return { chyba: popis + ' sbor z jiného okresu: vyplňte název sboru i okres.' };
      return { sbor: /^SDH\s/i.test(nazev) ? nazev : 'SDH ' + nazev, skupina: '', okres: okres };
    }
    const s = prhSbor_(t(p + 'Sbor'));
    return s ? { sbor: /^SDH\s/i.test(s.sbor) ? s.sbor : 'SDH ' + s.sbor, skupina: s.skupina, okres: '' } : { chyba: 'Vyberte ' + popis.toLowerCase() + ' sbor.' };
  };
  const z = strana('z', 'Domovský'); if (z.chyba) return z;
  const dd = strana('do', 'Přijímající'); if (dd.chyba) return dd;
  if (!z.skupina && !dd.skupina) return { chyba: 'Aspoň jeden ze sborů musí být z okresu Praha-západ – jinak přestup vyřizuje jiné okresní sdružení.' };
  if (z.skupina && z.skupina === dd.skupina) return { chyba: 'Domovský a přijímající sbor jsou stejné.' };
  if (zdroj === 'web' && v.souhlas !== true) return { chyba: 'Potvrďte souhlas se zpracováním osobních údajů.' };
  d.z = z; d.do = dd;
  return { d: d };
}

/** Založení žádosti. zdroj 'web' (žadatel) | 'sbor' (přijímající sbor – jeho souhlas je tím daný) | 'test'. */
function prsZalozit_(v, kdo, zdroj, sborSk) {
  const k = prsKontrola_(v, zdroj);
  if (k.chyba) return { ok: false, chyba: k.chyba };
  const d = k.d;
  if (zdroj === 'sbor' && d.do.skupina !== sborSk) return { ok: false, chyba: 'Přestup zadává přijímající sbor – jako přijímající sbor musí být váš.' };
  const ted = new Date();
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = dataSs_().getSheetByName(LIST_PRESTUPY);
    if (!sh) return { ok: false, chyba: 'Přestupy se teď nastavují – zkuste to prosím později (okres musí doplnit strukturu tabulky).' };
    const h = hlavicka_(sh), col = x => h.indexOf(x);
    const ids = sh.getLastRow() > 1 ? sh.getRange(2, col('ID') + 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0])) : [];
    // stejný člen se stejným přestupem už otevřený → nezakládat podruhé (dvojí odeslání formuláře)
    const otevrene = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues().filter(r => PRS_STAVY_OTEVRENE.indexOf(r[col('Stav')]) >= 0) : [];
    if (otevrene.some(r => String(r[col('Jméno')]).toLowerCase() === d.jmeno.toLowerCase() && String(r[col('Příjmení')]).toLowerCase() === d.prijmeni.toLowerCase() && soDen_(r[col('Datum narození')]) === d.narozeni && String(r[col('Do sboru')]) === d.do.sbor))
      return { ok: false, chyba: 'Žádost o tento přestup už je podaná a vyřizuje se.' };
    let id; do { id = 'T' + Utilities.formatDate(ted, 'Europe/Prague', 'yyMMdd') + String(Math.floor(Math.random() * 10000)).padStart(4, '0'); } while (ids.indexOf(id) >= 0);
    const r = h.map(() => ''), set = (x, val) => { if (col(x) >= 0) r[col(x)] = val; };
    set('ID', id); set('Jméno', bezVzorce_(d.jmeno)); set('Příjmení', bezVzorce_(d.prijmeni)); set('Datum narození', new Date(d.narozeni + 'T00:00:00'));
    set('Evidenční číslo', bezVzorce_(d.evCislo)); set('Zákonný zástupce', bezVzorce_(d.zz)); set('E-mail', d.email); set('Telefon', bezVzorce_(d.telefon));
    set('Z sboru', bezVzorce_(d.z.sbor)); set('Z skupina', d.z.skupina); set('Z okresu', bezVzorce_(d.z.okres));
    set('Do sboru', bezVzorce_(d.do.sbor)); set('Do skupina', d.do.skupina); set('Do okresu', bezVzorce_(d.do.okres));
    set('Důvod', bezVzorce_(d.duvod)); set('Stav', 'žádost'); set('Stav od', ted); set('Zdroj', zdroj);
    if (zdroj === 'sbor') { set('Souhlas přijímajícího', ted); set('Souhlas přijímajícího – kdo', kdo); }
    set('Odkaz – otisk', otisk_('prs|' + prsKlic_(id)));
    set('Vytvořeno', ted); set('Vytvořil', kdo); set('Upraveno', ted); set('Upravil', kdo);
    sh.appendRow(r);
    zaznamZmeny_(kdo, LIST_PRESTUPY, id, 'vytvořeno', '', d.z.sbor + ' → ' + d.do.sbor + ' (' + zdroj + ')');
    const jm = d.jmeno + ' ' + d.prijmeni, popis = jm + ' z ' + d.z.sbor + (d.z.okres ? ' (okres ' + d.z.okres + ')' : '') + ' do ' + d.do.sbor + (d.do.okres ? ' (okres ' + d.do.okres + ')' : '');
    [d.z, d.do].forEach((s, i) => {
      if (!s.skupina || (zdroj === 'sbor' && i === 1)) return;
      prsPosta_(s.skupina, 'Žádost o přestup: ' + jm, 'Přišla žádost o přestup člena ' + popis + '. ' + (i === 0 ? 'Jako domovský sbor' : 'Jako přijímající sbor') +
        ' dejte v portálu sboru (Přestupy) souhlas, nebo napište, proč nesouhlasíte.', 'sbor/' + s.skupina + '/prestupy');
    });
    const jiny = !d.z.skupina ? 'domovského' : !d.do.skupina ? 'přijímajícího' : '';
    if (d.email) prsPostaZadateli_(d.email, 'Žádost o přestup jsme přijali – ' + jm, 'Dobrý den,\n\nžádost o přestup ' + popis + ' je podaná. ' +
      (jiny ? 'Sbor ' + jiny + ' z jiného okresu v naší aplikaci není – na odkazu níže stáhněte předvyplněný přestupní lístek, nechte ho tam potvrdit razítkem a podpisem starosty a nahrajte sken. ' : '') +
      'Oba sbory přestup potvrdí, pak ho okresní sdružení zapíše do evidence SH ČMS. Stav uvidíte na odkazu níže – je jen pro vás.', id);
    const out = { ok: true, id: id, data: prsJson_(h.reduce((o, x, j) => (o[x] = r[j], o), {})) };
    if (!ostryRezim_() || zdroj === 'web') out.odkaz = prsOdkazUrl_(id); // žadatel na webu ho vidí hned; v TESTu i sbor (e-maily jdou na TEST_EMAIL)
    return out;
  } finally { lock.releaseLock(); }
}

/* ---------- e-maily (jméno, sbory, odkaz – nic dalšího) ---------- */

function prsPosta_(skupina, predmet, text, cesta) {
  const url = (nastaveniWeb_('WEB_URL') || '') + '/Aplikace%20OSH.dc.html#' + cesta;
  const komu = skupina ? [skupina + '@' + (nastaveniWeb_('DOMENA') || 'oshpz.cz')]
    : radky_('Uživatelé').filter(u => ano_(u['Aktivní']) && (ano_(u['Přihlášky']) || ano_(u['Správce']))).map(u => normEmail_(u['E-mail']));
  const html = sablona_(predmet, text, [], ['Otevřít v aplikaci', url], 'Automatická zpráva aplikace OSH Praha-západ.');
  komu.filter(Boolean).forEach(e => { try { posta_(e, predmet, text + '\n\n' + url, html); } catch (x) { console.error('E-mail k přestupu: ' + x.message); } });
}
function prsPostaZadateli_(email, predmet, text, id) {
  if (!email) return;
  const url = prsOdkazUrl_(id);
  const html = sablona_(predmet, text, [], ['Stav přestupu', url], 'Automatická zpráva Okresního sdružení hasičů Praha-západ. Odkaz je jen pro vás.');
  try { posta_(email, predmet, text + '\n\n' + url, html); } catch (x) { console.error('E-mail žadateli o přestup: ' + x.message); }
}

/* ---------- souhlasy, sken, rozhodnutí ---------- */

/** Oba souhlasy → stav souhlasy a e-mail okresu. */
function prsPoSouhlasu_(x, kdo) {
  if (x.r['Stav'] !== 'žádost' || !x.r['Souhlas domovského'] || !x.r['Souhlas přijímajícího']) return;
  prsZapsat_(x, { 'Stav': 'souhlasy', 'Stav od': new Date() }, kdo);
  zaznamZmeny_(kdo, LIST_PRESTUPY, x.r['ID'], 'upraveno', 'žádost', 'souhlasy');
  prsPosta_(null, 'Přestup k zápisu: ' + prsJmeno_(x.r), 'Oba sbory souhlasí s přestupem ' + prsJmeno_(x.r) + ' z ' + x.r['Z sboru'] + ' do ' + x.r['Do sboru'] +
    '. Zapište ho v evidencesdh.cz a v aplikaci označte Provedeno (Sbory → Přestupy).', 'okres/prestupy');
  if (x.r['E-mail']) prsPostaZadateli_(String(x.r['E-mail']), 'Přestup potvrdily oba sbory – ' + prsJmeno_(x.r), 'Dobrý den,\n\noba sbory s přestupem souhlasí. Okresní sdružení ho teď zapíše do evidence SH ČMS a dáme vědět.', x.r['ID']);
}

/** Souhlas nebo nesouhlas sboru z okresu (sk = skupina přihlášeného sboru). */
function prsSouhlas_(o, x, sk, ano, duvod) {
  if (x.r['Stav'] !== 'žádost') return { ok: false, chyba: 'O přestupu už se rozhoduje dál (' + x.r['Stav'] + ').' };
  const strana = String(x.r['Z skupina']) === sk ? 'domovského' : String(x.r['Do skupina']) === sk ? 'přijímajícího' : '';
  if (!strana) return { ok: false, chyba: 'Přestup se vašeho sboru netýká.' };
  if (x.r['Souhlas ' + strana]) return { ok: false, chyba: 'Souhlas vašeho sboru už je zapsaný.' };
  duvod = String(duvod || '').trim();
  const ch = kontrolaTextu_({ 'Důvod': duvod }, { 'Důvod': 1000 }); if (ch) return { ok: false, chyba: ch };
  const jm = prsJmeno_(x.r);
  if (ano) {
    prsZapsat_(x, { ['Souhlas ' + strana]: new Date(), ['Souhlas ' + strana + ' – kdo']: o.email }, o.email);
    zaznamZmeny_(o.email, LIST_PRESTUPY, x.r['ID'], 'upraveno', '', 'souhlas ' + strana + ' sboru');
    prsPoSouhlasu_(x, o.email);
    return { ok: true, data: prsJson_(x.r) };
  }
  if (!duvod) return { ok: false, chyba: 'Napište, proč sbor nesouhlasí – uvidí to žadatel i okres.' };
  const stav = strana === 'přijímajícího' ? 'zamítnuto' : 'nesouhlas';
  prsZapsat_(x, { 'Stav': stav, 'Stav od': new Date(), 'Poznámka': bezVzorce_((strana === 'přijímajícího' ? 'Přijímající' : 'Domovský') + ' sbor nesouhlasí: ' + duvod) }, o.email);
  zaznamZmeny_(o.email, LIST_PRESTUPY, x.r['ID'], 'upraveno', 'žádost', stav);
  if (stav === 'nesouhlas') prsPosta_(null, 'Domovský sbor nesouhlasí s přestupem: ' + jm, x.r['Z sboru'] + ' nesouhlasí s přestupem ' + jm + ' do ' + x.r['Do sboru'] + '. Důvod: ' + duvod +
    '\n\nRozhodněte v aplikaci (Sbory → Přestupy): přestup provést přesto, nebo zamítnout.', 'okres/prestupy');
  if (x.r['E-mail']) prsPostaZadateli_(String(x.r['E-mail']), 'Přestup – ' + (stav === 'zamítnuto' ? 'přijímající sbor nesouhlasí' : 'domovský sbor nesouhlasí'),
    'Dobrý den,\n\n' + (stav === 'zamítnuto' ? x.r['Do sboru'] + ' s přestupem nesouhlasí, žádost je uzavřená.' : x.r['Z sboru'] + ' s přestupem nesouhlasí. O dalším postupu rozhodne okresní sdružení.') + '\n\nDůvod: ' + duvod, x.r['ID']);
  if (stav === 'zamítnuto' && x.r['Z skupina']) prsPosta_(String(x.r['Z skupina']), 'Přestup zamítnut: ' + jm, x.r['Do sboru'] + ' s přestupem ' + jm + ' nesouhlasí, žádost je uzavřená.', 'sbor/' + x.r['Z skupina'] + '/prestupy');
  return { ok: true, data: prsJson_(x.r) };
}

/** Sken papírového lístku = souhlas sboru z jiného okresu. Nahraje žadatel (odkaz) nebo sbor z okresu. */
function prsSken_(kdo, x, req) {
  if (PRS_STAVY_OTEVRENE.indexOf(x.r['Stav']) < 0) return { ok: false, chyba: 'Přestup je uzavřený (' + x.r['Stav'] + ').' };
  const nazev = String(req.nazev || 'sken').trim(), mime = String(req.mime || '');
  let b; try { b = Utilities.base64Decode(String(req.data || '')); } catch (e) { return { ok: false, chyba: 'Soubor se nepodařilo přečíst.' }; }
  const ch = overitSoubor_(nazev, mime, b.length, null, b); if (ch) return { ok: false, chyba: ch };
  const koren = prhKoren_(), dite = (rodic, jm) => { const it = rodic.getFoldersByName(jm); return it.hasNext() ? it.next() : rodic.createFolder(jm); };
  const slozka = dite(dite(koren, 'Přestupy'), String(x.r['ID']));
  const f = slozka.createFile(Utilities.newBlob(b, mime, 'Prestupni listek ' + x.r['ID'] + ' ' + Utilities.formatDate(new Date(), 'Europe/Prague', 'yyyy-MM-dd HH-mm') + '.' + (SOUBORY_POVOLENE[mime] || 'pdf')));
  const zmeny = { 'Sken – ID': f.getId() };
  // souhlas strany mimo okres = sken s jejím razítkem (okres sken zkontroluje před provedením)
  if (!x.r['Z skupina'] && !x.r['Souhlas domovského']) { zmeny['Souhlas domovského'] = new Date(); zmeny['Souhlas domovského – kdo'] = 'sken lístku'; }
  if (!x.r['Do skupina'] && !x.r['Souhlas přijímajícího']) { zmeny['Souhlas přijímajícího'] = new Date(); zmeny['Souhlas přijímajícího – kdo'] = 'sken lístku'; }
  prsZapsat_(x, zmeny, kdo);
  zaznamZmeny_(kdo, LIST_PRESTUPY, x.r['ID'], 'upraveno', '', 'sken přestupního lístku');
  prsPoSouhlasu_(x, kdo);
  return { ok: true, data: prsJson_(x.r) };
}

/** Okres: provést (zapsáno v evidenci; i přes nesouhlas domovského sboru) nebo zamítnout (důvod povinný). */
function prsRozhodnout_(o, x, req) {
  const roz = String(req.rozhodnuti || ''), duvod = String(req.duvod || '').trim();
  const ch = kontrolaTextu_({ 'Důvod': duvod }, { 'Důvod': 1000 }); if (ch) return { ok: false, chyba: ch };
  const jm = prsJmeno_(x.r), pred = x.r['Stav'];
  let predmet, text;
  if (roz === 'provést') {
    if (['souhlasy', 'nesouhlas'].indexOf(pred) < 0) return { ok: false, chyba: 'Přestup jde provést po souhlasu obou sborů (nebo po nesouhlasu domovského sboru).' };
    const den = String(req.datum || '').trim() || soDen_(new Date());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(den)) return { ok: false, chyba: 'Datum provedení má tvar RRRR-MM-DD.' };
    prsZapsat_(x, { 'Stav': 'provedeno', 'Stav od': new Date(), 'Provedeno': new Date(den + 'T00:00:00'), 'Poznámka': duvod ? bezVzorce_(duvod) : x.r['Poznámka'] }, o.email);
    predmet = 'Přestup proveden: ' + jm;
    text = 'Okresní sdružení zapsalo přestup ' + jm + ' z ' + x.r['Z sboru'] + ' do ' + x.r['Do sboru'] + ' do evidence SH ČMS (' + den.split('-').reverse().map(Number).join('. ') + ').';
  } else if (roz === 'zamítnout') {
    if (PRS_STAVY_OTEVRENE.indexOf(pred) < 0) return { ok: false, chyba: 'Přestup je už uzavřený (' + pred + ').' };
    if (!duvod) return { ok: false, chyba: 'Napište důvod – uvidí ho žadatel i sbory.' };
    prsZapsat_(x, { 'Stav': 'zamítnuto', 'Stav od': new Date(), 'Poznámka': bezVzorce_('Okres: ' + duvod) }, o.email);
    predmet = 'Přestup zamítnut: ' + jm;
    text = 'Okresní sdružení přestup ' + jm + ' z ' + x.r['Z sboru'] + ' do ' + x.r['Do sboru'] + ' zamítlo. Důvod: ' + duvod;
  } else return { ok: false, chyba: 'Neznámé rozhodnutí.' };
  zaznamZmeny_(o.email, LIST_PRESTUPY, x.r['ID'], 'upraveno', pred, x.r['Stav']);
  ['Z skupina', 'Do skupina'].forEach(k => { if (x.r[k]) prsPosta_(String(x.r[k]), predmet, text, 'sbor/' + x.r[k] + '/prestupy'); });
  if (x.r['E-mail']) prsPostaZadateli_(String(x.r['E-mail']), predmet, 'Dobrý den,\n\n' + text, x.r['ID']);
  return { ok: true, data: prsJson_(x.r) };
}

function prsZrusit_(kdo, x, kym) {
  if (PRS_STAVY_OTEVRENE.indexOf(x.r['Stav']) < 0) return { ok: false, chyba: 'Přestup je už uzavřený (' + x.r['Stav'] + ').' };
  const pred = x.r['Stav'];
  prsZapsat_(x, { 'Stav': 'zrušeno', 'Stav od': new Date(), 'Poznámka': bezVzorce_('Zrušil ' + kym + '.') }, kdo);
  zaznamZmeny_(kdo, LIST_PRESTUPY, x.r['ID'], 'upraveno', pred, 'zrušeno');
  ['Z skupina', 'Do skupina'].forEach(k => { if (x.r[k]) prsPosta_(String(x.r[k]), 'Přestup zrušen: ' + prsJmeno_(x.r), 'Žádost o přestup ' + prsJmeno_(x.r) + ' do ' + x.r['Do sboru'] + ' zrušil ' + kym + '.', 'sbor/' + x.r[k] + '/prestupy'); });
  return { ok: true, data: prsJson_(x.r) };
}

/* ---------- PDF přestupního lístku (předvyplněný, bez rodného čísla a adresy – doplní se ručně) ---------- */

function prsPdf_(x) {
  const r = x.r, e = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const den = v => v instanceof Date ? Utilities.formatDate(v, 'Europe/Prague', 'd. M. yyyy') : '';
  const pole = (k, v, prazdne) => '<tr><td class="k">' + e(k) + '</td><td class="v">' + (v ? e(v) : '<span class="ruc">' + (prazdne || '') + '</span>') + '</td></tr>';
  const souhlas = (kdo, sbor, okres, datum, email) => '<td class="s"><b>Souhlas ' + kdo + ' SDH</b><div class="sb">' + e(sbor) + (okres ? ' (okres ' + e(okres) + ')' : '') + '</div>' +
    (datum && email !== 'sken lístku' ? '<div class="el">Souhlas udělen v aplikaci OSH Praha-západ ' + e(den(datum)) + '<br>(' + e(email) + ')</div>' : '<div class="raz"></div><div class="pod">razítko, podpis starosty SDH, datum</div>') + '</td>';
  const html = '<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;font-size:11pt;color:#201e1d;margin:28px 34px;}h1{font-size:18pt;margin:0;}' +
    '.pod1{font-size:10pt;color:#555;margin:2px 0 14px;}h2{font-size:12pt;border-bottom:2px solid #201e1d;padding-bottom:3px;margin:16px 0 6px;}table{border-collapse:collapse;width:100%;}' +
    'td.k{width:38%;padding:6px 8px 6px 0;color:#444;vertical-align:top;}td.v{padding:6px 0;border-bottom:1px solid #999;font-weight:bold;}.ruc{color:#999;font-weight:normal;font-size:9pt;}' +
    'td.s{width:50%;vertical-align:top;border:1px solid #201e1d;padding:8px;}.sb{margin:4px 0 6px;}.raz{height:80px;}.pod{font-size:9pt;color:#555;border-top:1px solid #999;padding-top:2px;}' +
    '.el{font-size:10pt;margin-top:10px;}.pata{margin-top:18px;font-size:9pt;color:#555;}</style></head><body>' +
    '<h1>PŘESTUPNÍ LÍSTEK ČLENA SH ČMS</h1><div class="pod1">formulář pro převod členství mezi sbory dobrovolných hasičů · č. žádosti ' + e(r['ID']) + '</div>' +
    '<h2>1. Údaje o členovi</h2><table>' + pole('Jméno a příjmení člena', prsJmeno_(r)) + pole('Datum narození', den(r['Datum narození'])) +
    pole('Rodné číslo', '', 'doplní člen ručně') + pole('Číslo členského průkazu', r['Evidenční číslo'], 'doplní člen ručně') + pole('Trvalé bydliště', '', 'doplní člen ručně') +
    pole('Dosavadní SDH', r['Z sboru']) + pole('Okres', r['Z okresu'] || 'Praha-západ') + (r['Zákonný zástupce'] ? pole('Zákonný zástupce', r['Zákonný zástupce']) : '') + '</table>' +
    '<h2>2. Žádost o přestup</h2><table>' + pole('Žádám o přestup do SDH', prsBezSdh_(r['Do sboru'])) + pole('Okres', r['Do okresu'] || 'Praha-západ') +
    pole('Dne', den(r['Vytvořeno'])) + pole('Podpis člena' + (r['Zákonný zástupce'] ? ' / zákonného zástupce' : ''), '', '') + '</table>' +
    '<h2>3. Souhlasy sborů</h2><table><tr>' + souhlas('domovského', r['Z sboru'], r['Z okresu'], r['Souhlas domovského'], r['Souhlas domovského – kdo']) +
    souhlas('přijímajícího', r['Do sboru'], r['Do okresu'], r['Souhlas přijímajícího'], r['Souhlas přijímajícího – kdo']) + '</tr></table>' +
    '<div class="pata">Přestupní lístek člena SH ČMS · vytvořeno v aplikaci OSH Praha-západ ' + e(den(new Date())) + '. Sbor z jiného okresu potvrdí razítkem a podpisem, sken se nahraje k žádosti.</div></body></html>';
  const pdf = Utilities.newBlob(html, 'text/html', 'listek.html').getAs('application/pdf');
  return { ok: true, nazev: 'Prestupni listek ' + r['ID'] + '.pdf', data: Utilities.base64Encode(pdf.getBytes()) };
}
function prsSkenStahnout_(x) {
  if (!x.r['Sken – ID']) return { ok: false, chyba: 'Sken zatím není nahraný.' };
  const f = DriveApp.getFileById(x.r['Sken – ID']);
  return { ok: true, nazev: f.getName(), mime: f.getMimeType(), data: Utilities.base64Encode(f.getBlob().getBytes()) };
}

/* ---------- API ---------- */

/** Přihlášení: okres (role Přihlášky / Správce) a sbory, kterých se přestup týká. */
function apiPrestupy_(req) {
  const o = prihlaseny_(req.token);
  if (!o) return { ok: false, chyba: 'Nepřihlášen', odhlasen: true };
  const okres = smiPrestupyOkres_(o);
  const vse = () => radky_(LIST_PRESTUPY).filter(r => r['ID']);
  if (req.akce === 'prestupyOkres') return okres ? { ok: true, data: vse().map(prsJson_).reverse() } : { ok: false, chyba: 'Přestupy vyřizuje role Přihlášky nebo Správce.' };
  if (req.akce === 'prestupRozhodnout') {
    if (!okres) return { ok: false, chyba: 'Přestupy vyřizuje role Přihlášky nebo Správce.' };
    const x = prsRadek_(req.id); if (!x) return { ok: false, chyba: 'Přestup nenalezen.' };
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try { return prsRozhodnout_(o, x, req); } finally { lock.releaseLock(); }
  }
  if (req.akce === 'prestupPdf' || req.akce === 'prestupSkenStahnout') { // okres nebo sbor, kterého se přestup týká
    const x = prsRadek_(req.id); if (!x) return { ok: false, chyba: 'Přestup nenalezen.' };
    const u = req.sbor ? pohledSboru_(o, req.sbor) : null, sk = u ? u.sbor.skupina : '';
    if (!okres && !(sk && (String(x.r['Z skupina']) === sk || String(x.r['Do skupina']) === sk))) return { ok: false, chyba: 'K tomuto přestupu nemáte přístup.' };
    return req.akce === 'prestupPdf' ? prsPdf_(x) : prsSkenStahnout_(x);
  }
  const u = pohledSboru_(o, req.sbor);
  if (!u) return { ok: false, chyba: 'Ke sboru ' + (req.sbor || '(nevybrán)') + ' nemáte přístup.' };
  const sk = u.sbor.skupina;
  if (req.akce === 'prestupySbor') return { ok: true, data: vse().filter(r => String(r['Z skupina']) === sk || String(r['Do skupina']) === sk).map(prsJson_).reverse(),
    sbory: radkyRychle_('Sbory').filter(r => r['Sbor'] && String(r['Aktivní']).trim().toUpperCase() !== 'NE' && String(r['Skupina'] || '').toLowerCase().split('@')[0] !== sk).map(r => String(r['Sbor'])).sort((a, b) => a.localeCompare(b, 'cs')) };
  if (req.akce === 'prestupNovy') {
    if (limit_('prestup-sbor', o.email, 30, 3600)) return { ok: false, chyba: 'Příliš mnoho přestupů za hodinu. Zkuste to později.' };
    return prsZalozit_(Object.assign({}, req.data || {}, { doJiny: false, doSbor: sk }), o.email, 'sbor', sk);
  }
  const x = prsRadek_(req.id); if (!x) return { ok: false, chyba: 'Přestup nenalezen.' };
  if (String(x.r['Z skupina']) !== sk && String(x.r['Do skupina']) !== sk) return { ok: false, chyba: 'Přestup se vašeho sboru netýká.' };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (req.akce === 'prestupSouhlas') return prsSouhlas_(o, x, sk, req.souhlas === true, req.duvod);
    if (req.akce === 'prestupSken') return prsSken_(o.email, x, req);
    if (req.akce === 'prestupZrusit') {
      if (String(x.r['Do skupina']) !== sk) return { ok: false, chyba: 'Žádost může zrušit přijímající sbor nebo žadatel.' };
      return prsZrusit_(o.email, x, 'přijímající sbor');
    }
  } finally { lock.releaseLock(); }
  return { ok: false, chyba: 'Neznámá akce' };
}

/** Veřejná žádost z webu (bez přihlášení): Turnstile + limity. */
function prestupVerejny_(req) {
  try {
    const ts = overitTurnstile_(req.turnstile, 'prestup');
    if (ts) return { ok: false, chyba: ts };
    const d = req.data || {};
    if (limit_('prestup-web', 'web', PRS_LIMIT_WEB, 600)) return { ok: false, chyba: 'Služba je teď přetížená. Zkuste to za 10 minut.' };
    if (limit_('prestup-email', normEmail_(d.email) || 'bez e-mailu', PRS_LIMIT_EMAIL, 3600)) return { ok: false, chyba: 'Z tohoto e-mailu už přišlo několik žádostí. Zkuste to za hodinu.' };
    return prsZalozit_(d, 'veřejný formulář (' + (normEmail_(d.email) || '') + ')', 'web', '');
  } catch (e) { console.error('Přestup z webu: ' + e.message + '\n' + e.stack); return { ok: false, chyba: 'Žádost se nepodařilo uložit. Zkuste to prosím znovu.' + (ostryRezim_() ? '' : ' (TEST: ' + String(e.message).slice(0, 200) + ')') }; }
}

/** Osobní odkaz žadatele (?stranka=prestup&k=…): krok stav | pdf | sken | zrusit. */
function prestupZadatel_(req) {
  try {
    const k = String(req.k || '');
    if (!/^[a-f0-9]{64}$/.test(k)) return { ok: false, chyba: 'Odkaz neplatí.' };
    const sh = dataSs_().getSheetByName(LIST_PRESTUPY);
    if (!sh || sh.getLastRow() < 2) return { ok: false, chyba: 'Odkaz neplatí.' };
    const h = hlavicka_(sh), c = h.indexOf('Odkaz – otisk'), ot = otisk_('prs|' + k);
    const v = sh.getRange(2, c + 1, sh.getLastRow() - 1, 1).getValues(), i = v.findIndex(r => r[0] === ot);
    if (i < 0) return { ok: false, chyba: 'Odkaz neplatí. Použijte prosím odkaz z posledního e-mailu.' };
    const x = prsRadek_(sh.getRange(i + 2, h.indexOf('ID') + 1).getValue());
    if (limit_('prestup-odkaz', String(x.r['ID']), 60, 3600)) return { ok: false, chyba: 'Příliš mnoho pokusů. Zkuste to za hodinu.' };
    const kdo = 'žadatel (' + normEmail_(x.r['E-mail']) + ')', krok = String(req.krok || 'stav');
    if (krok === 'pdf') return prsPdf_(x);
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      if (krok === 'sken') {
        if (x.r['Z skupina'] && x.r['Do skupina']) return { ok: false, chyba: 'Oba sbory jsou z okresu Praha-západ – souhlas dávají v aplikaci, sken není potřeba.' };
        return prsProZadatele_(prsSken_(kdo, x, req));
      }
      if (krok === 'zrusit') return prsProZadatele_(prsZrusit_(kdo, x, 'žadatel'));
    } finally { lock.releaseLock(); }
    return prsProZadatele_({ ok: true, data: prsJson_(x.r) });
  } catch (e) { console.error('Přestup – odkaz: ' + e.message); return { ok: false, chyba: 'Přestup se nepodařilo načíst. Zkuste to prosím znovu.' }; }
}
/** Pro žadatele jen to, co potřebuje (bez e-mailů členů výboru, kteří souhlasili). */
function prsProZadatele_(v) {
  if (!v.ok || !v.data) return v;
  const d = Object.assign({}, v.data);
  ['Souhlas domovského – kdo', 'Souhlas přijímajícího – kdo'].forEach(k => { if (d[k] && d[k] !== 'sken lístku') d[k] = 'v aplikaci'; });
  delete d['Z skupina']; delete d['Do skupina'];
  d.potrebaSken = !v.data['Z skupina'] || !v.data['Do skupina'];
  return Object.assign({}, v, { data: d });
}

/** Test: dva přestupy (v okrese a z jiného okresu) mezi prvními sbory listu Sbory. */
function vlozitTestyPrestupu() {
  const sb = radkyRychle_('Sbory').filter(r => r['Sbor'] && r['Skupina'] && String(r['Aktivní']).trim().toUpperCase() !== 'NE').slice(0, 2);
  if (sb.length < 2) throw new Error('V listu Sbory jsou méně než 2 sbory se skupinou.');
  const a = prsZalozit_({ jmeno: 'TEST Jan', prijmeni: 'Přestupový', narozeni: '1990-05-01', evCislo: '123456', email: Session.getActiveUser().getEmail(), zSbor: String(sb[0]['Sbor']), doSbor: String(sb[1]['Sbor']), duvod: 'stěhování' }, 'test', 'test', '');
  const b = prsZalozit_({ jmeno: 'TEST Eva', prijmeni: 'Odjinud', narozeni: '2014-03-02', zz: 'TEST Marie Odjinud', email: Session.getActiveUser().getEmail(), zJiny: true, zNazev: 'Lhota', zOkres: 'Beroun', doSbor: String(sb[0]['Sbor']) }, 'test', 'test', '');
  const text = [a, b].map(x => x.ok ? x.id + ' – odkaz žadatele: ' + prsOdkazUrl_(x.id) : 'CHYBA: ' + x.chyba).join('\n');
  console.log(text);
  return text;
}
