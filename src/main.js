import "bootstrap";
import { createApp, h } from "vue";
import contenteditable from "vue-contenteditable";
import Toast from "vue-toastification";
import "vue-toastification/dist/index.css";
import App from "./App.vue";
import "./assets/app.scss";
import "./assets/vue-datepicker.scss";
import { i18n } from "./i18n";
import { FontAwesomeIcon } from "./icon.js";
import datetime from "./mixins/datetime";
import mobile from "./mixins/mobile";
import publicMixin from "./mixins/public";
import socket from "./mixins/socket";
import theme from "./mixins/theme";
import lang from "./mixins/lang";
import { router } from "./router";
import { appName } from "./util.ts";
import dayjs from "dayjs";
import timezone from "./modules/dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import relativeTime from "dayjs/plugin/relativeTime";
import { loadToastSettings } from "./util-frontend";
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

const app = createApp({
    mixins: [socket, theme, mobile, datetime, publicMixin, lang],
    data() {
        return {
            appName: appName,
        };
    },
    render: () => h(App),
});

app.use(router);
app.use(i18n);

app.use(Toast, loadToastSettings());
app.component("Editable", contenteditable);
app.component("FontAwesomeIcon", FontAwesomeIcon);

app.mount("#app");

/**
 * Clear old PWA cache from vite-plugin-pwa (removed in 2.1.1)
 * This ensures users get the latest version instead of cached assets
 * @returns {Promise<void>} Promise that resolves when cache is cleared
 */
async function clearOldPWACache() {
    // Check if cache has already been cleared
    try {
        const cacheCleared = localStorage.getItem("pwa-cache-cleared");
        if (cacheCleared) {
            return;
        }
    } catch (error) {
        // localStorage may be unavailable in private browsing mode
        console.warn("localStorage unavailable:", error);
    }

    try {
        // Unregister all existing service workers
        if ("serviceWorker" in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
                console.log("Unregistered old service worker:", registration.scope);
            }
        }

        // Clear all caches (including workbox precache from vite-plugin-pwa)
        if ("caches" in window) {
            const cacheNames = await caches.keys();
            for (const cacheName of cacheNames) {
                await caches.delete(cacheName);
                console.log("Deleted cache:", cacheName);
            }
        }

        console.log("Old PWA cache cleared successfully");

        // Mark cache as cleared (best effort, may fail in private browsing)
        try {
            localStorage.setItem("pwa-cache-cleared", "true");
        } catch (error) {
            console.warn("Could not set localStorage flag:", error);
        }
    } catch (error) {
        console.error("Failed to clear old PWA cache:", error);
    }
}

if ("serviceWorker" in navigator) {
    // Clear old PWA cache first, then register new service worker
    clearOldPWACache()
        .finally(() => {
            // Register service worker regardless of cache clearing outcome
            navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
                console.error("Service worker registration failed:", error);
            });
        });
}

// Expose the vue instance for development
if (process.env.NODE_ENV === "development") {
    console.log("Dev Only: window.app is the vue instance");
    window.app = app._instance;
}
