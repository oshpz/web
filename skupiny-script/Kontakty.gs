/**
 * Kontakty sborů (R5) a jejich převzetí do skupin (B11). Druhý soubor ve skriptu tabulky „Skupiny OSH“ (vedle Skupiny.gs).
 * Sběr schválil VV 10. 10. 2026.
 *
 * 1. vytvoritFormular()   – Google formulář „Kontakty sboru pro OSH Praha-západ“ (veřejný odkaz, bez přihlášení, stránky
 *                          s podmínkami pro JSDH a MH), odpovědi do listu „Formulář – odpovědi“. Opakované spuštění formulář
 *                          nezakládá znovu, obnoví text a seznam sborů (bez odpovědí i otázky). prestavitFormular() = přestavba
 *                          otázek se smazáním zkušebních odpovědí (jen před rozesláním).
 * 2. pripravitKontrolu()  – poslední odpověď za každý sbor → list „Ke kontrole“ (návrh přidání / odebrání, změny vlastností,
 *                          upozornění). Nikdy nic nemění ve skupinách.
 * 3. prevzitSchvalene()   – řádky se zaškrtnutým „Schváleno“: přidá členy do sdh-…@, odebere jen potvrzené (ANO),
 *                          zapíše vlastnosti a Kontakty do listu Sbory (zde i v OSH data TEST), přeřadí sbor v sbory-mh@ /
 *                          sbory-jsdh@ / sbory-sport@. Vše do listu Protokol.
 * 4. prehledVyplneni()    – sbory bez odpovědi podle okrsků (pro připomínání).
 * Potřebuje služby Admin SDK API (AdminDirectory) – už přidaná kvůli Skupiny.gs.
 */

const KONT = {
  OSH_DATA_ID: '1efB7L11PVpybZi_j-YILtJ_U3sCP58ESg3eKqKJP0Tg',     // OSH data TEST (list Sbory, sloupec Kontakty)
  ARES_URL: 'https://test.oshpz.cz/data/sbory-ares.js',           // IČO sborů podle ARES (snapshot z webu)
  SPRAVCI: 'spravci@oshpz.cz',
  LIST_ODPOVEDI: 'Formulář – odpovědi', LIST_KONTROLA: 'Ke kontrole', LIST_PREHLED: 'Přehled vyplnění',
  NAZEV: 'Kontakty sboru pro OSH Praha-západ',
  // funkce: [název, stránka] – stránka určuje, kde se ve formuláři ptáme (JSDH a MH jen při ANO)
  FUNKCE: [['Starosta', 'vedeni'], ['Velitel sboru', 'vedeni'], ['Jednatel', 'vedeni'], ['Pokladník', 'vedeni'],
    ['Velitel jednotky (JSDH)', 'jsdh'], ['Vedoucí mladých hasičů', 'mh']],
  SOUHRNNE: { mh: 'sbory-mh', jsdh: 'sbory-jsdh', sport: 'sbory-sport' }
};
// Názvy otázek – podle nich se čtou odpovědi. Neměnit, nebo změnit i ve formuláři (prestavitFormular).
const OT = {
  sbor: 'Sbor', vyplnJmeno: 'Vaše jméno a příjmení', vyplnFunkce: 'Vaše funkce ve sboru', vyplnEmail: 'Váš e-mail',
  jmeno: f => f + ' – jméno a příjmení', email: f => f + ' – e-mail',
  dalsiMH: 'Další vedoucí a instruktoři mladých hasičů – e-maily', dalsi: 'Další lidé ze sboru – e-maily',
  jsdh: 'Má sbor výjezdovou jednotku (JSDH)?', mh: 'Má sbor oddíl mladých hasičů?', sport: 'Má sbor soutěžní družstvo dospělých?',
  ico: 'IČO sboru', web: 'Web sboru', ucet: 'Číslo účtu sboru', souhlas: 'Souhlas'
};
// Úvodní text formuláře – nastaví se při každém spuštění vytvoritFormular (i u existujícího formuláře).
const POPIS_FORMULARE =
  'Dobrý den,\n\n' +
  'připravujeme nový web OSH Praha-západ a aplikaci pro komunikaci mezi okresem a sbory. Prosíme vás proto o kontakty ' +
  'na funkcionáře vašeho sboru. Vyplnění zabere asi 5 minut.\n\n' +
  'Co s kontakty uděláme:\n' +
  '• Každý sbor dostane vlastní e-mailovou adresu sdh-…@oshpz.cz. Okres na ni bude nově posílat informace, pozvánky ' +
  'a připomínky termínů – zprávu dostanou všichni, koho uvedete.\n' +
  '• Každý, koho uvedete, se bude moci přihlásit do aplikace Spojka (kódem zaslaným na e-mail, bez hesla).\n' +
  '• Údaje budeme v budoucnu automaticky předvyplňovat tam, kde budou potřeba – např. v přihláškách na soutěže nebo v žádostech.\n\n' +
  // text upravený ve formuláři 15. 10. 2026 po dohodě s Petrou Myslínovou (souhlas se zveřejněním kontaktů výboru na webu)
  'Vyplněním dotazníku souhlasí sbor s uvedením kontaktů členů výboru sboru na webu OSH Praha - západ.\n' +
  'Později lze kontakty upravit v aplikaci, v části svého sboru. Do té doby použijte odkaz na úpravu odpovědi (zobrazí se po odeslání) ' +
  'nebo napište na spravci@oshpz.cz – tam lze kdykoli požádat i o smazání kontaktu.\n\n' +
  'Děkujeme!\nOSH Praha-západ';
