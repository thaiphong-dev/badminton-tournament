// Push event handler — injected into Workbox SW via importScripts or included via vite-plugin-pwa's additionalManifestEntries
// This file handles incoming push notifications from the server

self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try { payload = event.data.json() } catch { payload = { title: 'Thông báo mới', body: event.data.text() } }

  const { title = 'Badminton TM', body = '', url = '/', icon = '/pwa-192.svg', badge = '/pwa-192.svg' } = payload

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      data:    { url },
      vibrate: [200, 100, 200],
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
