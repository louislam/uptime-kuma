// Needed per Vite PWA docs
import { precacheAndRoute } from 'workbox-precaching'
declare let self: ServiceWorkerGlobalScope
precacheAndRoute(self.__WB_MANIFEST)

// Receive push notifications
self.addEventListener('push', function (event) {
    
    if (!(
        self.Notification &&
        self.Notification.permission === 'granted'
    )) {
        //notifications aren't supported or permission not granted!
        console.log("Notifications aren't supported or permission not granted!");
        return;
    }

    if (event.data) {
        console.log(event);
        let message = event.data.json();
        self.registration.showNotification(message.title, {
            body: message.body,
        });
    }
});