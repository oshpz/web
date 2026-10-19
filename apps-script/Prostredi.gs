/**
 * Kontrola prostředí (L0): co chybí, aby aplikace v tomto prostředí (TEST / OSTRY) běžela. Nic nemění – jen čte a vypíše.
 * Spuštění: tabulka → OSH data → Kontrola prostředí, nebo Apps Script → vybrat kontrolaProstredi → Spustit.
 * Výsledek je v listu „Kontrola prostředí“ (OK / CHYBÍ / POZOR) a v protokolu. Postup spuštění ostrého provozu: docs/spusteni-ostre.md.
 */

const LIST_KONTROLA_PROSTREDI = 'Kontrola prostředí';
// klíče Nastavení, bez kterých aplikace nefunguje (ostatní mají rozumné výchozí hodnoty)
const PST_POVINNE = ['REZIM', 'DOMENA', 'ODESILATEL', 'DISK_ID', 'SLOZKA_ORGANY', 'KALENDAR_ID', 'WEB_URL', 'TABULKA_ID', 'TURNSTILE_SITEKEY',
  'MAJETEK_CISELNIKY_ID', 'MAJETEK_TABULKA_ID', 'MAJETEK_VYPUJCKY_ID', 'MAJETEK_FOTO_DISK', 'SKUPINY_TABULKA_ID', 'OKRES_UCET'];
const PST_DOPORUCENE = ['TURNSTILE_DOMENY', 'GITHUB_REPO', 'PRISPEVKY_EMAIL'];
const PST_SKUPINY = ['spravci', 'sbory', 'sbory-mh', 'sbory-jsdh', 'sbory-sport'];

