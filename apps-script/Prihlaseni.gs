/**
 * OSH data – serverová část, díl 2: přihlášení kódem na e-mail (B2.2).
 * Nový soubor „Prihlaseni“ ve stejném projektu. Nahrazuje doPost z API.gs – tam ho smažte.
 *
 * Tok: web pošle e-mail → server pošle 6místný kód (platí 10 min) → web pošle kód → server vrátí token.
 * Token se ukládá jen jako otisk (SHA-256); platí 30 dní, pro role, které zveřejňují, 7 dní.
 */

const KOD_PLATNOST_S = 600, KOD_POKUSU = 5, KODU_ZA_HODINU = 5, KODU_CELKEM_ZA_10_MIN = 30, BLOKACE_S = 900; // limity F3
const RELACE_DNY = 30, RELACE_DNY_ZVEREJNOVANI = 7;
const ROLE_SLOUPCE = ['Dokumenty', 'Termíny', 'Akce', 'Soutěže', 'Majetek', 'Přihlášky', 'Příspěvky', 'Sbory', 'Správce'];

// Zápisy, které aplikace při výpadku zopakuje: se stejným „klic“ vrátí server uloženou odpověď a zápis neprovede podruhé.
const OPAKOVATELNE = ['kod', 'overit', 'ulozitAkci', 'ulozitTermin', 'zrusitAkci', 'zrusitTermin', 'dokumentRozhodnout', 'zkontrolovatDisk', 'nahlasitZmenu',
  'zadostUlozit', 'zadostStahnout', 'zadostPriloha', 'zadostRozhodnout',
  'majetekUlozit', 'majetekVyradit', 'vypujckaNova', 'vypujckaVratit', 'majetekFotoNahrat', 'majetekPoskozeni',
  'prispevekUlozit', 'prispevekRozhodnout', 'prispevekSoubor', 'prispevekSouborSmazat'];

