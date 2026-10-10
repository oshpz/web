/**
 * Kontakty sborů (R5) a jejich převzetí do skupin (B11). Druhý soubor ve skriptu tabulky „Skupiny OSH“ (vedle Skupiny.gs).
 * Sběr schválil VV 10. 10. 2026.
 *
 * 1. vytvoritFormular()   – Google formulář „Kontakty sboru pro OSH Praha-západ“ (veřejný odkaz, bez přihlášení),
 *                          odpovědi do listu „Formulář – odpovědi“. Opakované spuštění formulář nezakládá znovu, jen obnoví
 *                          seznam sborů a vypíše odkazy.
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
  FUNKCE: ['Starosta', 'Velitel', 'Jednatel', 'Vedoucí MH', 'Pokladník'],
  SOUHRNNE: { mh: 'sbory-mh', jsdh: 'sbory-jsdh', sport: 'sbory-sport' }
};
// Názvy otázek – podle nich se čtou odpovědi. Neměnit, nebo změnit i ve formuláři.
const OT = {
  sbor: 'Sbor', vyplnJmeno: 'Vaše jméno a příjmení', vyplnFunkce: 'Vaše funkce ve sboru', vyplnEmail: 'Váš e-mail',
  jmeno: f => f + ' – jméno a příjmení', email: f => f + ' – e-mail',
  dalsi: 'Další e-maily do skupiny sboru', mh: 'Mladí hasiči (MH)', jsdh: 'Výjezdová jednotka (JSDH)', sport: 'Sportovní (soutěžní) družstvo',
  ico: 'IČO sboru', web: 'Web sboru', ucet: 'Číslo účtu sboru', souhlas: 'Souhlas'
};
const EMAIL_VZOR = /^[^@\s<>"',;]+@[^@\s<>"',;]+\.[^@\s<>"',;]{2,}$/;

function kontaktyMenu_(ui) {
  ui.createMenu('Kontakty sborů')
    .addItem('1. Vytvořit formulář / obnovit seznam sborů', 'vytvoritFormular')
    .addItem('2. Připravit kontrolu odpovědí', 'pripravitKontrolu')
    .addItem('3. Převzít schválené do skupin', 'prevzitSchvalene')
    .addSeparator()
    .addItem('Přehled vyplnění podle okrsků', 'prehledVyplneni')
    .addToUi();
}

/* ---------- 1. formulář ---------- */

