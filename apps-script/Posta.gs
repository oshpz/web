/**
 * OSH data – B6 E-maily, oznámení a připomínky.
 * Nový soubor „Posta“ ve stejném projektu. Obsahuje i posta_() – ze souboru Prihlaseni se odstranila.
 *
 * Adresát podle „Pro koho“ = souhrnná skupina (sbory@, sbory-mh@, okrsek-03@…), nikdy jednotlivé adresy.
 * V režimu TEST jde vše na TEST_EMAIL s původním adresátem v předmětu.
 */

const ADRESATI = {
  'všechny sbory': 'sbory', 'sbory s MH': 'sbory-mh', 'sbory s JSDH': 'sbory-jsdh', 'sbory se sportem': 'sbory-sport', 'jen okres': 'spravci'
};
const MODRA = '#2d4cb0', INKOUST = '#201e1d', PODKLAD = '#f3f2f2';

/** Pro koho + okrsek → e-mail skupiny, nebo '' (veřejnost = jen web, bez e-mailu). */
function adresat_(proKoho, okrsek) {
  const dom = '@' + (nastaveniWeb_('DOMENA') || 'oshpz.cz');
  if (proKoho === 'okrsek') return okrsek ? 'okrsek-' + ('0' + Number(okrsek)).slice(-2) + dom : '';
  return ADRESATI[proKoho] ? ADRESATI[proKoho] + dom : '';
}

function esc_(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/** Jednotná šablona. polozky = [[štítek, hodnota], …], tlacitko = [text, url] */
function sablona_(nadpis, uvod, polozky, tlacitko, pata) {
  const radky = (polozky || []).filter(p => p[1]).map(p =>
    '<tr><td style="padding:8px 16px 8px 0;border-top:1px solid #d6d4d3;font-size:13px;color:#5c5958;white-space:nowrap;vertical-align:top;">' + esc_(p[0]) +
    '</td><td style="padding:8px 0;border-top:1px solid #d6d4d3;font-size:15px;color:' + INKOUST + ';">' + esc_(p[1]).replace(/\n/g, '<br>') + '</td></tr>').join('');
  const btn = tlacitko && tlacitko[1] ? '<p style="margin:24px 0 0;"><a href="' + esc_(tlacitko[1]) + '" style="display:inline-block;background:' + MODRA +
    ';color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;">' + esc_(tlacitko[0]) + ' →</a></p>' : '';
  return '<!doctype html><html><body style="margin:0;background:' + PODKLAD + ';font-family:Archivo,Arial,Helvetica,sans-serif;color:' + INKOUST + ';">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + PODKLAD + ';"><tr><td style="padding:24px 12px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-top:6px solid ' + MODRA + ';">' +
    '<tr><td style="padding:20px 28px 0;font-size:13px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;">OSH Praha-západ</td></tr>' +
    '<tr><td style="padding:12px 28px 0;"><h1 style="margin:0;font-size:26px;line-height:1.15;font-weight:800;">' + esc_(nadpis) + '</h1></td></tr>' +
    (uvod ? '<tr><td style="padding:12px 28px 0;font-size:15px;line-height:1.5;">' + esc_(uvod).replace(/\n/g, '<br>') + '</td></tr>' : '') +
    (radky ? '<tr><td style="padding:16px 28px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:2px solid ' + INKOUST + ';">' + radky + '</table></td></tr>' : '') +
    '<tr><td style="padding:0 28px 28px;">' + btn + '</td></tr>' +
    '<tr><td style="padding:16px 28px;border-top:2px solid ' + INKOUST + ';font-size:12px;line-height:1.5;color:#5c5958;">' +
    esc_(pata || 'Zprávu dostáváte jako kontakt sboru v OSH Praha-západ. Odpověď přijde správcům okresu.') + '</td></tr>' +
    '</table></td></tr></table></body></html>';
}

/** Odeslání. html volitelné – bez něj se text zabalí do šablony. */
function posta_(komu, predmet, text, html) {
  const test = nastaveniWeb_('REZIM') !== 'OSTRY';
  const adresat = test ? nastaveniWeb_('TEST_EMAIL') : komu;
  if (!adresat) return;
  const body = html || sablona_(predmet, text, [], null, 'Automatická zpráva aplikace OSH Praha-západ. Odpověď přijde na spravci@oshpz.cz.');
  MailApp.sendEmail({ to: adresat, subject: (test ? '[TEST → ' + komu + '] ' : '') + predmet, body: text, htmlBody: body,
    name: 'OSH Praha-západ', replyTo: 'spravci@' + (nastaveniWeb_('DOMENA') || 'oshpz.cz') });
}

/* ---------- oznámení a připomínky ---------- */

const fDen_ = d => Utilities.formatDate(d, 'Europe/Prague', 'd. M. yyyy');
const fCas_ = d => Utilities.formatDate(d, 'Europe/Prague', 'H:mm');
const DNY_TYDNE = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];

