/**
 * OSH data – F3 ochrana veřejných formulářů a přihlášení.
 * Nový soubor „Ochrana“ ve stejném projektu.
 *
 * Turnstile (Cloudflare): veřejný klíč (site key) v listu Nastavení → TURNSTILE_SITEKEY (web si ho vezme z ?co=ping),
 *   tajný klíč jen ve Vlastnostech skriptu → TURNSTILE_SECRET (nikdy do tabulky ani do repozitáře).
 *   Povolené domény: Nastavení → TURNSTILE_DOMENY (čárkou), prázdné = doména z WEB_URL.
 *   Chybí klíč, token nebo nesedí doména → v režimu TEST jen varování, v režimu OSTRY odmítnutí.
 *   Neplatný token (Cloudflare ho odmítl) se odmítá vždy.
 * Limity: pevná okna v CacheService, překročení se zapíše do Záznamu změn (jednou za okno).
 * Kontrola vstupů: délka, žádné HTML, žádný vzorec na začátku; soubory jen povolené typy a velikost.
 */

/* ---------- Turnstile ---------- */

function ostryRezim_() { return nastaveniWeb_('REZIM') === 'OSTRY'; }

/** Vrátí null, když je vše v pořádku (nebo v TESTu jen varování), jinak text chyby pro uživatele. */
function overitTurnstile_(token, akce) {
  const secret = PropertiesService.getScriptProperties().getProperty('TURNSTILE_SECRET');
  const varovat = duvod => {
    console.warn('Turnstile (' + akce + '): ' + duvod + (ostryRezim_() ? ' – odmítnuto.' : ' – režim TEST, jen varování.'));
    return ostryRezim_() ? 'Ověření proti robotům se nepodařilo. Obnovte stránku a zkuste to znovu.' : null;
  };
  if (!secret) return varovat('chybí TURNSTILE_SECRET ve vlastnostech skriptu');
  if (!token) return varovat('chybí token z prohlížeče');
  const res = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',
    { method: 'post', payload: { secret: secret, response: String(token).slice(0, 2048) }, muteHttpExceptions: true });
  let j = {};
  try { j = JSON.parse(res.getContentText()); } catch (e) { return varovat('Cloudflare neodpověděl (' + res.getResponseCode() + ')'); }
  if (!j.success) { console.warn('Turnstile (' + akce + '): neplatný token ' + JSON.stringify(j['error-codes'] || [])); return 'Ověření proti robotům se nepodařilo. Obnovte stránku a zkuste to znovu.'; }
  const domeny = (nastaveniWeb_('TURNSTILE_DOMENY') || hostitel_(nastaveniWeb_('WEB_URL'))).split(/[,;\s]+/).filter(Boolean).map(x => x.toLowerCase());
  if (domeny.length && domeny.indexOf(String(j.hostname || '').toLowerCase()) < 0) return varovat('doména ' + j.hostname + ' není v ' + domeny.join(', '));
  if (j.action && akce && j.action !== akce) return varovat('akce ' + j.action + ' místo ' + akce);
  return null;
}

function hostitel_(url) { const m = String(url || '').match(/^https?:\/\/([^\/:?#]+)/i); return m ? m[1] : ''; }

/* ---------- limity ---------- */

/** Pevné okno: vrátí true, když je limit překročen. Překročení zapíše do Záznamu změn jednou za okno. */
function limit_(nazev, kdo, max, oknoS) {
  const c = CacheService.getScriptCache(), okno = Math.floor(Date.now() / (oknoS * 1000)), klic = 'l_' + nazev + '_' + otisk_(kdo).slice(0, 32) + '_' + okno;
  const n = Number(c.get(klic) || 0);
  if (n >= max) {
    if (!c.get(klic + '_z')) {
      c.put(klic + '_z', '1', oknoS);
      try { zaznamZmeny_(kdo, 'Přihlášení', '', 'přihlášení', '', 'limit překročen: ' + nazev + ' (' + max + ' za ' + Math.round(oknoS / 60) + ' min)'); } catch (e) { console.error(e); }
    }
    return true;
  }
  c.put(klic, String(n + 1), oknoS);
  return false;
}

/** Blokace e-mailu po chybných kódech. */
function blokovan_(email) { return !!CacheService.getScriptCache().get('b_' + otisk_(email)); }
function zablokovat_(email, sekund) {
  CacheService.getScriptCache().put('b_' + otisk_(email), '1', sekund);
  try { zaznamZmeny_(email, 'Přihlášení', '', 'přihlášení', '', 'blokováno na ' + Math.round(sekund / 60) + ' min po ' + KOD_POKUSU + ' chybných kódech'); } catch (e) { console.error(e); }
}

/* ---------- kontrola vstupů ---------- */

const HTML_VZOR = /<\s*[a-z!\/?]|&#|javascript:/i, VZOREC_VZOR = /^[=+\-@]/;

/** Zkontroluje textová pole. pravidla = { 'Název': 200, … } (max. délka). Vrací text chyby nebo null. */
function kontrolaTextu_(data, pravidla) {
  for (const k in pravidla) {
    if (!(k in data) || data[k] == null || data[k] === '') continue;
    const v = String(data[k]);
    if (v.length > pravidla[k]) return 'Pole „' + k + '“ je příliš dlouhé (nejvýše ' + pravidla[k] + ' znaků).';
    if (HTML_VZOR.test(v)) return 'Pole „' + k + '“ nesmí obsahovat HTML značky.';
    if (VZOREC_VZOR.test(v.trim())) return 'Pole „' + k + '“ nesmí začínat znakem =, +, - ani @.';
  }
  return null;
}

function kontrolaVolby_(hodnota, povolene, pole) {
  return hodnota == null || hodnota === '' || povolene.indexOf(String(hodnota)) >= 0 ? null : 'Neplatná hodnota v poli „' + pole + '“.';
}

function kontrolaData_(hodnota, pole) {
  if (hodnota == null || hodnota === '') return null;
  const d = new Date(hodnota);
  return isNaN(d.getTime()) || d.getFullYear() < 1990 || d.getFullYear() > new Date().getFullYear() + 5 ? 'Neplatné datum v poli „' + pole + '“.' : null;
}

function kontrolaOdkazu_(hodnota, pole) {
  return !hodnota || /^https:\/\/[^\s<>"']{3,490}$/i.test(String(hodnota)) ? null : 'Pole „' + pole + '“ musí být odkaz začínající https://.';
}

/** Soubory z veřejných formulářů (B7 přihláška člena, skeny): jen tyto typy a velikost. Vrací text chyby nebo null. */
const SOUBORY_POVOLENE = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/webp': 'webp' };
const SOUBOR_MAX_MB = 10;
// povolene = jiný seznam typů { mime: přípona } (např. přílohy příspěvků PDF, DOCX, XLSX); výchozí SOUBORY_POVOLENE
function overitSoubor_(nazev, mime, velikost, povolene) {
  const typy = povolene || SOUBORY_POVOLENE;
  if (!typy[mime]) return 'Soubor „' + nazev + '“ má nepovolený typ. Povolené jsou ' + Object.keys(typy).map(k => typy[k].toUpperCase()).filter((x, i, a) => a.indexOf(x) === i).join(', ') + '.';
  if (!(velikost > 0) || velikost > SOUBOR_MAX_MB * 1024 * 1024) return 'Soubor „' + nazev + '“ je větší než ' + SOUBOR_MAX_MB + ' MB.';
  if (String(nazev).length > 200 || /[\/\\<>:"|?*\x00-\x1f]/.test(String(nazev))) return 'Název souboru obsahuje nepovolené znaky.';
  return null;
}