function vytvoritFormular() {
  const ss = tabulka_(), p = PropertiesService.getDocumentProperties();
  const sbory = nactiSbory_().filter(r => r.aktivni).map(r => r.sbor).sort((a, b) => a.localeCompare(b, 'cs'));
  if (!sbory.length) throw new Error('V listu Sbory nejsou aktivní sbory.');
  let form = null;
  try { if (p.getProperty('KONTAKTY_FORM_ID')) form = FormApp.openById(p.getProperty('KONTAKTY_FORM_ID')); } catch (e) { form = null; }
  if (form) {
    const it = form.getItems(FormApp.ItemType.LIST).find(i => i.getTitle() === OT.sbor);
    if (it) it.asListItem().setChoiceValues(sbory);
    vypsatOdkazy_(form, 'Formulář už existuje – seznam sborů obnoven (' + sbory.length + ').');
    return;
  }
  form = FormApp.create(KONT.NAZEV);
  form.setDescription(
    'Okres sbírá kontakty na funkcionáře sborů, aby mohl posílat informace přímo těm, kterých se týkají.\n\n' +
    'K čemu kontakty slouží:\n' +
    '• e-maily zařadíme do skupiny vašeho sboru sdh-…@oshpz.cz – na ni posílá okres informace, pozvánky a připomínky termínů,\n' +
    '• stejným e-mailem se lidé ze sboru přihlásí do aplikace OSH (kód na e-mail, bez hesla).\n\n' +
    'Kdo je uvidí: jen správci okresu OSH Praha-západ. Na webu se nezveřejňují a nepředávají se dál.\n' +
    'Úpravu nebo smazání kontaktu lze kdykoli vyžádat na spravci@oshpz.cz.\n\n' +
    'Vyplňte prosím jeden formulář za sbor. Odpověď můžete po odeslání upravit přes odkaz, který se zobrazí po odeslání (uložte si ho).');
  // nesbírat e-maily a nevyžadovat přihlášení – veřejný odkaz, sbory nemají Google účty
  try { form.setEmailCollectionType(FormApp.EmailCollectionType.DO_NOT_COLLECT); } catch (e) { form.setCollectEmail(false); }
  try { form.setRequireLogin(false); } catch (e) {}
  try { form.setLimitOneResponsePerUser(false); } catch (e) {}
  form.setAllowResponseEdits(true);
  form.setShowLinkToRespondAgain(false);
  form.setConfirmationMessage('Děkujeme, kontakty jsme přijali. Uložte si odkaz „Upravit odpověď“, pokud budete chtít údaje později změnit. Dotazy: spravci@oshpz.cz');
  const email = it => it.setValidation(FormApp.createTextValidation().setHelpText('Zadejte platný e-mail.').requireTextIsEmail().build());

  form.addListItem().setTitle(OT.sbor).setChoiceValues(sbory).setRequired(true);
  form.addSectionHeaderItem().setTitle('Kdo formulář vyplňuje');
  form.addTextItem().setTitle(OT.vyplnJmeno).setRequired(true);
  form.addTextItem().setTitle(OT.vyplnFunkce).setHelpText('Např. starosta, jednatel.').setRequired(true);
  email(form.addTextItem().setTitle(OT.vyplnEmail).setHelpText('Osobní e-mail, kterým se budete přihlašovat do aplikace OSH.').setRequired(true));
  form.addSectionHeaderItem().setTitle('Funkce ve sboru').setHelpText('Vyplňte, kdo funkci zastává. Nepovinné – nevyplněné nevadí. Uvádějte osobní e-maily (seznam.cz, gmail.com…).');
  KONT.FUNKCE.forEach(f => {
    form.addTextItem().setTitle(OT.jmeno(f));
    email(form.addTextItem().setTitle(OT.email(f)));
  });
  form.addParagraphTextItem().setTitle(OT.dalsi).setHelpText('Další lidé, kteří mají dostávat informace z okresu (např. zástupce velitele, trenéři). E-maily oddělte čárkou.')
    .setValidation(FormApp.createParagraphTextValidation().setHelpText('Jen e-mailové adresy oddělené čárkou.').requireTextMatchesPattern('^\\s*[^@\\s,;]+@[^@\\s,;]+\\.[^@\\s,;]+(\\s*[,;]\\s*[^@\\s,;]+@[^@\\s,;]+\\.[^@\\s,;]+)*\\s*[,;]?\\s*$').build());
  form.addSectionHeaderItem().setTitle('Vlastnosti sboru').setHelpText('Podle nich posíláme informace jen sborům, kterých se týkají (např. soutěže mládeže).');
  [OT.mh, OT.jsdh, OT.sport].forEach(t => form.addMultipleChoiceItem().setTitle(t).setChoiceValues(['ANO', 'NE']).setRequired(true));
  form.addTextItem().setTitle(OT.ico).setHelpText('8 číslic.')
    .setValidation(FormApp.createTextValidation().setHelpText('IČO má 8 číslic.').requireTextMatchesPattern('^\\s*\\d{6,8}\\s*$').build());
  form.addTextItem().setTitle(OT.web).setHelpText('Adresa webu nebo Facebooku sboru, např. https://www.sdh-obec.cz')
    .setValidation(FormApp.createTextValidation().setHelpText('Zadejte adresu začínající https:// nebo http://').requireTextIsUrl().build());
  form.addTextItem().setTitle(OT.ucet).setHelpText('Pro QR platby členských příspěvků, např. 123456789/0800.')
    .setValidation(FormApp.createTextValidation().setHelpText('Číslo účtu ve tvaru [předčíslí-]číslo/kód banky, např. 123456789/0800.').requireTextMatchesPattern('^\\s*(\\d{1,6}-)?\\d{2,10}\\s*/\\s*\\d{4}\\s*$').build());
  form.addCheckboxItem().setTitle(OT.souhlas).setChoiceValues(['Potvrzuji, že uvedení lidé o předání svého kontaktu okresu vědí.']).setRequired(true);

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  p.setProperty('KONTAKTY_FORM_ID', form.getId());
  SpreadsheetApp.flush();
  // nový list s odpověďmi přejmenovat
  const listOdp = ss.getSheets().find(sh => { try { return sh.getFormUrl() && FormApp.openByUrl(sh.getFormUrl()).getId() === form.getId(); } catch (e) { return false; } });
  if (listOdp && !ss.getSheetByName(KONT.LIST_ODPOVEDI)) listOdp.setName(KONT.LIST_ODPOVEDI);
  try { DriveApp.getFileById(form.getId()).addEditor(KONT.SPRAVCI); } catch (e) { console.warn('Sdílení se ' + KONT.SPRAVCI + ': ' + e.message); }
  const log = protokol_(false); log('formulář založen', '', form.getEditUrl()); log.flush();
  vypsatOdkazy_(form, 'Formulář založen.');
}

function vypsatOdkazy_(form, uvod) {
  const text = uvod + '\n\nOdkaz pro sbory (vyplnění):\n' + form.getPublishedUrl() + '\n\nÚprava formuláře:\n' + form.getEditUrl() +
    '\n\nSdíleno k úpravám se ' + KONT.SPRAVCI + '. Odpovědi: list „' + KONT.LIST_ODPOVEDI + '“.';
  console.log(text);
  const ui = ui_(); if (ui) ui.alert('Kontakty sborů', text, ui.ButtonSet.OK);
}

function formular_() {
  const id = PropertiesService.getDocumentProperties().getProperty('KONTAKTY_FORM_ID');
  if (!id) throw new Error('Formulář ještě neexistuje – spusťte „1. Vytvořit formulář“.');
  return FormApp.openById(id);
}

/* ---------- 2. kontrola ---------- */

/** Poslední odpověď za sbor (podle času odeslání / poslední úpravy). */
function posledniOdpovedi_() {
  const out = {};
  formular_().getResponses().forEach(r => {
    const o = { cas: r.getTimestamp(), odpovedi: {} };
    r.getItemResponses().forEach(ir => { const v = ir.getResponse(); o.odpovedi[ir.getItem().getTitle()] = Array.isArray(v) ? v.join(', ') : String(v == null ? '' : v).trim(); });
    const sbor = o.odpovedi[OT.sbor];
    if (sbor && (!out[sbor] || out[sbor].cas < o.cas)) out[sbor] = o;
  });
  return out;
}

function emaily_(text) { return String(text || '').split(/[\s,;]+/).map(x => x.trim().toLowerCase().replace(/^mailto:/, '')).filter(Boolean); }

/** Navržení členové z odpovědi + neplatné e-maily. */
function navrzeni_(odp) {
  const vse = [odp[OT.vyplnEmail]].concat(KONT.FUNKCE.map(f => odp[OT.email(f)])).concat([odp[OT.dalsi]]);
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
