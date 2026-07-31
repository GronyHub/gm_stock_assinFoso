// Take over from any previously-installed SW immediately on the next load,
// instead of waiting for every tab of the site to be closed first -- without
// this, a fix shipped here (like the navigate passthrough removed below)
// can't reach an already-open device until it fully quits the app.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(clients.claim()))

self.addEventListener('push', event => {
  if (!event.data) return
  const { title, body } = event.data.json()
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(clients.openWindow('/logs'))
})

// Pass-through fetch handler -- no offline caching, but its presence is part
// of what makes the app installable (PWA / Trusted Web Activity criteria).
// Navigations are left alone (not respondWith'd) so the browser loads pages
// directly -- letting the SW re-fetch a top-level navigation that chains
// through a redirect (e.g. / -> /item -> login) is what was causing repeated
// "This page couldn't load" failures on some mobile Chrome versions.
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') return
  event.respondWith(fetch(event.request))
})
