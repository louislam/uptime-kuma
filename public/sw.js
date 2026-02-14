// Service Worker for Uptime Kuma
// Version marker for one-time cache cleanup
const CLEANUP_VERSION = "pwa-cleanup-2.1.1";

// Install event - called when service worker is first installed
self.addEventListener("install", function (event) {
    console.log("Service worker installing...");
    // Force the waiting service worker to become the active service worker
    self.skipWaiting();
});

// Activate event - called when service worker activates
// Clear old caches from vite-plugin-pwa (one-time cleanup for 2.1.0 -> 2.1.1 upgrade)
self.addEventListener("activate", function (event) {
    console.log("Service worker activating...");
    
    event.waitUntil(
        (async function () {
            // Check if we've already cleared vite-plugin-pwa caches
            const cleanupCache = await caches.open("uptime-kuma-cleanup");
            const cleanupDone = await cleanupCache.match(CLEANUP_VERSION);
            
            if (!cleanupDone) {
                // First activation after upgrade - clear vite-plugin-pwa caches
                console.log("Clearing old vite-plugin-pwa caches...");
                const cacheNames = await caches.keys();
                
                // Delete caches that match vite-plugin-pwa patterns (workbox-*)
                // or delete all caches for a clean start (since we don't use caching currently)
                await Promise.all(
                    cacheNames.map(function (cacheName) {
                        // Skip our cleanup tracking cache
                        if (cacheName === "uptime-kuma-cleanup") {
                            return Promise.resolve();
                        }
                        console.log("Deleting cache:", cacheName);
                        return caches.delete(cacheName);
                    })
                );
                
                // Mark cleanup as done
                await cleanupCache.put(CLEANUP_VERSION, new Response("done"));
                console.log("Old PWA caches cleared");
            }
            
            // Take control of all clients immediately
            await self.clients.claim();
            
            console.log("Service worker activated");
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