function doPost(e) {
  let req = {};
  try { req = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { return json_({ ok: false, chyba: 'Neplatný požadavek' }); }
  const klic = OPAKOVATELNE.indexOf(req.akce) >= 0 && /^[\w-]{16,64}$/.test(String(req.klic || '')) ? 'q_' + req.klic : '';
  const c = CacheService.getScriptCache();
  if (klic) {
    let ulozena = c.get(klic);
    // Stejný požadavek ještě běží (aplikace ho po časovém limitu zopakovala) → počkat na jeho výsledek, nezapisovat podruhé.
    for (let i = 0; ulozena === PROBIHA && i < 25; i++) { Utilities.sleep(1000); ulozena = c.get(klic); }
    if (ulozena === PROBIHA) return json_({ ok: false, chyba: 'Uložení se ještě zpracovává. Za chvíli načtěte znovu a nic nezadávejte podruhé.' });
    if (ulozena) return ContentService.createTextOutput(ulozena).setMimeType(ContentService.MimeType.JSON);
    c.put(klic, PROBIHA, 120);
  }
  const vystup = doPostAkce_(req);
  if (klic) {
    const t = vystup.getContent();
    try { c.put(klic, t, 600); }
    catch (x) { // odpověď nad 100 kB (např. s daty evidence) → uložit jen výsledek bez dat
      try { const j = JSON.parse(t); c.put(klic, JSON.stringify({ ok: j.ok, chyba: j.chyba, id: j.id, akceId: j.akceId, soubor: j.soubor }), 600); } catch (y) { c.remove(klic); } }
  }
  return vystup;
}
const PROBIHA = '__probiha__';

function doPostAkce_(req) {
  try {
    switch (req.akce) {
      case 'kod':      return json_(poslatKod_(String(req.email || ''), req.turnstile));
      case 'overit':   return json_(overitKod_(String(req.email || ''), String(req.kod || '')));
      case 'ja':       return json_(ja_(req.token));
      case 'odhlasit': return json_(odhlasit_(req.token));
      case 'dokumentyKeSchvaleni':
      case 'dokumentyVse':
      case 'zkontrolovatDisk':
      case 'dokumentRozhodnout': return json_(apiDokumenty_(req));
      case 'kalendar':
      case 'ulozitAkci':
      case 'ulozitTermin':
      case 'zrusitAkci':
      case 'zrusitTermin': return json_(apiKalendar_(req));
      case 'zaznamZmen':   return json_(apiZaznam_(req));
      case 'portal':       return json_(apiPortal_(req));
      case 'nahlasitZmenu': return json_(apiNahlasitZmenu_(req));
      case 'zadostiSbor':
      case 'zadostUlozit':
      case 'zadostStahnout':
      case 'zadostPriloha':
      case 'zadostiOkres':
      case 'zadostRozhodnout': return json_(apiZadosti_(req));
      case 'majetekData':
      case 'majetekUlozit':
      case 'majetekVyradit':
      case 'vypujckaNova':
      case 'vypujckaVratit':
      case 'majetekFoto':
      case 'majetekFotoNahrat':
      case 'majetekPoskozeni': return json_(apiMajetek_(req));
      case 'prispevky':
      case 'prispevekUlozit':
      case 'prispevekRozhodnout':
      case 'prispevekSoubor':
      case 'prispevekSouborSmazat':
      case 'prispevekNahledy': return json_(apiPrispevky_(req));
      default:         return json_({ ok: false, chyba: 'Neznámá akce' });
    }
  } catch (err) {
    console.error(err);
    // Text chyby jen přihlášeným (hlášky typu „Doplňte orgán…“); anonymní dotaz nedostane nic o vnitřku serveru.
    let prihlasen = false; try { prihlasen = !!(req.token && prihlaseny_(req.token)); } catch (x) {}
    return json_({ ok: false, chyba: prihlasen && err && err.message ? err.message : 'Chyba serveru' });
  }
}

/* ---------- kdo je kdo ---------- */

function normEmail_(e) { return String(e || '').replace(/^mailto:/i, '').trim().toLowerCase(); }
function ano_(v) { return v === true || /^(ano|true|1)$/i.test(String(v || '').trim()); }

/** Vrátí { email, jmeno, role:{…}, sbory:[…] } nebo null, když e-mail nikde není. */
function opravneni_(email) {
  email = normEmail_(email);
  const u = radkyRychle_('Uživatelé').find(r => normEmail_(r['E-mail']) === email && ano_(r['Aktivní']));
  const sbory = sboryUzivatele_(email);
  if (!u && !sbory.length) return null;
  const role = {};
  if (u) ROLE_SLOUPCE.forEach(k => { const v = String(u[k] || '').trim(); if (v && v.toUpperCase() !== 'NE') role[k] = ano_(v) ? true : v; });
  return { email: email, jmeno: (u && u['Jméno']) || '', role: role, sbory: sbory };
}

function zverejnuje_(o) { return !!(o.role['Správce'] || o.role['Dokumenty'] || o.role['Příspěvky'] === 'zveřejnit'); }

/* ---------- sbor podle členství ve skupině sdh-…@ (B3.5) ---------- */

const LIST_CLENSTVI = 'Členství skupin';

/** Sbory, za které se e-mail smí přihlásit: člen skupiny sdh-…@ (hlavní zdroj) nebo sloupec Kontakty v listu Sbory (záloha). */
function sboryUzivatele_(email) {
  const jm = t => String(t || '').toLowerCase().replace(/^sdh\s+/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const sbory = radkyRychle_('Sbory').filter(r => String(r['Aktivní']).trim().toUpperCase() !== 'NE');
  const najit = (skupina, nazev) => sbory.find(r => r['Skupina'] && String(r['Skupina']).split('@')[0].toLowerCase() === skupina) ||
    sbory.find(r => 'sdh-' + jm(r['Sbor']) === skupina) || (nazev ? sbory.find(r => jm(r['Sbor']) === jm(nazev)) : null);
  const out = {};
  const pridat = (skupina, r, nazev, zdroj) => {
    const klic = skupina || ('sdh-' + jm(r ? r['Sbor'] : nazev));
    if (out[klic]) return;
    out[klic] = { sbor: r ? r['Sbor'] : nazev, skupina: klic, okrsek: r ? r['Okrsek'] : '', mh: !!(r && ano_(r['MH'])), jsdh: !!(r && ano_(r['JSDH'])), sport: !!(r && ano_(r['Sport'])), zdroj };
  };
  clenstvi_().filter(c => c.e === email).forEach(c => pridat(c.g, najit(c.g, c.n), c.n, 'skupina'));
  sbory.filter(r => String(r['Kontakty'] || '').toLowerCase().split(/[,;\s]+/).indexOf(email) >= 0)
    .forEach(r => pridat(r['Skupina'] ? String(r['Skupina']).split('@')[0].toLowerCase() : '', r, r['Sbor'], 'kontakty'));
  return Object.keys(out).map(k => out[k]);
}

/** Členství z listu „Členství skupin“ (s mezipamětí 10 min). Když list chybí nebo je prázdný, sestaví ho. */
function clenstvi_() {
  const c = CacheService.getScriptCache(), z = c.get('clenstvi');
  if (z) return JSON.parse(z);
  let sh = dataSs_().getSheetByName(LIST_CLENSTVI);
  if (!sh || sh.getLastRow() < 2) { obnovitClenstvi(); sh = dataSs_().getSheetByName(LIST_CLENSTVI); }
  const v = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues() : [];
  const data = v.filter(r => r[0]).map(r => ({ e: normEmail_(r[0]), g: String(r[1]).split('@')[0].toLowerCase(), n: String(r[2]) }));
  try { c.put('clenstvi', JSON.stringify(data), 600); } catch (e) {}
  return data;
}

/** Projde všechny skupiny sdh-…@ a zapíše jejich členy do listu „Členství skupin“. Každou hodinu + z menu.
 *  Potřebuje službu Admin SDK (Služby → Admin SDK API → AdminDirectory) a účet správce Workspace. */
function obnovitClenstvi() {
  if (typeof AdminDirectory === 'undefined') throw new Error('Zapněte v Apps Script službu Admin SDK API (Služby → + → Admin SDK API, identifikátor AdminDirectory).');
  const dom = nastaveniWeb_('DOMENA') || 'oshpz.cz', radky = [], ted = new Date();
  let token;
  do {
    const res = AdminDirectory.Groups.list({ domain: dom, maxResults: 200, pageToken: token, query: 'email:sdh-*' });
    (res.groups || []).forEach(g => {
      const nazev = String(g.name || '').replace(/\s*-\s*OSH Praha-západ\s*$/i, '');
      let mt;
      do {
        const m = AdminDirectory.Members.list(g.email, { maxResults: 200, pageToken: mt });
        (m.members || []).filter(x => x.type !== 'GROUP' && x.email && x.status !== 'SUSPENDED')
          .forEach(x => radky.push([normEmail_(x.email), g.email.split('@')[0], nazev, ({ MEMBER: 'Člen', MANAGER: 'Správce', OWNER: 'Vlastník' })[x.role] || x.role, ted]));
        mt = m.nextPageToken;
      } while (mt);
    });
    token = res.nextPageToken;
  } while (token);
  const ss = dataSs_();
  let sh = ss.getSheetByName(LIST_CLENSTVI);
  if (!sh) { sh = ss.insertSheet(LIST_CLENSTVI); sh.setTabColor('#868e96'); }
  sh.clearContents();
  sh.getRange(1, 1, 1, 5).setValues([['E-mail', 'Skupina', 'Sbor', 'Role ve skupině', 'Aktualizováno']]).setFontWeight('bold').setBackground('#f3f2f2');
  sh.setFrozenRows(1);
  if (radky.length) sh.getRange(2, 1, radky.length, 5).setValues(radky);
  sh.getRange(1, 1).setNote('Vyplňuje skript z Google Skupin každou hodinu. Ručně neupravujte – změny dělejte ve skupinách sdh-…@.');
  CacheService.getScriptCache().remove('clenstvi');
  console.log('Členství obnoveno: ' + radky.length + ' záznamů.');
  return radky.length;
}

function obnovitClenstviTed() { const n = obnovitClenstvi(); SpreadsheetApp.getActive().toast('Načteno ' + n + ' členství ze skupin sdh-…@.', 'Skupiny', 6); }

/* ---------- kód ---------- */

function poslatKod_(email, turnstile) {
  email = normEmail_(email);
  const odpoved = { ok: true, zprava: 'Pokud je adresa v evidenci, přišel na ni kód.' }; // stejná odpověď vždy – neprozradí, kdo v evidenci je
  if (email.length > 254 || !/^[^@\s<>"'=+]+@[^@\s<>"']+\.[^@\s<>"']+$/.test(email)) return { ok: false, chyba: 'Zadejte platný e-mail.' };
  const ts = overitTurnstile_(turnstile, 'kod');
  if (ts) return { ok: false, chyba: ts };
  if (blokovan_(email)) return { ok: false, chyba: 'Po několika chybných kódech je přihlášení na 15 minut zablokované. Zkuste to později.' };
  // limity (F3): 5 žádostí na e-mail za hodinu, 30 na celý web za 10 minut
  if (limit_('kod-web', 'web', KODU_CELKEM_ZA_10_MIN, 600)) return { ok: false, chyba: 'Služba je teď přetížená. Zkuste to za 10 minut.' };
  if (limit_('kod-email', email, KODU_ZA_HODINU, 3600)) return { ok: false, chyba: 'Příliš mnoho žádostí o kód. Zkuste to za hodinu.' };
  const c = CacheService.getScriptCache(), ke = otisk_(email); // klíč mezipaměti z otisku – libovolně dlouhý e-mail ho nerozbije
  const o = opravneni_(email);
  if (!o) { console.log('Kód pro neznámý e-mail.'); return odpoved; } // do tabulky ne – jinak by ji šlo zahltit smyšlenými adresami
  const kod = String(100000 + parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 12), 16) % 900000); // UUID = kryptograficky bezpečná náhoda
  c.put('k_' + ke, JSON.stringify({ h: otisk_(kod), p: 0 }), KOD_PLATNOST_S);
  posta_(email, 'Přihlašovací kód: ' + kod,
    'Dobrý den,\n\nváš kód pro přihlášení do aplikace OSH Praha-západ je:\n\n    ' + kod +
    '\n\nPlatí 10 minut. Pokud jste o kód nežádal/a, zprávu ignorujte.\n\nOSH Praha-západ');
  return odpoved;
}

