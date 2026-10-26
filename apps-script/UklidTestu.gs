/**
 * Úklid testovacích dat před pilotem se sbory (T1).
 *
 * 1. uklidTestuNahled – projde listy Akce, Termíny, Dokumenty, Žádosti, Rezervace, Příspěvky a Změny sborů a vypíše
 *    kandidáty do listu „Úklid testů“: ID s „TEST“, název se slovem test / testovací, navázané akce a rezervace žádostí.
 *    Jisté testy jsou zaškrtnuté, změny sborů (nejde poznat, které byly testovací) ne – zkontrolujte a upravte zaškrtnutí.
 * 2. uklidTestuProvest – smaže jen zaškrtnuté řádky, soubory a složky na Disku dá do koše (jde obnovit 30 dní),
 *    vše zapíše do Záznamu změn a smaže osiřelé události v Google Kalendáři. Evidenci majetku nemění (stará aplikace).
 */

const LIST_UKLID = 'Úklid testů';
// názvy listů napevno: konstanty z jiných souborů tu při načtení ještě nemusí existovat (soubory se načítají podle abecedy)
const UKLID_LISTY = ['Akce', 'Termíny', 'Dokumenty', 'Žádosti', 'Rezervace', 'Příspěvky', 'Změny sborů', 'Členské přihlášky', 'Soutěže', 'Přihlášky družstev', 'Výsledky', 'Poháry', 'Přestupy', 'Členové', 'Školení', 'Účastníci školení', 'Kvalifikace'];
const UKLID_SLOUPCE = ['Smazat', 'List', 'ID', 'Název', 'Stav', 'Proč', 'Na Disku'];
// slovo test / testovací (ne „testy“ – např. cvičné testy pro členy)
const TEST_SLOVO = /(^|[^\p{L}])(test|testovací)([^\p{L}]|$)/iu;

function uklidTestuNahled() {
  const ss = dataSs_(), kandidati = [], zadosti = {}, akceZeZadosti = {};
  const nazev = (list, r) => String(r['Název'] || r['Titulek'] || r['Družstvo'] || r['Účel'] || r['Popis'] || r['Název souboru'] || (r['Jméno'] ? r['Jméno'] + ' ' + r['Příjmení'] : '') || '');
  const testovaci = (list, r) => /TEST/.test(String(r['ID'] || '')) || TEST_SLOVO.test(nazev(list, r)) || (list === 'Dokumenty' && TEST_SLOVO.test(String(r['Název souboru'] || '')));
  const disk = (list, r) => list === 'Dokumenty' ? r['Soubor – ID'] : list === LIST_ZADOSTI ? r['Přílohy – složka'] : list === LIST_PRISPEVKY ? r['Fotky – složka'] : list === LIST_PRIHLASKY ? r['Složka – ID'] : '';
  const pridat = (list, r, proc, smazat) => kandidati.push([smazat, list, String(r['ID']), nazev(list, r).slice(0, 200), String(r['Stav'] || ''), proc, disk(list, r) ? 'do koše' : '']);

  radky_(LIST_ZADOSTI).forEach(r => { if (r['ID'] && testovaci(LIST_ZADOSTI, r)) { zadosti[r['ID']] = true; if (r['Akce – ID']) akceZeZadosti[r['Akce – ID']] = true; pridat(LIST_ZADOSTI, r, 'testovací žádost', true); } });
  const akceTest = {};
  ['Akce', 'Termíny', 'Dokumenty', LIST_PRISPEVKY, LIST_PRIHLASKY].concat(dataSs_().getSheetByName('Přestupy') ? ['Přestupy'] : []).concat(dataSs_().getSheetByName('Členové') ? ['Členové'] : []) /* testovací členové B17: ID CTEST… */.forEach(list => radky_(list).forEach(r => {
    if (!r['ID']) return;
    if (testovaci(list, r)) { pridat(list, r, 'testovací název nebo ID', true); if (list === 'Akce') akceTest[r['ID']] = true; }
    else if (list === 'Akce' && akceZeZadosti[r['ID']]) { pridat(list, r, 'akce ze schválené testovací žádosti', true); akceTest[r['ID']] = true; }
  }));
  // soutěže (B8): řádky navázané na testovací akci a testovací poháry
  try {
    radky_('Soutěže').forEach(r => { if (akceTest[r['Akce – ID']]) kandidati.push([true, 'Soutěže', String(r['Akce – ID']), 'soutěž k akci ' + r['Akce – ID'], String(r['Stav'] || ''), 'soutěž testovací akce', '']); });
    ['Přihlášky družstev', 'Výsledky'].forEach(list => radky_(list).forEach(r => { if (r['ID'] && akceTest[r['Akce – ID']]) pridat(list, r, 'testovací soutěž ' + r['Akce – ID'], true); }));
    radky_('Poháry').forEach(r => { if (r['ID'] && testovaci('Poháry', r)) pridat('Poháry', r, 'testovací pohár', true); });
  } catch (e) { console.error('Úklid soutěží: ' + e.message); }
  // školení (B18): řádky testovacích akcí, jejich účastníci a testovací kvalifikace
  try {
    if (ss.getSheetByName('Školení')) radky_('Školení').forEach(r => { if (akceTest[r['Akce – ID']]) kandidati.push([true, 'Školení', String(r['Akce – ID']), 'školení k akci ' + r['Akce – ID'], String(r['Stav'] || ''), 'školení testovací akce', '']); });
    if (ss.getSheetByName('Účastníci školení')) radky_('Účastníci školení').forEach(r => { if (r['ID'] && (akceTest[r['Akce – ID']] || testovaci('Účastníci školení', r))) pridat('Účastníci školení', r, 'účastník testovacího školení', true); });
    if (ss.getSheetByName('Kvalifikace')) radky_('Kvalifikace').forEach(r => { if (r['ID'] && (/TEST/.test(String(r['ID'])) || akceTest[r['Akce – ID']])) pridat('Kvalifikace', r, 'testovací kvalifikace', true); });
  } catch (e) { console.error('Úklid školení: ' + e.message); }
  radky_(LIST_REZERVACE).forEach(r => {
    if (!r['ID'] || !(zadosti[r['Žádost – ID']] || testovaci(LIST_REZERVACE, r))) return;
    pridat(LIST_REZERVACE, r, 'rezervace testovací žádosti' + (r['Výpůjčka – ID'] ? ' – výpůjčka ' + r['Výpůjčka – ID'] + ' v Evidenci majetku zůstane, vraťte ji tam' : ''), true);
  });
  radky_(LIST_ZMENY_SBORU).forEach(r => { if (r['ID']) kandidati.push([false, LIST_ZMENY_SBORU, String(r['ID']), String(r['Sbor'] || '') + ': ' + String(r['Popis'] || '').replace(/\n/g, '; ').slice(0, 180), String(r['Stav'] || ''), 'zaškrtněte, jen pokud šlo o test (smaže se jen historie, provedené změny zůstanou)', '']); });

  let sh = ss.getSheetByName(LIST_UKLID);
  if (sh) sh.clear(); else sh = ss.insertSheet(LIST_UKLID);
  sh.getRange(1, 1, 1, UKLID_SLOUPCE.length).setValues([UKLID_SLOUPCE]).setFontWeight('bold').setBackground('#f3f2f2');
  sh.setFrozenRows(1);
  if (kandidati.length) {
    sh.getRange(2, 1, kandidati.length, UKLID_SLOUPCE.length).setValues(kandidati);
    sh.getRange(2, 1, kandidati.length, 1).insertCheckboxes();
    kandidati.forEach((k, i) => { if (k[0]) sh.getRange(i + 2, 1).check(); });
  }
  sh.setColumnWidth(4, 360); sh.setColumnWidth(6, 360);
  ss.setActiveSheet(sh);
  const text = kandidati.length ? 'Kandidátů: ' + kandidati.length + ' (zaškrtnuto ' + kandidati.filter(k => k[0]).length + '). Zkontrolujte list „' + LIST_UKLID + '“ a spusťte uklidTestuProvest.' : 'Žádná testovací data nenalezena.';
  console.log(text); try { ss.toast(text, 'Úklid testů', 10); } catch (e) {}
}

