const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const path = require("path");
const Database = require("../database");
const jwt = require("jsonwebtoken");
const {
    getBrowserForMonitor,
    resetChrome,
    testChrome,
    testRemoteBrowser,
} = require("./browser-runtime");
class RealBrowserMonitorType extends MonitorType {
    name = "real-browser";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, server) {
        const browser = await getBrowserForMonitor(monitor);
        const context = await browser.newContext();
        const page = await context.newPage();

        // Prevent Local File Inclusion
        // Accept only http:// and https://
        // https://github.com/louislam/uptime-kuma/security/advisories/GHSA-2qgm-m29m-cj2h
        let url = new URL(monitor.url);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
            throw new Error("Invalid url protocol, only http and https are allowed.");
        }

        const res = await page.goto(monitor.url, {
            waitUntil: "networkidle",
            timeout: monitor.interval * 1000 * 0.8,
        });

        // Wait for additional time before taking screenshot if configured
        if (monitor.screenshot_delay > 0) {
            await page.waitForTimeout(monitor.screenshot_delay);
        }

        let filename = jwt.sign(monitor.id, server.jwtSecret) + ".png";

        await page.screenshot({
            path: path.join(Database.screenshotDir, filename),
        });

        await context.close();

        if (res.status() >= 200 && res.status() < 400) {
            heartbeat.status = UP;
            heartbeat.msg = res.status();

            const timing = res.request().timing();
            heartbeat.ping = timing.responseEnd;
        } else {
            throw new Error(res.status() + "");
        }
    }
}

module.exports = {
    RealBrowserMonitorType,
    testChrome,
    resetChrome,
    testRemoteBrowser,
};