function overitKod_(email, kod) {
  email = normEmail_(email);
  if (blokovan_(email)) return { ok: false, chyba: 'Po několika chybných kódech je přihlášení na 15 minut zablokované. Zkuste to později.' };
  const c = CacheService.getScriptCache(), ke = otisk_(email), k = JSON.parse(c.get('k_' + ke) || 'null');
  if (!k) return { ok: false, chyba: 'Kód vypršel. Požádejte o nový.' };
  if (!/^\d{6}$/.test(kod.trim()) || k.h !== otisk_(kod.trim())) {
    k.p++;
    if (k.p >= KOD_POKUSU) { c.remove('k_' + ke); zablokovat_(email, BLOKACE_S); return { ok: false, chyba: 'Příliš mnoho chybných pokusů. Přihlášení je na 15 minut zablokované.' }; }
    c.put('k_' + ke, JSON.stringify(k), KOD_PLATNOST_S);
    return { ok: false, chyba: 'Nesprávný kód. Zbývá pokusů: ' + (KOD_POKUSU - k.p) + '.' };
  }
  c.remove('k_' + ke);
  const o = opravneni_(email);
  if (!o) return { ok: false, chyba: 'Přístup byl zrušen.' };
  const token = Utilities.getUuid() + Utilities.getUuid();
  const dny = zverejnuje_(o) ? RELACE_DNY_ZVEREJNOVANI : RELACE_DNY;
  PropertiesService.getScriptProperties().setProperty('s_' + otisk_(token), JSON.stringify({ e: email, x: Date.now() + dny * 864e5 }));
  zaznam_(email, 'přihlášení', 'platnost ' + dny + ' dní');
  posta_(email, 'Právě jste se přihlásil/a',
    'Dobrý den,\n\nprávě proběhlo přihlášení do aplikace OSH Praha-západ (' +
    Utilities.formatDate(new Date(), 'Europe/Prague', 'd. M. yyyy H:mm') + ').\n\nPokud jste to nebyl/a vy, napište ihned na spravci@oshpz.cz.\n\nOSH Praha-západ');
  return { ok: true, token: token, platnostDni: dny, uzivatel: o };
}