const POTVRZENI = 'Děkujeme, kontakty jsme přijali. Pokud budete chtít údaje změnit, použijte odkaz „Upravit odpověď“ níže – uložte si ho. Dotazy: spravci@oshpz.cz';
const EMAIL_VZOR = /^[^@\s<>"',;]+@[^@\s<>"',;]+\.[^@\s<>"',;]{2,}$/;

function kontaktyMenu_(ui) {
  ui.createMenu('Kontakty sborů')
    .addItem('1. Vytvořit formulář / obnovit text a seznam sborů', 'vytvoritFormular')
    .addItem('2. Připravit kontrolu odpovědí', 'pripravitKontrolu')
    .addItem('3. Převzít schválené do skupin', 'prevzitSchvalene')
    .addSeparator()
    .addItem('Přehled vyplnění podle okrsků', 'prehledVyplneni')
    .addToUi();
}

/** Kontakty jsou osobní údaje: tabulka nesmí být sdílená odkazem (kdokoli s odkazem / veřejně). */
function hlidatSdileni_() {
  const ss = tabulka_();
  let pristup;
  try { pristup = DriveApp.getFileById(ss.getId()).getSharingAccess(); } catch (e) { console.warn('Sdílení tabulky nejde ověřit: ' + e.message); return; }
  if (pristup === DriveApp.Access.ANYONE || pristup === DriveApp.Access.ANYONE_WITH_LINK)
    throw new Error('Tabulka „' + ss.getName() + '“ je sdílená odkazem – kontakty sborů by viděl kdokoli s odkazem. ' +
      'Omezte sdílení: v tabulce Sdílet → Obecný přístup → Omezený → Hotovo. Pak spusťte znovu.');
}

/* ---------- 1. formulář ---------- */

/** Vlastnosti pro ID formuláře: skript je samostatný (ne v tabulce), dokumentové vlastnosti tu nejsou. */
function vlastnosti_() { return PropertiesService.getDocumentProperties() || PropertiesService.getScriptProperties(); }

/** Už existující formulář: podle uloženého ID, jinak podle listu tabulky, do kterého formulář posílá odpovědi. */
function existujiciFormular_(ss) {
  const p = vlastnosti_(), id = p.getProperty('KONTAKTY_FORM_ID');
  if (id) { try { return FormApp.openById(id); } catch (e) { console.warn('Uložený formulář nejde otevřít: ' + e.message); } }
  for (const sh of ss.getSheets()) {
    let url = null; try { url = sh.getFormUrl(); } catch (e) {}
    if (!url) continue;
    try { const f = FormApp.openByUrl(url); if (f.getTitle() === KONT.NAZEV) { p.setProperty('KONTAKTY_FORM_ID', f.getId()); return f; } } catch (e) {}
  }
  return null;
}

function listOdpovedi_(ss, form) {
  return ss.getSheets().find(sh => { try { return sh.getFormUrl() && FormApp.openByUrl(sh.getFormUrl()).getId() === form.getId(); } catch (e) { return false; } }) || null;
}

/** Dokončení nastavení (i u formuláře založeného dřív): název listu s odpověďmi, sdílení se spravci@. */
function dokoncitFormular_(ss, form) {
  const listOdp = listOdpovedi_(ss, form);
  if (listOdp && listOdp.getName() !== KONT.LIST_ODPOVEDI && !ss.getSheetByName(KONT.LIST_ODPOVEDI)) listOdp.setName(KONT.LIST_ODPOVEDI);
  try { const f = DriveApp.getFileById(form.getId()); if (!f.getEditors().some(u => u.getEmail().toLowerCase() === KONT.SPRAVCI)) f.addEditor(KONT.SPRAVCI); }
  catch (e) { console.warn('Sdílení se ' + KONT.SPRAVCI + ': ' + e.message); }
}

/** Nastavení formuláře a úvodní text (vždy). */
function nastavitFormular_(form) {
  form.setTitle(KONT.NAZEV).setDescription(POPIS_FORMULARE).setConfirmationMessage(POTVRZENI);
  // nesbírat e-maily a nevyžadovat přihlášení – veřejný odkaz, sbory nemají Google účty
  try { form.setEmailCollectionType(FormApp.EmailCollectionType.DO_NOT_COLLECT); } catch (e) { form.setCollectEmail(false); }
  try { form.setRequireLogin(false); } catch (e) {}
  try { form.setLimitOneResponsePerUser(false); } catch (e) {}
  form.setAllowResponseEdits(true).setShowLinkToRespondAgain(false).setProgressBar(true);
}

/**
 * Otázky po stránkách. JSDH a MH s podmínkou: kontakty na velitele jednotky / vedoucí MH jen při ANO.
 *   1 Sbor a kdo vyplňuje → 2 Vedení sboru (+ otázka JSDH) → [3 Výjezdová jednotka] → 4 Mladí hasiči (otázka MH)
 *   → [5 Vedoucí mladých hasičů] → 6 Údaje o sboru, další lidé, souhlas
 */
