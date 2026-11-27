
/* Společné pro TEST i OSTRÝ (nasadit.sh připojuje za konfiguraci prostředí): React si runtime šablon (support.js) bere z naší domény
   místo unpkg.com – stejné soubory (otisk ověřen proti SRI v support.js), bez cizího serveru a bez dalšího spojení.
   Bez config.js (Claude Design) si je runtime stáhne z unpkg jako dřív. Adresa se počítá od config.js, aby fungovala i ze složky docs/. */
(function () {
  if (typeof document === 'undefined' || !document.currentScript) return;
  var lib = function (f) { return new URL('assets/lib/' + f, document.currentScript.src).href; };
  window.__resources = Object.assign({}, window.__resources, {
    'https://unpkg.com/react@18.3.1/umd/react.production.min.js': lib('react.production.min.js'),
    'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': lib('react-dom.production.min.js')
  });
})();
