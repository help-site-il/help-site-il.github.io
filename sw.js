/* Help Site service worker: lets the site open without internet.
   - Pages: network first, so a new version always arrives when the visitor is online.
     If the network fails or is very slow, the saved copy is shown instead.
   - Fonts and icons: saved copy first (they almost never change).
   Nothing is sent anywhere and no personal data is stored; only copies of the site's own files.
   To force every device to refresh its saved files, change VERSION. */
const VERSION = 'v1';
const CACHE = 'help-site-' + VERSION;
const BASE = self.registration.scope;
const PRECACHE = [
  '', 'en/', 'ar/',
  'favicon.svg', 'favicon.ico', 'site.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/heebo-hebrew.woff2', 'fonts/heebo-latin.woff2',
  'fonts/rubik-hebrew.woff2', 'fonts/rubik-latin.woff2', 'fonts/rubik-arabic.woff2'
].map(function (p) { return new URL(p, BASE).href; });

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(PRECACHE.map(function (u) { return c.add(u).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.indexOf('help-site-') === 0 && k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function save(request, response) {
  if (response && response.ok && response.type === 'basic') {
    var copy = response.clone();
    caches.open(CACHE).then(function (c) { c.put(request, copy); });
  }
  return response;
}

function cacheFirst(request) {
  return caches.match(request).then(function (hit) {
    if (hit) return hit;
    return fetch(request).then(function (res) { return save(request, res); }).catch(function () { return Response.error(); });
  });
}

function networkFirst(request) {
  var network = fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' });
  var slow = new Promise(function (_, reject) { setTimeout(function () { reject(new Error('slow')); }, 4000); });
  return Promise.race([network, slow]).then(function (res) { return save(request, res); }).catch(function () {
    return caches.match(request, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      if (request.mode === 'navigate') {
        var rel = request.url.slice(BASE.length);
        var home = rel.indexOf('en/') === 0 ? 'en/' : rel.indexOf('ar/') === 0 ? 'ar/' : '';
        return caches.match(new URL(home, BASE).href).then(function (fb) { return fb || Response.error(); });
      }
      return Response.error();
    });
  });
}

self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  if (r.url.indexOf(BASE) !== 0) return;
  var rel = r.url.slice(BASE.length);
  if (rel.indexOf('fonts/') === 0 || rel.indexOf('icons/') === 0) { e.respondWith(cacheFirst(r)); return; }
  e.respondWith(networkFirst(r));
});