function sestavitOtazky_(form, sbory) {
  form.getItems().forEach(i => form.deleteItem(i));
  const email = (it, pomoc) => it.setHelpText(pomoc || '').setValidation(FormApp.createTextValidation().setHelpText('Zadejte platný e-mail, např. jan.novak@seznam.cz').requireTextIsEmail().build());
  const seznamEmailu = it => it.setValidation(FormApp.createParagraphTextValidation().setHelpText('Jen e-mailové adresy oddělené čárkou.')
    .requireTextMatchesPattern('^\\s*[^@\\s,;]+@[^@\\s,;]+\\.[^@\\s,;]+(\\s*[,;]\\s*[^@\\s,;]+@[^@\\s,;]+\\.[^@\\s,;]+)*\\s*[,;]?\\s*$').build());
  const funkce = stranka => KONT.FUNKCE.filter(f => f[1] === stranka).forEach(([f]) => {
    form.addTextItem().setTitle(OT.jmeno(f));
    email(form.addTextItem().setTitle(OT.email(f)));
  });

  // 1 – sbor a kdo vyplňuje
  form.addListItem().setTitle(OT.sbor).setHelpText('Vyberte svůj sbor ze seznamu.').setChoiceValues(sbory).setRequired(true);
  form.addSectionHeaderItem().setTitle('Kdo formulář vyplňuje');
  form.addTextItem().setTitle(OT.vyplnJmeno).setRequired(true);
  form.addTextItem().setTitle(OT.vyplnFunkce).setHelpText('Např. starosta, jednatel.').setRequired(true);
  email(form.addTextItem().setTitle(OT.vyplnEmail).setRequired(true),
    'Osobní e-mail (seznam.cz, gmail.com…). Do aplikace se budete moci přihlásit vy i všichni další, koho ve formuláři uvedete.');

  // 2 – vedení sboru + otázka JSDH (rozcestí)
  const pVedeni = form.addPageBreakItem().setTitle('Vedení sboru')
    .setHelpText('Vyplňte, kdo funkci zastává. Nevyplněné kolonky nevadí. Pokud jednu funkci zastáváte vy, uveďte se i tady.');
  funkce('vedeni');
  const otJsdh = form.addMultipleChoiceItem().setTitle(OT.jsdh).setRequired(true);

  // 3 – výjezdová jednotka (jen při ANO)
  const pJsdh = form.addPageBreakItem().setTitle('Výjezdová jednotka (JSDH)').setHelpText('Kontakt na velitele jednotky. Nevyplněné kolonky nevadí.');
  funkce('jsdh');

  // 4 – mladí hasiči: otázka MH (rozcestí)
  const pMhOtazka = form.addPageBreakItem().setTitle('Mladí hasiči');
  const otMh = form.addMultipleChoiceItem().setTitle(OT.mh).setRequired(true);

  // 5 – vedoucí mladých hasičů (jen při ANO)
  const pMh = form.addPageBreakItem().setTitle('Vedoucí mladých hasičů').setHelpText('Informace o soutěžích a akcích mládeže budou chodit i jim. Nevyplněné kolonky nevadí.');
  funkce('mh');
  seznamEmailu(form.addParagraphTextItem().setTitle(OT.dalsiMH).setHelpText('Další vedoucí a instruktoři. E-maily oddělte čárkou.'));

  // 6 – údaje o sboru, další lidé, souhlas
  const pUdaje = form.addPageBreakItem().setTitle('Údaje o sboru a další lidé');
  form.addMultipleChoiceItem().setTitle(OT.sport).setHelpText('Podle toho budeme posílat informace o soutěžích dospělých.').setChoiceValues(['ANO', 'NE']).setRequired(true);
  seznamEmailu(form.addParagraphTextItem().setTitle(OT.dalsi)
    .setHelpText('Další lidé, kteří mají dostávat informace z okresu a přihlašovat se do aplikace (např. zástupce velitele, členové výboru). E-maily oddělte čárkou.'));
  form.addTextItem().setTitle(OT.ico).setHelpText('8 číslic.')
    .setValidation(FormApp.createTextValidation().setHelpText('IČO má 8 číslic.').requireTextMatchesPattern('^\\s*\\d{6,8}\\s*$').build());
  form.addTextItem().setTitle(OT.web).setHelpText('Adresa webu nebo Facebooku sboru, např. https://www.sdh-obec.cz')
    .setValidation(FormApp.createTextValidation().setHelpText('Zadejte adresu začínající https:// nebo http://').requireTextIsUrl().build());
  form.addTextItem().setTitle(OT.ucet).setHelpText('Pro QR platby členských příspěvků, např. 123456789/0800.')
    .setValidation(FormApp.createTextValidation().setHelpText('Číslo účtu ve tvaru [předčíslí-]číslo/kód banky, např. 123456789/0800.').requireTextMatchesPattern('^\\s*(\\d{1,6}-)?\\d{2,10}\\s*/\\s*\\d{4}\\s*$').build());
  form.addCheckboxItem().setTitle(OT.souhlas).setChoiceValues(['Potvrzuji, že uvedení lidé o předání svého kontaktu okresu vědí.']).setRequired(true);

  // rozcestí a návaznosti stránek
  otJsdh.setChoices([otJsdh.createChoice('ANO', pJsdh), otJsdh.createChoice('NE', pMhOtazka)]);
  otMh.setChoices([otMh.createChoice('ANO', pMh), otMh.createChoice('NE', pUdaje)]);
  pJsdh.setGoToPage(pMhOtazka);
  pMh.setGoToPage(pUdaje);
}

/** Napojení na tabulku s čistým listem odpovědí (starý list s jinými sloupci se odpojí a smaže). */
function napojitOdpovedi_(ss, form) {
  const stary = listOdpovedi_(ss, form);
  try { form.removeDestination(); } catch (e) {}
  if (stary) { try { ss.deleteSheet(stary); } catch (e) { console.warn('Starý list odpovědí nejde smazat: ' + e.message); } }
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();
}

