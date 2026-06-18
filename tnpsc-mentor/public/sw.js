/* TNPSC Mentor — Web Push service worker.
 *
 * Deliberately minimal: it handles ONLY push delivery and notification clicks.
 * It does not intercept fetch / cache anything, so it can't interfere with the
 * SPA's normal loading or Vite's asset hashing.
 */

// Activate immediately on first install / update instead of waiting for all
// tabs to close — so a freshly-subscribed user can receive a push right away.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// A push arrived: show the OS notification with the server's payload.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: 'TNPSC Mentor', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'TNPSC Mentor'
  const options = {
    body: data.body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    // Keep the deep link + id so the click handler can route + (later) mark read.
    data: { url: data.url || '/', id: data.id || null },
    tag: data.id || undefined,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// Clicking the notification focuses an existing tab (navigating it to the deep
// link) or opens a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(target).catch(() => {})
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    })
  )
})
