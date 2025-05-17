// Needed per Vite PWA docs
import { precacheAndRoute } from 'workbox-precaching'
declare let self: ServiceWorkerGlobalScope
precacheAndRoute(self.__WB_MANIFEST)

// Receive push notifications
self.addEventListener('push', function (event) {
    if (self.Notification?.permission !== 'granted') {
        console.error("Notifications aren't supported or permission not granted!");
        return;
    }

    if (event.data) {
        let message = event.data.json();
        try {
            self.registration.showNotification(message.title, {
                body: message.body,
            });
        } catch (error) {
            console.error('Failed to show notification:', error);
        }
    }
});