function sboryProFormular_() {
  const s = nactiSbory_().filter(r => r.aktivni).map(r => r.sbor).sort((a, b) => a.localeCompare(b, 'cs'));
  if (!s.length) throw new Error('V listu Sbory nejsou aktivní sbory.');
  return s;
}

/**
 * Založí formulář, nebo u existujícího obnoví úvodní text a seznam sborů. Dokud formulář nemá žádné odpovědi,
 * sestaví znovu i otázky (úpravy v kódu se tak propíšou). S odpověďmi otázky nemění – viz prestavitFormular.
 */
function vytvoritFormular() {
  hlidatSdileni_();
  const ss = tabulka_(), p = vlastnosti_(), sbory = sboryProFormular_();
  let form = existujiciFormular_(ss);
  if (form) {
    nastavitFormular_(form);
    const pocet = form.getResponses().length;
    if (!pocet) { sestavitOtazky_(form, sbory); napojitOdpovedi_(ss, form); }
    else { const it = form.getItems(FormApp.ItemType.LIST).find(i => i.getTitle() === OT.sbor); if (it) it.asListItem().setChoiceValues(sbory); }
    dokoncitFormular_(ss, form);
    vypsatOdkazy_(form, 'Formulář už existuje – úvodní text a seznam sborů (' + sbory.length + ') obnoveny' +
      (pocet ? '. Má ' + pocet + ' odpovědí, otázky se proto neměnily (přestavba: prestavitFormular).' : ', otázky sestaveny znovu.'));
    return;
  }
  form = FormApp.create(KONT.NAZEV);
  p.setProperty('KONTAKTY_FORM_ID', form.getId());
  nastavitFormular_(form);
  sestavitOtazky_(form, sbory);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();
  dokoncitFormular_(ss, form);
  const log = protokol_(false); log('formulář založen', '', form.getEditUrl()); log.flush();
  vypsatOdkazy_(form, 'Formulář založen.');
}

