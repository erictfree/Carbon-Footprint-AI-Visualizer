/* Retire older PromptMiles/Burger Works service workers on this origin.
 * The local prototype changes frequently, so browser caching must never pin a
 * previous animation path or profile UI. */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    await self.registration.unregister();

    const windows = await self.clients.matchAll({ type: 'window' });
    for (const client of windows) {
      await client.navigate(client.url);
    }
  })());
});
