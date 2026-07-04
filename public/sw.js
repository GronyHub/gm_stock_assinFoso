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
self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request))
})