/** Přestavba otázek u formuláře, který už má odpovědi: SMAŽE VŠECHNY ODPOVĚDI (jen pro zkušební odpovědi před rozesláním). */
function prestavitFormular() {
  hlidatSdileni_();
  const ss = tabulka_(), form = existujiciFormular_(ss);
  if (!form) throw new Error('Formulář ještě neexistuje – spusťte vytvoritFormular.');
  const pocet = form.getResponses().length;
  const ui = ui_();
  if (ui && pocet && ui.alert('Přestavět formulář?', 'Smaže se ' + pocet + ' odpovědí. Jen pro zkušební odpovědi před rozesláním sborům!', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  form.deleteAllResponses();
  nastavitFormular_(form);
  sestavitOtazky_(form, sboryProFormular_());
  napojitOdpovedi_(ss, form);
  dokoncitFormular_(ss, form);
  const log = protokol_(false); log('formulář přestavěn', '', 'smazáno odpovědí: ' + pocet); log.flush();
  vypsatOdkazy_(form, 'Formulář přestavěn (smazáno ' + pocet + ' zkušebních odpovědí). Odkaz pro sbory se nemění.');
}

function vypsatOdkazy_(form, uvod) {
  const text = uvod + '\n\nOdkaz pro sbory (vyplnění):\n' + form.getPublishedUrl() + '\n\nÚprava formuláře:\n' + form.getEditUrl() +
    '\n\nSdíleno k úpravám se ' + KONT.SPRAVCI + '. Odpovědi: list „' + KONT.LIST_ODPOVEDI + '“.';
  console.log(text); // samostatný skript: odkazy jsou v Protokolu provádění
  const ui = ui_(); if (ui) { try { ui.alert('Kontakty sborů', text, ui.ButtonSet.OK); } catch (e) {} }
}

function formular_() {
  const f = existujiciFormular_(tabulka_());
  if (!f) throw new Error('Formulář ještě neexistuje – spusťte vytvoritFormular.');
  return f;
}

/* ---------- 2. kontrola ---------- */

/** Poslední odpověď za sbor (podle času odeslání / poslední úpravy). */
function posledniOdpovedi_() {
  const out = {};
  formular_().getResponses().forEach(r => {
    const o = { cas: r.getTimestamp(), odpovedi: {} };
    r.getItemResponses().forEach(ir => { const v = ir.getResponse(); o.odpovedi[ir.getItem().getTitle()] = Array.isArray(v) ? v.join(', ') : String(v == null ? '' : v).trim(); });
    const sbor = PREJMENOVANE_SBORY[o.odpovedi[OT.sbor]] || o.odpovedi[OT.sbor]; // odpověď ještě se starým názvem (Prejmenovani.gs)
    if (sbor && (!out[sbor] || out[sbor].cas < o.cas)) out[sbor] = o;
  });
  return out;
}

function emaily_(text) { return String(text || '').split(/[\s,;]+/).map(x => x.trim().toLowerCase().replace(/^mailto:/, '')).filter(Boolean); }

/** Navržení členové z odpovědi + neplatné e-maily. */
function navrzeni_(odp) {
  const vse = [odp[OT.vyplnEmail]].concat(KONT.FUNKCE.map(f => odp[OT.email(f[0])])).concat([odp[OT.dalsiMH], odp[OT.dalsi]]);
  const platne = [], neplatne = [];
  vse.forEach(t => emaily_(t).forEach(e => { (EMAIL_VZOR.test(e) ? platne : neplatne).push(e); }));
  return { platne: platne.filter((x, i, a) => a.indexOf(x) === i), neplatne };
}

const jmenoKlic_ = t => String(t || '').replace(/^SDH\s+/i, '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const ano_ = v => /^(ano|a|x|1|true|yes)$/i.test(String(v == null ? '' : v).trim());

function aresIco_() {
  try {
    const t = UrlFetchApp.fetch(KONT.ARES_URL, { muteHttpExceptions: true }).getContentText();
    const m = t.match(/OSH_SBORY_ARES\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
    const j = JSON.parse(m[1]), out = {};
    Object.keys(j).forEach(k => { if (j[k] && j[k].ico) out[jmenoKlic_(k)] = String(j[k].ico); });
    return out;
  } catch (e) { console.warn('ARES data nejde načíst: ' + e.message); return null; }
}

/** Řádky listu Sbory v OSH data TEST (IČO, web, účet, Kontakty). */
function oshSbory_() {
  const sh = SpreadsheetApp.openById(KONT.OSH_DATA_ID).getSheetByName('Sbory');
  const v = sh.getDataRange().getValues(), h = v[0].map(x => String(x).trim());
  return { sh, h, rows: v.slice(1), najdi: (sbor, skupina) => v.slice(1).findIndex(r => (skupina && String(r[h.indexOf('Skupina')] || '').split('@')[0].toLowerCase() === skupina.split('@')[0]) || jmenoKlic_(r[h.indexOf('Sbor')]) === jmenoKlic_(sbor)) };
}

const KONTROLA_SLOUPCE = ['Sbor', 'Skupina', 'Okrsek', 'Odpověď z', 'Vyplnil', 'Stávající členové', 'Navržení členové', 'Přidat', 'Odebrat', 'Potvrdit odebrání',
  'Změny vlastností', 'Upozornění', 'Schváleno', 'Převzato'];

function pripravitKontrolu() {
  hlidatSdileni_();
  const ss = tabulka_(), sbory = nactiSbory_().filter(r => r.aktivni), odp = posledniOdpovedi_(), ares = aresIco_(), osh = oshSbory_();
  if (typeof AdminDirectory === 'undefined') throw new Error('Chybí služba Admin SDK API (AdminDirectory).');
  // dřívější rozhodnutí zachovat, pokud se odpověď nezměnila
  const stare = {};
  const shK0 = ss.getSheetByName(KONT.LIST_KONTROLA);
  if (shK0 && shK0.getLastRow() > 1) {
    const v = shK0.getDataRange().getValues(), h = v[0].map(String);
    v.slice(1).forEach(r => { stare[r[h.indexOf('Sbor')]] = { cas: String(r[h.indexOf('Odpověď z')]), schvaleno: r[h.indexOf('Schváleno')] === true, potvrdit: r[h.indexOf('Potvrdit odebrání')], prevzato: r[h.indexOf('Převzato')] }; });
  }
  // kde se který e-mail objevuje
  const kde = {};
  Object.keys(odp).forEach(s => navrzeni_(odp[s].odpovedi).platne.forEach(e => (kde[e] = kde[e] || []).push(s)));
  const fmtCas = d => d ? Utilities.formatDate(d, 'Europe/Prague', 'yyyy-MM-dd HH:mm') : '';
  const radky = sbory.sort((a, b) => (a.okrsek - b.okrsek) || a.sbor.localeCompare(b.sbor, 'cs')).map(s => {
    const o = odp[s.sbor], upoz = [];
    let stavajici = [], skupinaOk = true;
    // jen běžní členové (lidé) – vlastníci a správci skupiny (účty okresu) se neporovnávají ani nenavrhují k odebrání
    try { const c = clenoveSkupiny_(s.email); stavajici = Object.keys(c).filter(e => c[e].type === 'USER' && c[e].role === 'MEMBER'); }
    catch (e) { skupinaOk = false; upoz.push('skupina ' + s.email + ' neexistuje – spusťte Skupiny OSH → Provést změny'); }
    Utilities.sleep(CFG.PAUZA_MS);
    if (!o) {
      upoz.push('sbor bez odpovědi');
      return [s.sbor, s.email, s.okrsek || '', '', '', stavajici.join(', '), '', '', '', '', '', upoz.join('; '), false, ''];
    }
    const a = o.odpovedi, n = navrzeni_(a);
    if (n.neplatne.length) upoz.push('neplatný e-mail: ' + n.neplatne.join(', '));
    const vice = n.platne.filter(e => kde[e] && kde[e].length > 1);
    if (vice.length) upoz.push('e-mail u více sborů: ' + vice.map(e => e + ' (' + kde[e].join(', ') + ')').join('; '));
    // změny vlastností proti listu Sbory (MH/JSDH/Sport) a OSH data TEST (IČO, web, účet)
    const i = osh.najdi(s.sbor, s.email), r = i >= 0 ? osh.rows[i] : null, oh = k => r && osh.h.indexOf(k) >= 0 ? String(r[osh.h.indexOf(k)] || '').trim() : '';
    const zmeny = [];
    [['MH', s.mh, a[OT.mh]], ['JSDH', s.jsdh, a[OT.jsdh]], ['Sport', s.sport, a[OT.sport]]].forEach(([k, bylo, je]) => { if (je && ano_(je) !== bylo) zmeny.push(k + ': ' + (bylo ? 'ANO' : 'NE') + ' → ' + je); });
    const ico = String(a[OT.ico] || '').replace(/\D/g, ''), icoN = ico ? ('00000000' + ico).slice(-8) : '';
    [['IČO', oh('IČO'), icoN], ['Web', oh('Web'), a[OT.web] || ''], ['Číslo účtu', oh('Číslo účtu'), String(a[OT.ucet] || '').replace(/\s+/g, '')]]
      .forEach(([k, bylo, je]) => { if (je && je !== bylo) zmeny.push(k + ': ' + (bylo || '–') + ' → ' + je); });
    if (icoN && ares) { const ai = ares[jmenoKlic_(s.sbor)]; if (!ai) upoz.push('IČO nelze ověřit – sbor není v ARES datech'); else if (ai !== icoN) upoz.push('IČO nesedí s ARES (' + ai + ')'); }
    if (!r) upoz.push('sbor nenalezen v OSH data TEST (list Sbory)');
    const pridat = skupinaOk ? n.platne.filter(e => stavajici.indexOf(e) < 0) : n.platne, odebrat = stavajici.filter(e => n.platne.indexOf(e) < 0);
    const cas = fmtCas(o.cas), st = stare[s.sbor] && stare[s.sbor].cas === cas ? stare[s.sbor] : null;
    return [s.sbor, s.email, s.okrsek || '', cas, [a[OT.vyplnJmeno], a[OT.vyplnFunkce], a[OT.vyplnEmail]].filter(Boolean).join(', '),
      stavajici.join(', '), n.platne.join(', '), pridat.join(', '), odebrat.join(', '), st ? st.potvrdit || '' : '',
      zmeny.join('; '), upoz.join('; '), st ? st.schvaleno : false, st ? st.prevzato || '' : ''];
  });
  const sh = ss.getSheetByName(KONT.LIST_KONTROLA) || ss.insertSheet(KONT.LIST_KONTROLA);
  sh.clear(); sh.getDataRange().clearDataValidations();
  sh.getRange(1, 1, 1, KONTROLA_SLOUPCE.length).setValues([KONTROLA_SLOUPCE]).setFontWeight('bold').setBackground('#f3f2f2');
  if (radky.length) {
    sh.getRange(2, 1, radky.length, KONTROLA_SLOUPCE.length).setValues(radky);
    sh.getRange(2, KONTROLA_SLOUPCE.indexOf('Schváleno') + 1, radky.length, 1).insertCheckboxes();
    sh.getRange(2, KONTROLA_SLOUPCE.indexOf('Potvrdit odebrání') + 1, radky.length, 1)
      .setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['ANO'], true).setAllowInvalid(false).build());
  }
  sh.setFrozenRows(1); sh.setFrozenColumns(1);
  sh.getRange(1, 1, Math.max(radky.length + 1, 2), KONTROLA_SLOUPCE.length).setWrap(true).setVerticalAlignment('top');
  [180, 190, 60, 120, 220, 260, 260, 220, 220, 90, 260, 300, 80, 130].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getRange(1, KONTROLA_SLOUPCE.indexOf('Odebrat') + 1).setNote('Jen návrh – lidé ve skupině, kteří ve formuláři nejsou. Odeberou se jen při ANO ve sloupci „Potvrdit odebrání“.');
  sh.getRange(1, KONTROLA_SLOUPCE.indexOf('Schváleno') + 1).setNote('Zaškrtněte řádky ke převzetí a spusťte Kontakty sborů → 3. Převzít schválené.');
  const n = Object.keys(odp).length, log = protokol_(true);
  log('kontrola připravena', '', n + ' odpovědí z ' + sbory.length + ' sborů'); log.flush();
  sh.activate();
  oznam_('Ke kontrole: ' + n + ' sborů s odpovědí z ' + sbory.length + '. Zkontrolujte upozornění a zaškrtněte Schváleno.');
}

/* ---------- 3. převzetí ---------- */

function prevzitSchvalene() {
  hlidatSdileni_();
  const ss = tabulka_(), sh = ss.getSheetByName(KONT.LIST_KONTROLA);
  if (!sh || sh.getLastRow() < 2) throw new Error('Nejdřív spusťte „2. Připravit kontrolu odpovědí“.');
  if (typeof AdminDirectory === 'undefined') throw new Error('Chybí služba Admin SDK API (AdminDirectory).');
  const v = sh.getDataRange().getValues(), h = v[0].map(String), c = k => h.indexOf(k);
  const k = v.map((r, i) => ({ r, i })).slice(1).filter(x => x.r[c('Schváleno')] === true && !x.r[c('Převzato')] && x.r[c('Odpověď z')]);
  if (!k.length) { oznam_('Žádný schválený a dosud nepřevzatý řádek.'); return; }
  const ui = ui_();
  if (ui && ui.alert('Převzít ' + k.length + ' sborů do skupin?', 'Přidají se navržení členové, odeberou se jen ti s ANO v „Potvrdit odebrání“ a zapíší se vlastnosti do listu Sbory (tady i v OSH data TEST).', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const log = protokol_(false), odp = posledniOdpovedi_(), osh = oshSbory_();
  const shS = ss.getSheetByName(CFG.LIST), vS = shS.getDataRange().getValues(), hS = vS[0].map(x => String(x).trim().toLowerCase());
  log('převzetí start', '', k.length + ' sborů');
  k.forEach(({ r, i }) => {
    const sbor = r[c('Sbor')], skupina = r[c('Skupina')], o = odp[sbor];
    try {
      if (!o) throw new Error('odpověď sboru už ve formuláři není');
      const a = o.odpovedi, navrz = navrzeni_(a).platne;
      // aktuální členové znovu (mezitím se mohlo něco změnit)
      const cl = clenoveSkupiny_(skupina);
      navrz.filter(e => !cl[e]).forEach(e => { log('přidat člena', skupina, e); pridej_(skupina, e, log); }); // chybu zapíše pridej_
      const odebrat = r[c('Potvrdit odebrání')] === 'ANO' ? emaily_(r[c('Odebrat')]) : [];
      odebrat.forEach(e => {
        const m = cl[e];
        if (!m || m.type !== 'USER' || m.role !== 'MEMBER') { log('upozornění', skupina, e + ' neodebrán (není běžný člen)'); return; }
        try { AdminDirectory.Members.remove(skupina, e); log('odebrat člena', skupina, e + ' (potvrzeno ANO)'); } catch (x) { log('CHYBA', skupina, 'nelze odebrat ' + e + ': ' + x.message); }
        Utilities.sleep(CFG.PAUZA_MS);
      });
      const kontakty = Object.keys(cl).filter(e => cl[e].type === 'USER' && cl[e].role === 'MEMBER').concat(navrz).filter(e => odebrat.indexOf(e) < 0).filter((x, j, arr) => arr.indexOf(x) === j);
      const vl = { mh: a[OT.mh], jsdh: a[OT.jsdh], sport: a[OT.sport] };
      const ico = String(a[OT.ico] || '').replace(/\D/g, ''), dalsi = { 'IČO': ico ? ('00000000' + ico).slice(-8) : '', 'Web': a[OT.web] || '', 'Číslo účtu': String(a[OT.ucet] || '').replace(/\s+/g, '') };
      // list Sbory v této tabulce (skupiny se podle něj synchronizují)
      const iS = vS.findIndex((x, j) => j > 0 && plnyEmail_(String(x[hS.indexOf('skupina')]).trim().toLowerCase()) === skupina);
      if (iS > 0) {
        const zapis = (sl, hod) => { const j = hS.indexOf(sl.toLowerCase()); if (j < 0 || hod === '' || hod == null) return; const g = shS.getRange(iS + 1, j + 1); if (/^(IČO|Číslo účtu)$/.test(sl)) g.setNumberFormat('@'); g.setValue(hod); };
        zapis('MH', vl.mh); zapis('JSDH', vl.jsdh); zapis('Sport', vl.sport); zapis('Kontakty', kontakty.join(', '));
        Object.keys(dalsi).forEach(x => zapis(x, dalsi[x]));
        log('vlastnosti zapsány', skupina, 'Skupiny OSH: MH ' + vl.mh + ', JSDH ' + vl.jsdh + ', Sport ' + vl.sport + ', kontaktů ' + kontakty.length);
      } else log('upozornění', skupina, 'sbor nenalezen v listu ' + CFG.LIST);
      // OSH data TEST – zdroj pravdy pro web a přihlášení (sloupec Kontakty)
      const iO = osh.najdi(sbor, skupina);
      if (iO >= 0) {
        const zapis = (sl, hod) => { const j = osh.h.indexOf(sl); if (j < 0 || hod === '' || hod == null) return; const g = osh.sh.getRange(iO + 2, j + 1); if (/^(IČO|Číslo účtu)$/.test(sl)) g.setNumberFormat('@'); g.setValue(hod); };
        zapis('MH', vl.mh); zapis('JSDH', vl.jsdh); zapis('Sport', vl.sport); zapis('Kontakty', kontakty.join(', '));
        Object.keys(dalsi).forEach(x => zapis(x, dalsi[x]));
        log('vlastnosti zapsány', skupina, 'OSH data TEST: Kontakty ' + kontakty.length + ', ' + Object.keys(dalsi).filter(x => dalsi[x]).map(x => x + ' ' + dalsi[x]).join(', '));
      } else log('upozornění', skupina, 'sbor nenalezen v OSH data TEST');
      // jména a funkce do listu Kontakty sborů (OSH data TEST) – portál sboru „Můj sbor“, později předvyplňování
      try { log('kontakty sboru', skupina, zapsatKontaktySboru_(sbor, skupina, a, odebrat)); } catch (x) { log('CHYBA', skupina, 'Kontakty sborů: ' + x.message); }
      // souhrnné skupiny podle vlastností
      Object.keys(KONT.SOUHRNNE).forEach(kl => {
        if (!vl[kl]) return;
        const souhrnna = plnyEmail_(KONT.SOUHRNNE[kl]), chci = ano_(vl[kl]);
        let jeTam = false;
        try { AdminDirectory.Members.get(souhrnna, skupina); jeTam = true; } catch (x) { jeTam = false; }
        if (chci && !jeTam) { log('přidat sbor', souhrnna, skupina); pridej_(souhrnna, skupina, log); }
        if (!chci && jeTam) { try { AdminDirectory.Members.remove(souhrnna, skupina); log('odebrat sbor', souhrnna, skupina); } catch (x) { log('CHYBA', souhrnna, 'nelze odebrat ' + skupina + ': ' + x.message); } }
        Utilities.sleep(CFG.PAUZA_MS);
      });
      sh.getRange(i + 1, c('Převzato') + 1).setValue(Utilities.formatDate(new Date(), 'Europe/Prague', 'yyyy-MM-dd HH:mm'));
      log('sbor převzat', skupina, sbor);
    } catch (e) { log('CHYBA', skupina, sbor + ': ' + (e && e.message || e)); }
  });
  log('HOTOVO', '', 'převzetí kontaktů');
  log.flush();
  oznam_('Převzato. Podrobnosti v listu Protokol. Kontroly listu se po další „2. Připravit kontrolu“ ukážou bez těchto změn.');
}

/** Lidé z odpovědi s funkcí → list Kontakty sborů v OSH data TEST (upsert podle skupiny a e-mailu). */
function zapsatKontaktySboru_(sbor, skupina, a, odebrat) {
  const sh = SpreadsheetApp.openById(KONT.OSH_DATA_ID).getSheetByName('Kontakty sborů');
  if (!sh) return 'list Kontakty sborů v OSH data TEST chybí – spusťte tam zalozitStrukturu';
  const sk = skupina.split('@')[0], h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String), c = k => h.indexOf(k);
  const funkceVyplnujiciho = String(a[OT.vyplnFunkce] || '').trim(), znama = KONT.FUNKCE.map(f => f[0]).concat(['Vedoucí / instruktor MH', 'Člen výboru', 'Člen sboru']);
  const lide = [];
  const pridat = (email, jmeno, funkce) => emaily_(email).filter(e => EMAIL_VZOR.test(e)).forEach(e => { const x = lide.find(l => l.e === e); if (x) { x.j = x.j || jmeno; x.f = x.f || funkce; } else lide.push({ e, j: jmeno || '', f: funkce || '' }); });
  KONT.FUNKCE.forEach(([f]) => pridat(a[OT.email(f)], a[OT.jmeno(f)], f));
  pridat(a[OT.vyplnEmail], a[OT.vyplnJmeno], znama.find(z => z.toLowerCase() === funkceVyplnujiciho.toLowerCase()) || funkceVyplnujiciho);
  pridat(a[OT.dalsiMH], '', 'Vedoucí / instruktor MH');
  pridat(a[OT.dalsi], '', 'Člen sboru');
  const v = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues() : [], ted = new Date();
  let nove = 0, upr = 0;
  const zapis = (l, aktivni) => {
    const i = v.findIndex(r => String(r[c('Skupina')]).split('@')[0].toLowerCase() === sk && String(r[c('E-mail')]).trim().toLowerCase() === l.e);
    const r = i >= 0 ? v[i] : h.map(() => '');
    const set = (k, val) => { if (c(k) >= 0) r[c(k)] = val; };
    set('Sbor', sbor); set('Skupina', sk); set('E-mail', l.e); set('Aktivní', aktivni ? 'ANO' : 'NE');
    if (aktivni) { if (l.j) set('Jméno', l.j); if (l.f) set('Funkce', l.f); set('Zdroj', 'formulář'); }
    if (i < 0) { set('Vytvořeno', ted); set('Vytvořil', 'formulář kontaktů'); }
    set('Upraveno', ted); set('Upravil', 'formulář kontaktů');
    const radek = r.map(x => typeof x === 'string' && /^[=+\-@]/.test(x) ? "'" + x : x);
    if (i >= 0) sh.getRange(i + 2, 1, 1, h.length).setValues([radek]); else { sh.appendRow(radek); v.push(r); }
    i >= 0 ? upr++ : nove++;
  };
  lide.forEach(l => zapis(l, true));
  (odebrat || []).forEach(e => zapis({ e, j: '', f: '' }, false));
  return lide.length + ' lidí (nových ' + nove + ', upravených ' + upr + ')' + ((odebrat || []).length ? ', neaktivních ' + odebrat.length : '');
}

/* ---------- 4. přehled ---------- */

function prehledVyplneni() {
  const ss = tabulka_(), sbory = nactiSbory_().filter(r => r.aktivni), odp = posledniOdpovedi_(), odkaz = formular_().getPublishedUrl();
  const okrsky = {};
  sbory.forEach(s => { const o = okrsky[s.okrsek] = okrsky[s.okrsek] || { celkem: 0, chybi: [] }; o.celkem++; if (!odp[s.sbor]) o.chybi.push(s.sbor); });
  const klice = Object.keys(okrsky).map(Number).sort((a, b) => a - b);
  const chybiCelkem = klice.reduce((n, k) => n + okrsky[k].chybi.length, 0);
  const radky = klice.map(k => { const o = okrsky[k]; return [k ? k + '. okrsek' : 'bez okrsku', o.celkem, o.celkem - o.chybi.length, o.chybi.length, o.chybi.join(', '),
    o.chybi.length ? (k ? k + '. okrsek' : 'Bez okrsku') + ' – ještě chybí kontakty od: ' + o.chybi.join(', ') + '. Formulář: ' + odkaz : (k ? k + '. okrsek' : 'Bez okrsku') + ' – vše vyplněno, děkujeme!']; });
  const sh = ss.getSheetByName(KONT.LIST_PREHLED) || ss.insertSheet(KONT.LIST_PREHLED);
  sh.clear();
  sh.getRange(1, 1).setValue('Vyplněno ' + (sbory.length - chybiCelkem) + ' z ' + sbory.length + ' sborů · stav k ' + Utilities.formatDate(new Date(), 'Europe/Prague', 'd. M. yyyy H:mm')).setFontWeight('bold');
  sh.getRange(3, 1, 1, 6).setValues([['Okrsek', 'Sborů', 'Vyplnilo', 'Chybí', 'Které sbory chybí', 'Text ke zkopírování (WhatsApp)']]).setFontWeight('bold').setBackground('#f3f2f2');
  if (radky.length) sh.getRange(4, 1, radky.length, 6).setValues(radky);
  sh.getRange(3, 1, radky.length + 1, 6).setWrap(true).setVerticalAlignment('top');
  [110, 60, 70, 60, 320, 420].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.setFrozenRows(3); sh.activate();
  oznam_('Chybí ' + chybiCelkem + ' z ' + sbory.length + ' sborů – list „' + KONT.LIST_PREHLED + '“.');
}
