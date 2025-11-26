// Needed per Vite PWA docs
import { precacheAndRoute } from 'workbox-precaching'
declare let self: ServiceWorkerGlobalScope
precacheAndRoute(self.__WB_MANIFEST)

// Receive push notifications
self.addEventListener('push', function (e) {
    if (!(
        self.Notification &&
        self.Notification.permission === 'granted'
    )) {
        //notifications aren't supported or permission not granted!
        return;
    }

    if (e.data) {
        let message = e.data.json();
        e.waitUntil(self.registration.showNotification(message.title, {
            body: message.body,
            // actions: message.actions
        }));
    }
});