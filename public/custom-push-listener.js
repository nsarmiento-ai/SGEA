self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || 'SGEA - Notificación';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: data.data || { url: '/mis-autorizaciones' }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || '/mis-autorizaciones', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Focus client if already on the target URL
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        // Navigate and focus any existing tab of this origin if available
        if (windowClients.length > 0) {
          const client = windowClients[0];
          if ('focus' in client) {
            return client.navigate(targetUrl).then(c => c?.focus());
          }
        }
        // Open a new window if none exists
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