/* ---------- relace ---------- */

/** Pro další díly: vrátí oprávnění přihlášeného nebo null. Oprávnění se čte znovu z tabulky při každém volání. */
function prihlaseny_(token) {
  if (!token) return null;
  const p = PropertiesService.getScriptProperties(), klic = 's_' + otisk_(String(token));
  const s = JSON.parse(p.getProperty(klic) || 'null');
  if (!s) return null;
  if (s.x < Date.now()) { p.deleteProperty(klic); return null; }
  const o = opravneni_(s.e);
  if (!o) { p.deleteProperty(klic); return null; } // aktivní: NE → odhlášen okamžitě
  return o;
}

function ja_(token) {
  const o = prihlaseny_(token);
  return o ? { ok: true, uzivatel: o } : { ok: false, chyba: 'Nepřihlášen', odhlasen: true };
}

function odhlasit_(token) {
  if (token) PropertiesService.getScriptProperties().deleteProperty('s_' + otisk_(String(token)));
  return { ok: true };
}

/** Odhlásí všechny – použijte, když je podezření na zneužití. */
function odhlasitVsechny() {
  const p = PropertiesService.getScriptProperties();
  Object.keys(p.getProperties()).filter(k => k.indexOf('s_') === 0).forEach(k => p.deleteProperty(k));
}

/* ---------- pomocné ---------- */

function otisk_(t) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, t, Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
}

// posta_() je v souboru Posta.

function zaznam_(uzivatel, akce, po) {
  const sh = dataSs_().getSheetByName('Záznam změn');
  sh.appendRow([new Date(), uzivatel, 'Přihlášení', '', akce, '', po || ''].map(bezVzorce_));
}

/* ---------- noční údržba ---------- */

