
// Service Worker for Д.ПРО v3.1 (Enhanced Push & Geo)
const CACHE_NAME = 'dpro-v3.1-cache';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  
  let data = {
    title: 'Д.ПРО',
    body: 'Новое сообщение в системе',
    url: '/',
    type: 'INFO' // INFO, JOB, SOS, FINANCE
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  // Кастомизация уведомления в зависимости от типа
  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/badge.png',
    tag: data.type === 'SOS' ? 'emergency' : 'dpro-general',
    renotify: true,
    data: { url: data.url },
    // Вибрация: SOS — длинные импульсы, Заказы — двойной короткий
    vibrate: data.type === 'SOS' ? [500, 100, 500, 100, 500] : [200, 100, 200],
    actions: []
  };

  if (data.type === 'JOB') {
    options.actions = [
      { action: 'accept', title: '✅ ПРИНЯТЬ' },
      { action: 'open', title: 'СМОТРЕТЬ' }
    ];
    options.image = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=400&auto=format&fit=crop';
  } else {
    options.actions = [
      { action: 'open', title: 'ОТКРЫТЬ' }
    ];
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = new URL(event.notification.data.url || '/', self.location.origin).href;

  if (event.action === 'accept') {
    // В реальном приложении здесь отправлялся бы API запрос на принятие заказа
    console.log('[SW] Job accepted via notification action');
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
