// Dashboard render stress test. Manual only; never part of `npm test`.
// Logs in (or runs the setup wizard on a fresh instance), injects N monitors +
// heartbeats into the root Vue instance, and reports render timings.
// Usage: npm run test-perf -- [N] [barMode]
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

// Local disposable perf instance only
const BASE = "http://localhost:3010";
const OUT_DIR = "private/perf";
const USERNAME = "admin";
const PASSWORD = "Kuma-Perf-8f4Q2xR9p";
const COUNT = Number(process.argv[2] || 5000);
const BAR = process.argv[3] || "normal";
const LABEL = `inject-${COUNT}-${BAR}`;

fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const watchdog = setTimeout(
    async () => {
        console.error("WATCHDOG: injecting took too long, aborting");
        try {
            await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 3000))]);
        } catch (_) {}
        process.exit(2);
    },
    90000
);
watchdog.unref?.();
const context = await browser.newContext({
    locale: "en-US",
    viewport: { width: 1600, height: 1000 },
});
await context.addInitScript((bar) => {
    localStorage.heartbeatBarTheme = bar;
    localStorage.locale = "en";
    window.__longtasks = [];
    try {
        new PerformanceObserver((list) => {
            for (const e of list.getEntries()) {
                window.__longtasks.push({ start: e.startTime, dur: e.duration });
            }
        }).observe({ type: "longtask", buffered: true });
    } catch (_) {}
}, BAR);

const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });

// Fresh instance: run the setup wizard so there is an account to log in with
if (page.url().includes("setup-database")) {
    await page.locator('label[for="btnradio1"]').click();
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(`${BASE}/setup`, { timeout: 120000 });
    await page.waitForTimeout(1000);
    await page.locator('input[type="text"]').first().fill(USERNAME);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    await page.locator('input[type="password"]').nth(1).fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 120000 });
}

// Existing instance: log in when the login form is shown
await Promise.race([
    page.waitForSelector("#floatingInput", { timeout: 60000 }),
    page.waitForSelector('[data-testid="monitor-list"]', { timeout: 60000 }),
]);
if (await page.locator("#floatingInput").isVisible()) {
    await page.fill("#floatingInput", USERNAME);
    await page.fill("#floatingPassword", PASSWORD);
    await page.locator('form[aria-label="Login Form"] button[type="submit"]').click();
}

await page.waitForSelector('[data-testid="monitor-list"]', { timeout: 120000 });

const result = await page.evaluate(async (count) => {
    const el = document.querySelector("#app");
    const app = el.__vue_app__._container._vnode.component.proxy;
    const now = Date.now();
    const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
    const mark = () => performance.now();

    // ---- monitor list ----
    const monitors = {};
    for (let i = 1; i <= count; i++) {
        monitors[i] = {
            id: i,
            name: `Monitor ${String(i).padStart(4, "0")}`,
            active: 1,
            parent: null,
            type: "push",
            weight: 0,
            interval: 60,
            url: "",
            tags: i % 10 === 0 ? [{ tag_id: 1, monitor_id: i, value: null, name: "prod", color: "#428bca" }] : [],
            childrenIDs: [],
            notificationIDList: {},
            description: null,
        };
    }
    const tList0 = mark();
    app.monitorList = monitors;
    await raf();
    await raf();
    const tList = mark() - tList0;

    // ---- heartbeat history (N x 100), delivered like the socket burst ----
    const beats = {};
    const uptimes = {};
    const base = Date.now();
    for (let i = 1; i <= count; i++) {
        const arr = [];
        for (let b = 0; b < 100; b++) {
            arr.push({
                id: i * 1000 + b,
                monitorID: i,
                status: b > 96 && i % 37 === 0 ? 0 : 1,
                time: new Date(base - (100 - b) * 60000).toISOString(),
                msg: "OK",
                ping: 100,
                important: 0,
            });
        }
        beats[i] = arr;
        uptimes[`${i}_24`] = 0.9999;
        uptimes[`${i}_720`] = 0.999;
        uptimes[`${i}_1y`] = 0.998;
    }
    const tBeats0 = mark();
    app.heartbeatList = beats;
    app.uptimeList = uptimes;
    await raf();
    await raf();
    const tBeats = mark() - tBeats0;

    // settle watchers (deep watchers + setTimeout slide animation)
    const tSettle0 = mark();
    await new Promise((r) => setTimeout(r, 1500));
    const tSettle = mark() - tSettle0;

    const lt = (window.__longtasks || []).map((x) => x.dur);

    return {
        injectMonitorListMs: Math.round(tList),
        injectHeartbeatsMs: Math.round(tBeats),
        settleMs: Math.round(tSettle),
        domNodes: document.getElementsByTagName("*").length,
        canvases: document.getElementsByTagName("canvas").length,
        rows: document.querySelectorAll('[data-testid="monitor-list"] .draggable-item').length,
        longTasks: lt.length,
        longTasksTotalMs: Math.round(lt.reduce((a, b) => a + b, 0)),
        longestMs: Math.round(Math.max(0, ...lt)),
        heapMB: +(performance.memory?.usedJSHeapSize / 1048576).toFixed(1),
        elapsedMs: Date.now() - now,
    };
}, COUNT);

// Search responsiveness on the fully rendered list
const s0 = Date.now();
await page.fill('input[aria-label="Search monitored sites"]', "Monitor 4999");
await page.waitForFunction(
    () => document.querySelectorAll('[data-testid="monitor-list"] .draggable-item').length <= 1,
    null,
    { timeout: 120000 }
);
result.searchMs = Date.now() - s0;
result.label = LABEL;
result.monitors = COUNT;
result.bar = BAR;
result.errors = errors.slice(0, 3);
console.log(JSON.stringify(result, null, 2));
fs.writeFileSync(path.join(OUT_DIR, `result-${LABEL}.json`), JSON.stringify(result, null, 2));
await page.screenshot({ path: path.join(OUT_DIR, `${LABEL}.png`) });
await browser.close();
