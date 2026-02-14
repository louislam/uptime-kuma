// Install event - called when service worker is first installed
self.addEventListener("install", function (event) {
    console.log("Service worker installing...");
    // Force the waiting service worker to become the active service worker
    self.skipWaiting();
});

// Activate event - called when service worker activates
// This is where we clean up old caches from vite-plugin-pwa
self.addEventListener("activate", function (event) {
    console.log("Service worker activating...");
    
    event.waitUntil(
        (async function () {
            // Clear all caches (including old workbox precache from vite-plugin-pwa)
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map(function (cacheName) {
                    console.log("Deleting cache:", cacheName);
                    return caches.delete(cacheName);
                })
            );
            
            // Take control of all clients immediately
            await self.clients.claim();
            
            console.log("Service worker activated and old caches cleared");
        })()
    );
});

// Receive push notifications
self.addEventListener("push", function (event) {
    if (self.Notification?.permission !== "granted") {
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
            console.error("Failed to show notification:", error);
        }
    }
});