function kontrolaProstredi() {
  const ss = dataSs_(), vys = [], pp = PropertiesService.getScriptProperties();
  const ok = (oblast, co, detail) => vys.push(['OK', oblast, co, detail || '']);
  const chybi = (oblast, co, detail) => vys.push(['CHYBÍ', oblast, co, detail || '']);
  const pozor = (oblast, co, detail) => vys.push(['POZOR', oblast, co, detail || '']);
  const zkus = (oblast, co, fn) => { try { const d = fn(); if (d !== false) ok(oblast, co, d || ''); } catch (e) { chybi(oblast, co, e.message); } };
  vycistitMezipamet_('Nastavení');
  const N = k => nastaveniWeb_(k), rezim = N('REZIM'), prostredi = String(pp.getProperty('PROSTREDI') || '').toUpperCase(), ostry = rezim === 'OSTRY';

  // 1) prostředí
  if (rezim !== 'TEST' && rezim !== 'OSTRY') chybi('Prostředí', 'Nastavení REZIM', 'musí být TEST, nebo OSTRY (je „' + rezim + '“)');
  else ok('Prostředí', 'Nastavení REZIM', rezim);
  if (!prostredi) pozor('Prostředí', 'Vlastnost skriptu PROSTREDI', 'není nastavená – doplní ji Založit / doplnit strukturu');
  else if (prostredi !== rezim) chybi('Prostředí', 'Vlastnost skriptu PROSTREDI', prostredi + ' nesouhlasí s REZIM ' + rezim);
  else ok('Prostředí', 'Vlastnost skriptu PROSTREDI', prostredi);
  const ucet = Session.getEffectiveUser().getEmail();
  if (ostry && normEmail_(ucet) !== normEmail_(N('ODESILATEL'))) pozor('Prostředí', 'Účet skriptu', ucet + ' – ostrý projekt má běžet pod ' + N('ODESILATEL') + ' (B9.3)');
  else ok('Prostředí', 'Účet skriptu', ucet);
  if (ostry && /TEST/i.test(ss.getName())) chybi('Prostředí', 'Tabulka', 'ostrý režim, ale tabulka se jmenuje „' + ss.getName() + '“');
  else ok('Prostředí', 'Tabulka', ss.getName());

  // 2) Nastavení a Vlastnosti skriptu
  PST_POVINNE.forEach(k => { if (N(k)) ok('Nastavení', k, k.indexOf('ID') >= 0 || k.indexOf('DISK') >= 0 ? 'vyplněno' : N(k)); else chybi('Nastavení', k, 'prázdné'); });
  PST_DOPORUCENE.forEach(k => { if (N(k)) ok('Nastavení', k, N(k)); else pozor('Nastavení', k, 'prázdné – funkce je vypnutá'); });
  if (N('TABULKA_ID') && N('TABULKA_ID') !== ss.getId()) chybi('Nastavení', 'TABULKA_ID', 'neukazuje na tuto tabulku');
  if (pp.getProperty('TABULKA_ID') !== ss.getId()) chybi('Vlastnosti skriptu', 'TABULKA_ID', 'spusťte Založit / doplnit strukturu');
  else ok('Vlastnosti skriptu', 'TABULKA_ID', 'tato tabulka');
  if (pp.getProperty('TURNSTILE_SECRET')) ok('Vlastnosti skriptu', 'TURNSTILE_SECRET', 'vyplněno'); else chybi('Vlastnosti skriptu', 'TURNSTILE_SECRET', 'bez něj nejde poslat přihlašovací kód ani veřejná přihláška');
  if (pp.getProperty('GITHUB_TOKEN')) ok('Vlastnosti skriptu', 'GITHUB_TOKEN', 'vyplněno'); else pozor('Vlastnosti skriptu', 'GITHUB_TOKEN', 'bez něj se nezapisuje data/web.json (web načte data jen ze serveru)');
  if (ostry && /test\./i.test(N('WEB_URL'))) chybi('Nastavení', 'WEB_URL', 'ostrý režim s testovací adresou ' + N('WEB_URL'));
  if (ostry && N('GITHUB_REPO') === 'oshpz/web') chybi('Nastavení', 'GITHUB_REPO', 'ostrý režim by zapisoval do testovacího repozitáře');

  // 3) přístup k prostředkům
  if (N('DISK_ID')) zkus('Disk', 'Sdílený disk DISK_ID', () => {
    const d = Drive.Drives.get(N('DISK_ID'), { fields: 'name,capabilities' });
    if (ostry && /TEST/i.test(d.name)) throw new Error('ostrý režim, ale disk se jmenuje „' + d.name + '“');
    if (!d.capabilities || !d.capabilities.canAddChildren) throw new Error('„' + d.name + '“ – účet skriptu nemá právo přidávat soubory (potřeba Správce obsahu nebo Správce)');
    const it = DriveApp.getFolderById(N('DISK_ID')).getFoldersByName(N('SLOZKA_ORGANY'));
    if (!it.hasNext()) throw new Error('„' + d.name + '“ – chybí složka „' + N('SLOZKA_ORGANY') + '“');
    const org = it.next(), maji = []; const f = org.getFolders(); while (f.hasNext()) maji.push(f.next().getName());
    const chybiOrg = ORGANY_PORADI.filter(o => maji.indexOf(o) < 0);
    if (chybiOrg.length) throw new Error('ve složce „' + N('SLOZKA_ORGANY') + '“ chybí podsložky ' + chybiOrg.join(', '));
    return d.name + ', složky orgánů úplné';
  });
  if (N('DISK_ID')) zkus('Disk', 'Sborové skupiny nejsou členy disku', () => {
    const lide = []; let token;
    do { const r = Drive.Permissions.list(N('DISK_ID'), { supportsAllDrives: true, fields: 'nextPageToken,permissions(emailAddress,role)', pageToken: token }); (r.permissions || []).forEach(x => lide.push(x.emailAddress || '')); token = r.nextPageToken; } while (token);
    const sborove = lide.filter(e => /^(sdh-|okrsek-|sbory)/i.test(e));
    if (sborove.length) throw new Error('na disku jsou sborové skupiny ' + sborove.join(', ') + ' – odeberte je (sdílí se jednotlivé soubory)');
    return lide.length + ' členů disku';
  });
  if (N('KALENDAR_ID')) zkus('Kalendář', 'KALENDAR_ID', () => {
    const c = CalendarApp.getCalendarById(N('KALENDAR_ID'));
    if (!c) throw new Error('účet skriptu kalendář nevidí – sdílejte ho s ním s právem Provádět změny událostí');
    if (ostry && /TEST/i.test(c.getName())) throw new Error('ostrý režim, ale kalendář se jmenuje „' + c.getName() + '“');
    return c.getName();
  });
  [['MAJETEK_CISELNIKY_ID', 'Evidence majetku – číselníky'], ['MAJETEK_TABULKA_ID', 'Evidence majetku'], ['MAJETEK_VYPUJCKY_ID', 'Evidence majetku – výpůjčky'], ['SKUPINY_TABULKA_ID', 'Tabulka Skupiny OSH']].forEach(([k, nazev]) => {
    if (N(k)) zkus('Tabulky', nazev + ' (' + k + ')', () => {
      const f = DriveApp.getFileById(N(k)), pravo = f.getAccess(Session.getEffectiveUser());
      if (pravo !== DriveApp.Permission.EDIT && pravo !== DriveApp.Permission.OWNER && pravo !== DriveApp.Permission.ORGANIZER && pravo !== DriveApp.Permission.FILE_ORGANIZER) throw new Error('„' + f.getName() + '“ – účet skriptu nemá právo úprav');
      return f.getName();
    });
  });
  if (N('MAJETEK_FOTO_DISK')) zkus('Disk', 'Disk fotek majetku (MAJETEK_FOTO_DISK)', () => Drive.Drives.get(N('MAJETEK_FOTO_DISK'), { fields: 'name' }).name);

  // 4) skupiny a pošta
  const dom = N('DOMENA') || 'oshpz.cz';
  PST_SKUPINY.forEach(g => zkus('Skupiny', g + '@' + dom, () => { AdminDirectory.Groups.get(g + '@' + dom); return 'existuje'; }));
  zkus('Skupiny', 'Skupiny sborů sdh-…', () => {
    const r = AdminDirectory.Groups.list({ domain: dom, maxResults: 200, query: 'email:sdh-*' }), n = ((r && r.groups) || []).length;
    if (!n) throw new Error('účet skriptu nevidí žádnou skupinu sdh-… (potřebuje roli správce skupin v Admin konzoli)');
    return n + ' skupin';
  });
  if (N('PRISPEVKY_EMAIL')) zkus('Pošta', 'Alias ' + N('PRISPEVKY_EMAIL'), () => {
    const a = GmailApp.getAliases().map(normEmail_), e = normEmail_(N('PRISPEVKY_EMAIL'));
    if (normEmail_(ucet) !== e && a.indexOf(e) < 0) throw new Error('není alias účtu ' + ucet + ' – přesuňte ho v Admin konzoli (Uživatelé → ' + ucet + ' → Alternativní e-maily)');
    return 'alias účtu ' + ucet;
  });
  zkus('Pošta', 'Denní kvóta e-mailů', () => MailApp.getRemainingDailyQuota() + ' zbývá dnes');
  if (!ostry) pozor('Pošta', 'Režim TEST', 'e-maily jdou jen na ' + (N('TEST_EMAIL') || '(TEST_EMAIL prázdné)') + (N('TEST_KODY_PRIMO') !== 'NE' ? ', přihlašovací kódy rovnou uživatelům' : ''));

  // 5) časovače
  const bezi = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  const chybiCas = SPOUSTENI_FUNKCE.filter(f => typeof globalThis[f] === 'function' && bezi.indexOf(f) < 0);
  if (chybiCas.length) chybi('Časovače', 'nastavitSpousteni', 'neběží: ' + chybiCas.join(', ') + ' – spusťte nastavitSpousteni');
  else ok('Časovače', 'nastavitSpousteni', bezi.length + ' spouštění');

  // 6) web a GitHub
  const web = String(N('WEB_URL') || '').replace(/\/+$/, '');
  if (web) zkus('Web', web + '/config.js', () => {
    const res = UrlFetchApp.fetch(web + '/config.js', { muteHttpExceptions: true, followRedirects: true });
    if (res.getResponseCode() !== 200) throw new Error('web neodpovídá (HTTP ' + res.getResponseCode() + ') – nasazený web? DNS?');
    const t = res.getContentText(), pr = (t.match(/prostredi:\s*'([A-Z]+)'/) || [])[1], api = (t.match(/apiUrl:\s*'([^']*)'/) || [])[1], klic = (t.match(/turnstileSitekey:\s*'([^']*)'/) || [])[1];
    const vady = [];
    if (pr !== rezim) vady.push('config.js má prostředí ' + pr + ', server ' + rezim);
    if (klic != null && N('TURNSTILE_SITEKEY') && klic !== N('TURNSTILE_SITEKEY')) vady.push('jiný TURNSTILE_SITEKEY než v Nastavení');
    if (!api) vady.push('config.js nemá apiUrl');
    else {
      const ping = JSON.parse(UrlFetchApp.fetch(api + '?co=ping', { muteHttpExceptions: true }).getContentText() || '{}');
      if (ping.rezim !== rezim) vady.push('apiUrl z config.js vede na server v režimu ' + (ping.rezim || '?') + ' (jiné nasazení?)');
    }
    if (vady.length) throw new Error(vady.join('; '));
    return 'prostředí ' + pr + ', server odpovídá';
  });
  if (N('GITHUB_REPO') && pp.getProperty('GITHUB_TOKEN')) zkus('GitHub', N('GITHUB_REPO'), () => {
    const res = UrlFetchApp.fetch('https://api.github.com/repos/' + N('GITHUB_REPO'), { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + pp.getProperty('GITHUB_TOKEN'), Accept: 'application/vnd.github+json' } });
    if (res.getResponseCode() !== 200) throw new Error('token repozitář nevidí (HTTP ' + res.getResponseCode() + ') – fine-grained token musí mít tento repozitář a Contents: Read and write');
    const j = JSON.parse(res.getContentText());
    if (j.permissions && !j.permissions.push) throw new Error('token nemá právo zápisu (Contents: Read and write)');
    return 'token smí zapisovat';
  });

  // výpis
  const chyb = vys.filter(r => r[0] === 'CHYBÍ').length, varovani = vys.filter(r => r[0] === 'POZOR').length;
  const souhrn = (chyb ? 'Chybí ' + chyb + ' věcí' : 'Vše potřebné je nastavené') + (varovani ? ', ' + varovani + '× pozor' : '') + ' (' + rezim + ', ' + Utilities.formatDate(new Date(), 'Europe/Prague', 'd. M. yyyy H:mm') + ')';
  try {
    let sh = ss.getSheetByName(LIST_KONTROLA_PROSTREDI);
    if (sh) sh.clear(); else sh = ss.insertSheet(LIST_KONTROLA_PROSTREDI);
    sh.getRange(1, 1, 1, 4).setValues([['Výsledek', 'Oblast', 'Co', 'Podrobnosti']]).setFontWeight('bold').setBackground('#f3f2f2');
    sh.getRange(2, 1, vys.length, 4).setValues(vys);
    vys.forEach((r, i) => sh.getRange(i + 2, 1).setBackground(r[0] === 'OK' ? '#d3f9d8' : r[0] === 'POZOR' ? '#fff3bf' : '#ffc9c9'));
    sh.getRange(vys.length + 3, 1).setValue(souhrn).setFontWeight('bold');
    sh.setFrozenRows(1); sh.setColumnWidth(3, 300); sh.setColumnWidth(4, 520);
    try { ss.setActiveSheet(sh); ss.toast(souhrn, 'Kontrola prostředí', 15); } catch (e) {}
  } catch (e) { console.warn('List kontroly nejde zapsat: ' + e.message); }
  const text = souhrn + '\n' + vys.map(r => r[0].padEnd(6) + r[1] + ' › ' + r[2] + (r[3] ? ' – ' + r[3] : '')).join('\n');
  console.log(text);
  return text;
}