function kdy_(list, r, col) {
  if (list === 'Termíny') { const d = r[col('Datum')]; return d instanceof Date ? DNY_TYDNE[d.getDay()] + ' ' + fDen_(d) : ''; }
  const od = r[col('Od')], doo = r[col('Do')]; if (!(od instanceof Date)) return '';
  const celo = od.getHours() === 0 && od.getMinutes() === 0;
  let t = DNY_TYDNE[od.getDay()] + ' ' + fDen_(od) + (celo ? '' : ' od ' + fCas_(od));
  if (doo instanceof Date) t += fDen_(doo) !== fDen_(od) ? ' – ' + fDen_(doo) : celo ? '' : ' do ' + fCas_(doo);
  return t;
}
function zacatek_(list, r, col) { const d = r[col(list === 'Termíny' ? 'Datum' : 'Od')]; return d instanceof Date ? d : null; }

function zpravaOPolozce_(list, r, col, typZpravy, zbyva) {
  const nazev = r[col('Název')], webUrl = nastaveniWeb_('WEB_URL');
  const pred = typZpravy === 'oznámení' ? (list === 'Akce' ? 'Nová akce: ' : 'Nový termín: ') : (zbyva === 0 ? 'Dnes: ' : 'Za ' + zbyva + ' ' + (zbyva === 1 ? 'den' : zbyva < 5 ? 'dny' : 'dní') + ': ');
  const predmet = pred + nazev;
  const pol = [['Kdy', kdy_(list, r, col)], ['Kde', list === 'Akce' ? r[col('Místo')] : ''], ['Pořádá', list === 'Akce' ? r[col('Pořadatel')] : ''],
    ['Pro', r[col('Pro koho')] === 'okrsek' ? r[col('Okrsek')] + '. okrsek' : r[col('Pro koho')]], ['', r[col('Popis')]]];
  const uvod = typZpravy === 'oznámení' ? (list === 'Akce' ? 'Okres zveřejnil novou akci.' : 'Okres zveřejnil nový termín.') :
    (r[col('Typ')] === 'uzávěrka' ? 'Připomínáme blížící se uzávěrku.' : 'Připomínáme blížící se ' + (list === 'Akce' ? 'akci.' : 'termín.'));
  const odkaz = r[col('Odkaz')] || (webUrl ? webUrl + '/#kalendar' : '');
  const text = uvod + '\n\n' + pol.filter(p => p[1]).map(p => (p[0] ? p[0] + ': ' : '') + p[1]).join('\n') + (odkaz ? '\n\n' + odkaz : '') + '\n\nOSH Praha-západ';
  return { predmet, text, html: sablona_(nazev, uvod, pol, odkaz ? ['Podrobnosti', odkaz] : null) };
}

/** Každých 15 min: oznámí nově zveřejněné akce a termíny (10 min po poslední úpravě, aby se neposílal rozepsaný řádek). */
function poslatOznameni() {
  const ss = dataSs_(), hranice = Date.now() - 10 * 60e3, dnes = new Date(); dnes.setHours(0, 0, 0, 0);
  let n = 0;
  ['Akce', 'Termíny'].forEach(list => {
    const sh = ss.getSheetByName(list); if (sh.getLastRow() < 2) return;
    const h = hlavicka_(sh), col = k => h.indexOf(k);
    if (col('Oznámeno') < 0) throw new Error('V listu ' + list + ' chybí sloupec Oznámeno – spusťte zalozitStrukturu.');
    const v = sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues();
    v.forEach((r, i) => {
      if (r[col('Stav')] !== 'zveřejněno' || r[col('Oznámeno')]) return;
      const upr = r[col('Upraveno')] || r[col('Vytvořeno')];
      if (upr instanceof Date && upr.getTime() > hranice) return;
      const z = zacatek_(list, r, col), komu = adresat_(r[col('Pro koho')], r[col('Okrsek')]);
      if (!z || z < dnes || !komu) { sh.getRange(i + 2, col('Oznámeno') + 1).setValue('neposíláno'); return; }
      const m = zpravaOPolozce_(list, r, col, 'oznámení');
      posta_(komu, m.predmet, m.text, m.html);
      sh.getRange(i + 2, col('Oznámeno') + 1).setValue(new Date());
      zaznamZmeny_('aplikace', list, r[col('ID')], 'upraveno', '', 'oznámeno → ' + komu);
      n++;
    });
  });
  console.log('Odesláno oznámení: ' + n);
  return n;
}

