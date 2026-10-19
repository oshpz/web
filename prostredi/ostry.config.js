/* Prostředí OSTRÝ PROVOZ (oshpz.cz). Z tohoto souboru vytvoří nasadit.sh ostry soubor config.js v repozitáři oshpz/web-ostry.
   Dokud tu je DOPLNIT, nasadit.sh ostry odmítne nasadit. Postup a odkud vzít hodnoty: docs/spusteni-ostre.md.
   Hodnoty jsou veřejné – tajné klíče (TURNSTILE_SECRET, GITHUB_TOKEN) patří do Vlastností skriptu, nikdy sem. */
window.OSH_CONFIG = Object.freeze({
  prostredi: 'OSTRY',
  apiUrl: 'https://script.google.com/macros/s/DOPLNIT-ID-NASAZENI-OSTREHO-SKRIPTU/exec',
  turnstileSitekey: 'DOPLNIT',
  webUrl: 'https://oshpz.cz',
  aplikaceUrl: 'https://oshpz.cz/Aplikace%20OSH.dc.html',
  kalendarId: 'DOPLNIT@group.calendar.google.com',
  dataUrl: 'data/web.json'
});
