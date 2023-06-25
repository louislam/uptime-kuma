const { MonitorType } = require("./monitor-type");
const { chromium, Browser } = require("playwright-core");
const { UP } = require("../../src/util");

/**
 *
 * @type {Browser}
 */
let browser = null;

async function getBrowser() {
    if (!browser) {
        browser = await chromium.launch({
            //headless: false,
            //executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        });
    }
    return browser;
}

/**
 * TODO: connect remote browser?
 * https://playwright.dev/docs/api/class-browsertype#browser-type-connect
 */
class RealBrowserMonitorType extends MonitorType {

    name = "real-browser";

    /**
     * TODO: For auto-detection of the executable path?
     * @type {string[]}
     */
    static possibleExecutablePathList = [
        "chromium-browser",
        "google-chrome",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
    ];

    async check(monitor, heartbeat) {
        const browser = await getBrowser();
        const context = await browser.newContext();
        const page = await context.newPage();

        const res = await page.goto(monitor.url, {
            waitUntil: "networkidle",
        });

        /*
        TODO: screenshot?
        await page.screenshot({
            path: "example.png",
        });*/

        await context.close();

        if (res.status() >= 200 && res.status() < 400) {
            heartbeat.status = UP;
            heartbeat.msg = res.status();

            const timing = res.request().timing();
            heartbeat.ping = timing.responseEnd;
        }

        throw new Error(res.status() + "");
    }
}

module.exports = {
    RealBrowserMonitorType,
};
