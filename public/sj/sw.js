importScripts('/sj/scramjet.all.js');
const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => e.respondWith((async () => {
  await scramjet.loadConfig();
  return scramjet.route(e) ? scramjet.fetch(e) : fetch(e.request);
})()));
