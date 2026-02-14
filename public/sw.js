self.addEventListener("install", function (event) {
    // Force the waiting service worker to become the active service worker
    self.skipWaiting();
});

// Clear old caches from vite-plugin-pwa
self.addEventListener("activate", function (event) {
    console.log("Service worker activating...");

    event.waitUntil(
        (async function () {
            // Check if we've already cleared
            const cleanupCache = await caches.open("uptime-kuma-clean-pwa");
            const cleanupDone = await cleanupCache.match("2.1.0");

            if (!cleanupDone) {
                const cacheNames = await caches.keys();
                for (const cacheName of cacheNames) {
                    // Skip our cleanup tracking cache
                    if (cacheName === "uptime-kuma-cleanup") {
                        continue;
                    }
                    await caches.delete(cacheName);
                }

                // Mark cleanup as done
                await cleanupCache.put("2.1.0", new Response("done"));
                console.log("Old PWA caches cleared");
            }

            await self.clients.claim();
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