function uklidTestuProvest() {
  const ss = dataSs_(), sh = ss.getSheetByName(LIST_UKLID);
  if (!sh || sh.getLastRow() < 2) throw new Error('Nejdřív spusťte uklidTestuNahled.');
  const kdo = Session.getActiveUser().getEmail() || 'úklid testů';
  const vybrane = sh.getRange(2, 1, sh.getLastRow() - 1, UKLID_SLOUPCE.length).getValues().filter(r => r[0] === true);
  const podleListu = {}; vybrane.forEach(r => (podleListu[r[1]] = podleListu[r[1]] || {})[String(r[2])] = true);
  const vysledek = [], zaznamy = [];
  Object.keys(podleListu).forEach(list => {
    if (UKLID_LISTY.indexOf(list) < 0) return;
    const l = ss.getSheetByName(list), v = l.getDataRange().getValues(), h = v[0].map(String), iId = h.indexOf('ID') >= 0 ? h.indexOf('ID') : h.indexOf('Akce – ID'); // Soutěže nemají vlastní ID
    let n = 0;
    for (let i = v.length - 1; i >= 1; i--) { // odspodu, ať se čísla řádků neposunou
      const r = v[i], id = String(r[iId]);
      if (!podleListu[list][id]) continue;
      const diskId = list === 'Dokumenty' ? r[h.indexOf('Soubor – ID')] : list === LIST_ZADOSTI ? r[h.indexOf('Přílohy – složka')] : list === LIST_PRISPEVKY ? r[h.indexOf('Fotky – složka')] : list === LIST_PRIHLASKY ? r[h.indexOf('Složka – ID')] : '';
      if (diskId) {
        const did = String(diskId).replace(/^.*\/folders\//, '').replace(/^.*\/d\//, '').replace(/[/?].*$/, '');
        try { (list === 'Dokumenty' ? DriveApp.getFileById(did) : DriveApp.getFolderById(did)).setTrashed(true); }
        catch (e) { vysledek.push(list + ' ' + id + ': soubor na Disku nejde dát do koše (' + e.message + ') – smažte ho ručně, jinak ho kontrola Disku přidá znovu.'); }
      }
      l.deleteRow(i + 1);
      zaznamy.push([kdo, list, id, 'smazáno', String(r[h.indexOf('Stav')] || ''), 'úklid testů']);
      n++;
    }
    vysledek.unshift(list + ': smazáno ' + n);
  });
  zaznamZmenyHromadne_(zaznamy);
  try { synchronizovatKalendar(); } catch (e) { vysledek.push('Kalendář: ' + e.message); }
  vycistitCache_();
  sh.getRange(1, UKLID_SLOUPCE.length + 1).setValue('Provedeno ' + Utilities.formatDate(new Date(), 'Europe/Prague', 'd. M. yyyy H:mm') + ': ' + vysledek.join(' | '));
  const text = vysledek.join('\n') || 'Nic nebylo zaškrtnuté.';
  console.log(text); try { ss.toast(text, 'Úklid testů', 15); } catch (e) {}
}
