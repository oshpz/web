/**
 * Skupiny OSH Praha-západ - založení a synchronizace Google skupin podle listu „Sbory“.
 *
 * Co dělá:
 *  - pro každý aktivní sbor založí skupinu sdh-…@oshpz.cz a přidá do ní kontakty ze sloupce Kontakty,
 *  - založí souhrnné skupiny sbory@, sbory-mh@, sbory-jsdh@, sbory-sport@ a okrsek-01@ … okrsek-14@,
 *  - sbory@ = všechny okrsky, okrsek-XX@ = sbory okrsku; sbory-mh@, sbory-jsdh@, sbory-sport@ přímo ze sborů podle vlastností,
 *  - při změně v tabulce skupiny sám přeřadí,
 *  - nic nemaže: skupiny mimo tabulku i lidi navíc jen zapíše do listu „Protokol“.
 *
 * Potřebuje rozšířené služby (Služby → +): Admin SDK API (AdminDirectory) a Groups Settings API (AdminGroupsSettings).
 * Spouští správce Workspace. Vždy nejdřív „Náhled změn“.
 */

const CFG = {
  DOMAIN: 'oshpz.cz',
  TABULKA_ID: '',        // vyplňte jen u samostatného skriptu: ID tabulky z adresy .../spreadsheets/d/<ID>/edit
  LIST: 'Sbory',
  LOG: 'Protokol',
  ODEBIRAT_LIDI: false,   // true = lidé, kteří nejsou ve sloupci Kontakty, se ze sborové skupiny odeberou
  PAUZA_MS: 150
};

const SOUHRNNE = [
  { email: 'sbory',       nazev: 'Všechny sbory - OSH Praha-západ',        test: r => true },
  { email: 'sbory-mh',    nazev: 'Sbory s mladými hasiči - OSH Praha-západ', test: r => r.mh },
  { email: 'sbory-jsdh',  nazev: 'Sbory s výjezdovou jednotkou - OSH Praha-západ', test: r => r.jsdh },
  { email: 'sbory-sport', nazev: 'Sbory se soutěžními družstvy - OSH Praha-západ', test: r => r.sport }
];

function onOpen() {
  const ui = ui_();
  if (!ui) return; // skript není vložený v tabulce - funkce spouštějte z editoru
  ui.createMenu('Skupiny OSH')
    .addItem('1. Náhled změn (nic nemění)', 'nahled')
    .addItem('2. Provést změny', 'provest')
    .addSeparator()
    .addItem('Nastavit pravidla všech skupin', 'pravidlaVsech')
    .addToUi();
}

function ui_() { try { return SpreadsheetApp.getUi(); } catch (e) { return null; } }

function tabulka_() {
  const ss = CFG.TABULKA_ID ? SpreadsheetApp.openById(CFG.TABULKA_ID) : SpreadsheetApp.getActive();
  if (!ss) throw new Error('Skript není vložený v tabulce. Vložte ho přes Rozšíření > Apps Script v tabulce, nebo vyplňte CFG.TABULKA_ID.');
  return ss;
}

function oznam_(text) { try { tabulka_().toast(text, 'Skupiny OSH', 8); } catch (e) {} console.log(text); }

function nahled() { synchronizovat_(true); }

