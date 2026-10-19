/* VYGENEROVÁNO: ./nasadit.sh test z prostredi/test.config.js (5f73a09). Needitovat – upravte prostredi/test.config.js a nasaďte znovu. */
/* Prostředí TEST (test.oshpz.cz). Z tohoto souboru vytvoří nasadit.sh soubor config.js v kořeni webu – config.js needitujte ručně.
   Hodnoty jsou veřejné (adresa serveru, veřejný klíč Turnstile, ID kalendáře) – tajné klíče patří do Vlastností skriptu, nikdy sem. */
window.OSH_CONFIG = Object.freeze({
  prostredi: 'TEST',
  apiUrl: 'https://script.google.com/macros/s/AKfycbz175mnWiIWxmQbf9lRKkL8rNHIZzpBKq9p_B85IzVsYZhTgQYSSROeZiLGprEnNodA/exec',
  turnstileSitekey: '0x4AAAAAAFQXzTDrG7tWfz7m',
  webUrl: 'https://test.oshpz.cz',
  aplikaceUrl: 'https://test.oshpz.cz/Aplikace%20OSH.dc.html',
  kalendarId: 'c_fc2074828901426d752a8489df57f1a88ce228719f9d4db3cc78a4c79ef65cee@group.calendar.google.com',
  dataUrl: 'data/web.json'
});

/* Jen v TESTu: nenápadný proužek „Testovací verze“ nad stránkou (ne přes ni – na telefonu nezakrývá navigaci). */
(function () {
  if (typeof document === 'undefined' || /\/docs\//.test(location.pathname)) return; // interní podklady (plán) bez proužku
  var vlozit = function () {
    if (document.getElementById('osh-test-pruh')) return;
    var d = document.createElement('div');
    d.id = 'osh-test-pruh'; d.setAttribute('role', 'note');
    d.textContent = 'Testovací verze – údaje nejsou ostré';
    d.style.cssText = 'background:var(--color-action,#ae1800);color:#fff;font:600 12.5px/1.4 Archivo,Arial,sans-serif;padding:3px 16px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    document.body.insertBefore(d, document.body.firstChild);
  };
  if (document.body) vlozit(); else document.addEventListener('DOMContentLoaded', vlozit);
})();