function nocniUdrzba() {
  const p = PropertiesService.getScriptProperties(), vse = p.getProperties(), ted = Date.now();
  Object.keys(vse).filter(k => k.indexOf('s_') === 0).forEach(k => { try { if (JSON.parse(vse[k]).x < ted) p.deleteProperty(k); } catch (e) { p.deleteProperty(k); } });
  Object.keys(vse).filter(k => k.indexOf('prm_') === 0 && Number(vse[k]) < ted - 60 * 864e5).forEach(k => p.deleteProperty(k)); // zpracované e-maily s příspěvky
  smazatZapsanaRC();
}

/** Spusťte ručně po každém novém dílu: nastaví všechna automatická spouštění. Lze spouštět opakovaně. */
function nastavitSpousteni() {
  const nase = ['nocniUdrzba', 'kontrolaDokumentu', 'synchronizovatKalendar', 'priUprave', 'poslatOznameni', 'poslatPripominky', 'obnovitClenstvi', 'zalohovat', 'archivovatZaznam', 'obnovitWebData', 'souhrnVypujcekPoTerminu', 'prijmoutPrispevkyEmailem'];
  ScriptApp.getProjectTriggers().filter(t => nase.indexOf(t.getHandlerFunction()) >= 0).forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('nocniUdrzba').timeBased().everyDays(1).atHour(2).inTimezone('Europe/Prague').create();
  const hotovo = ['noční údržba 2:00'];
  if (typeof kontrolaDokumentu === 'function') { ScriptApp.newTrigger('kontrolaDokumentu').timeBased().everyMinutes(15).create(); hotovo.push('dokumenty každých 15 min'); }
  if (typeof synchronizovatKalendar === 'function') {
    ScriptApp.newTrigger('synchronizovatKalendar').timeBased().everyHours(1).create();
    ScriptApp.newTrigger('priUprave').forSpreadsheet(PropertiesService.getScriptProperties().getProperty('TABULKA_ID')).onEdit().create();
    hotovo.push('kalendář každou hodinu', 'při úpravě tabulky');
  }
  if (typeof poslatOznameni === 'function') {
    ScriptApp.newTrigger('poslatOznameni').timeBased().everyMinutes(15).create();
    ScriptApp.newTrigger('poslatPripominky').timeBased().everyDays(1).atHour(7).inTimezone('Europe/Prague').create();
    hotovo.push('oznámení každých 15 min', 'připomínky v 7:00');
  }
  ScriptApp.newTrigger('obnovitClenstvi').timeBased().everyHours(1).create(); hotovo.push('členství skupin každou hodinu');
  ScriptApp.newTrigger('obnovitWebData').timeBased().everyMinutes(5).create(); hotovo.push('data pro web každých 5 min');
  if (typeof souhrnVypujcekPoTerminu === 'function') { ScriptApp.newTrigger('souhrnVypujcekPoTerminu').timeBased().everyDays(1).atHour(7).nearMinute(30).inTimezone('Europe/Prague').create(); hotovo.push('výpůjčky po termínu v 7:30'); }
  if (typeof prijmoutPrispevkyEmailem === 'function') { ScriptApp.newTrigger('prijmoutPrispevkyEmailem').timeBased().everyMinutes(10).create(); hotovo.push('příspěvky z e-mailu každých 10 min'); }
  if (typeof zalohovat === 'function') {
    ScriptApp.newTrigger('zalohovat').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(3).inTimezone('Europe/Prague').create();
    ScriptApp.newTrigger('archivovatZaznam').timeBased().onMonthDay(1).atHour(4).inTimezone('Europe/Prague').create();
    hotovo.push('záloha v neděli 3:00', 'archiv záznamu změn 1. den v měsíci');
  }
  console.log('Spouštění nastaveno: ' + hotovo.join(', ') + '.');
}

/** Diagnostika: v Apps Script vyberte tuto funkci, Spustit, a podívejte se do Protokolu provádění. */
function zkontrolovatUzivatele() {
  const radky = radky_('Uživatelé');
  console.log('Řádků v listu Uživatelé: ' + radky.length);
  radky.forEach(r => console.log(JSON.stringify({ email: r['E-mail'], normalizovany: normEmail_(r['E-mail']), aktivni: r['Aktivní'], aktivniOK: ano_(r['Aktivní']) })));
  const ja = Session.getActiveUser().getEmail();
  console.log('Vy (' + ja + '): ' + JSON.stringify(opravneni_(ja)));
  const c = clenstvi_(); console.log('Členství skupin sdh-…@: ' + c.length + ' záznamů, příklad: ' + JSON.stringify(c.slice(0, 3)));
}
