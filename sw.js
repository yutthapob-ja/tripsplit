const VERSION = '28d5cb12e7';
const CACHE = 'tripsplit-' + VERSION;
const ASSETS = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'src/app.js', 'src/router.js', 'src/store.js',
  'src/core/money.js', 'src/core/currencies.js', 'src/core/split.js', 'src/core/balance.js',
  'src/core/summary.js', 'src/core/backup.js', 'src/core/model.js', 'src/core/promptpay.js', 'src/core/contacts.js', 'src/core/categories.js', 'src/core/search.js',
  'src/ui/qr.js', 'src/ui/qr-sheet.js', 'vendor/qrcode.js',
  'src/ui/dom.js', 'src/ui/groups.js', 'src/ui/group.js', 'src/ui/group-settings.js',
  'src/ui/expense-form.js', 'src/ui/items-editor.js', 'src/ui/backup-ui.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)),
  );
});
