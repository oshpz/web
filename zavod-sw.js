/* Offline mezipaměť závodního panelu (zavod.html): panel jde znovu otevřít i bez signálu.
 * Jen soubory panelu z vlastní domény, vždy nejdřív ze sítě (nová verze), bez sítě z mezipaměti. Data soutěže drží zavod.js v localStorage. */
const MEZIPAMET = 'oshpz-zavod-1';
const SOUBORY = ['zavod.html', 'zavod.js', 'souteze.js', 'config.js', '_ds/modernist-b70630ca-c45c-4cbc-b3c7-10cd3a86c121/styles.css'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(MEZIPAMET).then(c => c.addAll(SOUBORY)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x.indexOf('oshpz-zavod-') === 0 && x !== MEZIPAMET).map(x => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return; // server soutěží (POST) a písma jdou mimo mezipaměť
  e.respondWith(fetch(e.request).then(r => {
    if (r && r.ok) { const kopie = r.clone(); caches.open(MEZIPAMET).then(c => c.put(e.request, kopie)).catch(() => {}); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('zavod.html'))));
});
