/* Dienst op de achtergrond van de webversie: bewaart de editor in de browser, zodat hij ook
   zonder internet opent. Met internet komt altijd de versie van de website; lukt dat niet,
   dan de laatst bewaarde. */

const BEWAARD = 'instructiekaart-1';
const BESTANDEN = ['./', 'manifest.webmanifest', 'icoon.svg', 'icoon-192.png', 'icoon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(BEWAARD).then((kast) => kast.addAll(BESTANDEN)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

async function haal(verzoek) {
  const kast = await caches.open(BEWAARD);
  const bewaard = async () =>
    (await kast.match(verzoek, { ignoreSearch: true })) || (verzoek.mode === 'navigate' ? kast.match('./') : undefined);
  try {
    const antwoord = await fetch(verzoek);
    if (antwoord.ok) {
      kast.put(verzoek, antwoord.clone());
      return antwoord;
    }
    return (await bewaard()) || antwoord;
  } catch (fout) {
    return (await bewaard()) || Response.error();
  }
}

self.addEventListener('fetch', (e) => {
  const verzoek = e.request;
  if (verzoek.method !== 'GET' || new URL(verzoek.url).origin !== self.location.origin) return;
  e.respondWith(haal(verzoek));
});