function provest() {
  const ui = ui_();
  if (ui && ui.alert('Provést změny ve skupinách?', 'Zkontrolovali jste náhled v listu Protokol?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  synchronizovat_(false);
}

/* ---------- hlavní běh ---------- */

function synchronizovat_(nanecisto) {
  const log = protokol_(nanecisto);
  try {
    synchronizovatVnitrek_(nanecisto, log);
  } catch (e) {
    log('CHYBA', '', String(e && e.message || e));
    log.flush();
    oznam_('Chyba: ' + (e && e.message || e));
    throw e;
  }
  log.flush();
}

function synchronizovatVnitrek_(nanecisto, log) {
  log('start', '', 'list ' + CFG.LIST + ', doména ' + CFG.DOMAIN);
  const sbory = nactiSbory_();
  log('načteno', '', sbory.length + ' sborů z tabulky');
  if (!sbory.length) throw new Error('V listu „' + CFG.LIST + '“ nejsou žádné řádky s vyplněným sloupcem Skupina.');
  const chtene = chteneSkupiny_(sbory);
  if (typeof AdminDirectory === 'undefined') throw new Error('Chybí služba Admin SDK API (AdminDirectory). Přidejte ji vlevo v části Služby.');
  if (typeof AdminGroupsSettings === 'undefined') throw new Error('Chybí služba Groups Settings API (AdminGroupsSettings). Přidejte ji vlevo v části Služby.');
  const existujici = existujiciSkupiny_();
  log('načteno', '', Object.keys(existujici).length + ' existujících skupin v doméně');
  let zmen = 0;

  Object.keys(chtene).forEach(email => {
    const g = chtene[email];
    try {
      if (!existujici[email]) {
        log('založit skupinu', email, g.nazev);
        zmen++;
        if (!nanecisto) {
          AdminDirectory.Groups.insert({ email, name: g.nazev, description: g.popis });
          Utilities.sleep(2000); // Google potřebuje chvíli, než skupinu zpřístupní
          nastavPravidla_(email, g.typ);
        }
      }
      const clenove = existujici[email] ? clenoveSkupiny_(email) : {};
      const chci = {};
      g.skupiny.forEach(m => chci[m] = 'GROUP');
      g.lide.forEach(m => chci[m] = 'USER');

      Object.keys(chci).forEach(m => {
        if (clenove[m]) return;
        log('přidat člena', email, m + (chci[m] === 'GROUP' ? ' (skupina)' : ''));
        zmen++;
        if (!nanecisto) pridej_(email, m, log);
      });

      Object.keys(clenove).forEach(m => {
        if (chci[m]) return;
        const c = clenove[m];
        if (c.role !== 'MEMBER') return; // vlastníky a správce skupiny nikdy neodebírat
        const jeSborova = c.type === 'GROUP' && /^(sdh-|okrsek-)/.test(m);
        if (g.typ === 'souhrnna' && jeSborova) {
          log('odebrat sbor', email, m);
          zmen++;
          if (!nanecisto) AdminDirectory.Members.remove(email, m);
        } else if (g.typ === 'sbor' && c.type === 'USER') {
          if (CFG.ODEBIRAT_LIDI) {
            log('odebrat člena', email, m);
            zmen++;
            if (!nanecisto) AdminDirectory.Members.remove(email, m);
          } else {
            log('upozornění', email, m + ' je ve skupině, ale ne ve sloupci Kontakty (neodebráno)');
          }
        } else {
          log('upozornění', email, m + ' - člen navíc, ponechán');
        }
      });
    } catch (e) {
      log('CHYBA', email, String(e && e.message || e));
    }
    Utilities.sleep(CFG.PAUZA_MS);
  });

  // Skupiny se jmény z naší řady, které v tabulce nejsou - jen hlášení, nic se nemaže.
  Object.keys(existujici).forEach(email => {
    if (chtene[email]) return;
    if (/^(sdh-|okrsek-|sbory)/.test(email.split('@')[0])) log('upozornění', email, 'existuje, ale není v tabulce (nesmazáno)');
  });

  log(nanecisto ? 'NÁHLED HOTOV' : 'HOTOVO', '', zmen + ' změn');
  oznam_((nanecisto ? 'Náhled: ' : 'Provedeno: ') + zmen + ' změn. Podrobnosti v listu Protokol.');
}

/* ---------- data z tabulky ---------- */

function nactiSbory_() {
  const ss = tabulka_();
  const sh = ss.getSheetByName(CFG.LIST) || ss.getSheets().find(x => x.getName() !== CFG.LOG);
  if (!sh) throw new Error('Chybí list „' + CFG.LIST + '“.');
  const data = sh.getDataRange().getValues();
  const h = data[0].map(x => String(x).trim().toLowerCase());
  const col = n => { const i = h.indexOf(n.toLowerCase()); if (i < 0) throw new Error('Chybí sloupec „' + n + '“.'); return i; };
  const C = { sbor: col('Sbor'), skupina: col('Skupina'), okrsek: col('Okrsek'), mh: col('MH'), jsdh: col('JSDH'), sport: col('Sport'), aktivni: col('Aktivní'), kontakty: col('Kontakty') };
  const ano = v => /^(ano|a|x|1|true|yes)$/i.test(String(v).trim());
  return data.slice(1).filter(r => String(r[C.skupina]).trim()).map(r => ({
    sbor: String(r[C.sbor]).trim(),
    email: plnyEmail_(String(r[C.skupina]).trim().toLowerCase()),
    okrsek: parseInt(r[C.okrsek], 10) || 0,
    mh: ano(r[C.mh]), jsdh: ano(r[C.jsdh]), sport: ano(r[C.sport]),
    aktivni: String(r[C.aktivni]).trim() === '' ? true : ano(r[C.aktivni]),
    kontakty: String(r[C.kontakty]).split(/[\s,;]+/).map(x => x.trim().toLowerCase()).filter(x => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x))
  }));
}

function chteneSkupiny_(sbory) {
  const out = {};
  const aktivni = sbory.filter(r => r.aktivni);
  aktivni.forEach(r => {
    out[r.email] = { typ: 'sbor', nazev: r.sbor, popis: r.sbor + ' - adresa sboru pro informace z OSH Praha-západ. Spravuje okres.', skupiny: [], lide: r.kontakty };
  });
  // Okrsky dřív než souhrnné skupiny: sbory@ je skládá z okrsků, takže musí existovat první.
  const okrsky = {};
  aktivni.forEach(r => { if (r.okrsek) (okrsky[r.okrsek] = okrsky[r.okrsek] || []).push(r.email); });
  const okrskoveSkupiny = [];
  Object.keys(okrsky).sort((a, b) => a - b).forEach(k => {
    const e = plnyEmail_('okrsek-' + ('0' + k).slice(-2));
    okrskoveSkupiny.push(e);
    out[e] = { typ: 'souhrnna', nazev: 'Okrsek ' + k + ' - OSH Praha-západ', popis: 'Sbory ' + k + '. okrsku, sestavuje se automaticky z tabulky sborů.', skupiny: okrsky[k], lide: [] };
  });
  const bezOkrsku = aktivni.filter(r => !r.okrsek).map(r => r.email);
  SOUHRNNE.forEach(s => {
    // sbory@ = všechny okrsky (+ sbory bez okrsku); ostatní souhrnné skupiny přímo ze sborů podle vlastností.
    const skupiny = s.email === 'sbory' ? okrskoveSkupiny.concat(bezOkrsku) : aktivni.filter(s.test).map(r => r.email);
    out[plnyEmail_(s.email)] = { typ: 'souhrnna', nazev: s.nazev, popis: 'Souhrnná skupina, sestavuje se automaticky z tabulky sborů. Psát smí jen okres.', skupiny, lide: [] };
  });
  return out;
}

/* ---------- Google skupiny ---------- */

function existujiciSkupiny_() {
  const out = {};
  let token;
  do {
    const res = AdminDirectory.Groups.list({ domain: CFG.DOMAIN, maxResults: 200, pageToken: token });
    (res.groups || []).forEach(g => out[g.email.toLowerCase()] = g);
    token = res.nextPageToken;
  } while (token);
  return out;
}

function clenoveSkupiny_(email) {
  const out = {};
  let token;
  do {
    const res = AdminDirectory.Members.list(email, { maxResults: 200, pageToken: token });
    (res.members || []).forEach(m => { if (m.email) out[m.email.toLowerCase()] = { role: m.role, type: m.type }; });
    token = res.nextPageToken;
  } while (token);
  return out;
}

function pridej_(skupina, email, log) {
  try {
    AdminDirectory.Members.insert({ email, role: 'MEMBER' }, skupina);
  } catch (e) {
    const msg = String(e && e.message || e);
    if (/already exists|duplicate/i.test(msg)) return;
    log('CHYBA', skupina, 'nelze přidat ' + email + ': ' + msg);
  }
  Utilities.sleep(CFG.PAUZA_MS);
}

function nastavPravidla_(email, typ) {
  const spolecne = {
    allowExternalMembers: 'true',          // osobní e-maily lidí ze sborů (seznam.cz, gmail…)
    whoCanJoin: 'INVITED_CAN_JOIN',        // nikdo se nepřihlásí sám, členy přidává okres / skript
    whoCanViewMembership: 'ALL_MANAGERS_CAN_VIEW',
    whoCanViewGroup: 'ALL_MANAGERS_CAN_VIEW',
    replyTo: 'REPLY_TO_SENDER',            // odpověď jde odesílateli, ne celé skupině
    messageModerationLevel: 'MODERATE_NONE',
    spamModerationLevel: 'MODERATE',       // podezřelé zprávy čekají na schválení
    allowWebPosting: 'false',
    isArchived: 'true'
  };
  const zvlast = typ === 'souhrnna'
    ? { whoCanPostMessage: 'ALL_IN_DOMAIN_CAN_POST', includeInGlobalAddressList: 'true' }   // psát smí jen účty @oshpz.cz
    : { whoCanPostMessage: 'ANYONE_CAN_POST', includeInGlobalAddressList: 'true' };       // sboru může napsat i obec nebo HZS
  AdminGroupsSettings.Groups.patch(Object.assign({}, spolecne, zvlast), email);
}

function pravidlaVsech() {
  const log = protokol_(false);
  const chtene = chteneSkupiny_(nactiSbory_());
  const existujici = existujiciSkupiny_();
  Object.keys(chtene).forEach(email => {
    if (!existujici[email]) return;
    try { nastavPravidla_(email, chtene[email].typ); log('pravidla nastavena', email, chtene[email].typ); }
    catch (e) { log('CHYBA', email, String(e && e.message || e)); }
    Utilities.sleep(CFG.PAUZA_MS);
  });
  log.flush();
  oznam_('Pravidla nastavena. Podrobnosti v listu Protokol.');
}

/* ---------- pomocné ---------- */

function plnyEmail_(x) { return x.indexOf('@') > 0 ? x : x + '@' + CFG.DOMAIN; }

function protokol_(nanecisto) {
  const ss = tabulka_();
  const sh = ss.getSheetByName(CFG.LOG) || ss.insertSheet(CFG.LOG);
  if (sh.getLastRow() === 0) sh.appendRow(['Čas', 'Režim', 'Akce', 'Skupina', 'Podrobnosti']);
  const rezim = nanecisto ? 'náhled' : 'ostře';
  const buf = [];
  const flush = () => { if (buf.length) { sh.getRange(sh.getLastRow() + 1, 1, buf.length, 5).setValues(buf); buf.length = 0; SpreadsheetApp.flush(); } };
  const fn = (akce, skupina, detail) => {
    buf.push([new Date(), rezim, akce, skupina, detail]);
    console.log(akce + ' | ' + skupina + ' | ' + detail);
    if (buf.length >= 50 || /HOTOV|CHYBA/.test(akce)) flush();
  };
  fn.flush = flush;
  return fn;
}