/** Každé ráno v 7:00: připomínky podle „Připomenout (dny předem)“ (prázdné = PRIPOMINKY_DNY z Nastavení). */
function poslatPripominky() {
  const ss = dataSs_(), vychozi = nastaveniWeb_('PRIPOMINKY_DNY') || '14,3';
  const dnes = new Date(); dnes.setHours(0, 0, 0, 0);
  let n = 0;
  ['Akce', 'Termíny'].forEach(list => {
    const sh = ss.getSheetByName(list); if (sh.getLastRow() < 2) return;
    const h = hlavicka_(sh), col = k => h.indexOf(k);
    const v = sh.getRange(2, 1, sh.getLastRow() - 1, h.length).getValues();
    v.forEach((r, i) => {
      if (r[col('Stav')] !== 'zveřejněno') return;
      const z = zacatek_(list, r, col), komu = adresat_(r[col('Pro koho')], r[col('Okrsek')]);
      if (!z || !komu) return;
      const den = new Date(z); den.setHours(0, 0, 0, 0);
      const zbyva = Math.round((den - dnes) / 864e5);
      const dny = String(r[col('Připomenout (dny předem)')] || vychozi).split(/[,;\s]+/).map(Number).filter(x => x >= 0);
      const uz = String(r[col('Připomenuto')] || '').split(',').filter(Boolean);
      // pošle nejbližší propásnutou připomínku (např. když skript den neběžel), ale každou jen jednou
      const d = dny.filter(x => x >= zbyva && uz.indexOf(String(x)) < 0).sort((a, b) => a - b)[0];
      if (d == null || zbyva < 0 || d - zbyva > 2) return;
      const m = zpravaOPolozce_(list, r, col, 'připomínka', zbyva);
      posta_(komu, m.predmet, m.text, m.html);
      uz.push(String(d));
      dny.filter(x => x > d).forEach(x => { if (uz.indexOf(String(x)) < 0) uz.push(String(x)); }); // starší připomínky už nemá smysl posílat
      sh.getRange(i + 2, col('Připomenuto') + 1).setValue(uz.join(','));
      n++;
    });
  });
  console.log('Odesláno připomínek: ' + n);
  return n;
}

/* ---------- menu ---------- */

function poslatOznameniTed() { const n = poslatOznameni(); SpreadsheetApp.getActive().toast('Odesláno oznámení: ' + n, 'E-maily', 6); }
function poslatPripominkyTed() { const n = poslatPripominky(); SpreadsheetApp.getActive().toast('Odesláno připomínek: ' + n, 'E-maily', 6); }

/** Pošle vám ukázku oznámení pro označený řádek v listu Akce nebo Termíny (bez zápisu do tabulky). */
function nahledEmailu() {
  const sh = SpreadsheetApp.getActiveSheet(), list = sh.getName();
  if (!KAL_LISTY[list]) throw new Error('Přepněte na list Akce nebo Termíny a označte řádek.');
  const row = sh.getActiveRange().getRow(); if (row < 2) throw new Error('Označte řádek s akcí.');
  const h = hlavicka_(sh), col = k => h.indexOf(k), r = sh.getRange(row, 1, 1, h.length).getValues()[0];
  const m = zpravaOPolozce_(list, r, col, 'oznámení'), ja = Session.getActiveUser().getEmail();
  MailApp.sendEmail({ to: ja, subject: '[NÁHLED → ' + (adresat_(r[col('Pro koho')], r[col('Okrsek')]) || 'nikomu – jen web') + '] ' + m.predmet, body: m.text, htmlBody: m.html, name: 'OSH Praha-západ' });
  SpreadsheetApp.getActive().toast('Náhled odeslán na ' + ja, 'E-maily', 6);
}
