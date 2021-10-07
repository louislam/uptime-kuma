// eslint-disable-next-line no-unused-vars
const { Page, Browser } = require("puppeteer");
const { sleep } = require("../src/util");
const axios = require("axios");

/**
 * Set back the correct data type for page object
 * @type {Page}
 */
page;

/**
 * @type {Browser}
 */
browser;

beforeAll(async () => {
    await page.setViewport({
        width: 1280,
        height: 720,
        deviceScaleFactor: 1,
    });
});

afterAll(() => {

});

const baseURL = "http://127.0.0.1:3002";

describe("Init", () => {
    const title = "Uptime Kuma";

    beforeAll(async () => {
        await page.goto(baseURL);
    });

    it(`should be titled "${title}"`, async () => {
        await expect(page.title()).resolves.toMatch(title);
    });

    // Setup Page
    it("Setup", async () => {
        // Create an Admin
        await page.waitForSelector("#floatingInput");
        await page.waitForSelector("#repeat");
        await page.click("#floatingInput");
        await page.type("#floatingInput", "admin");
        await page.type("#floatingPassword", "admin123");
        await page.type("#repeat", "admin123");
        await page.click(".btn-primary[type=submit]");
        await sleep(3000);

        // Go to /setup again
        await page.goto(baseURL + "/setup");
        await sleep(3000);
        let pathname = await page.evaluate(() => location.pathname);
        expect(pathname).toEqual("/dashboard");

        // Go to /
        await page.goto(baseURL);
        await sleep(3000);
        pathname = await page.evaluate(() => location.pathname);
        expect(pathname).toEqual("/dashboard");
    });

    // Settings Page
    describe("Settings", () => {
        beforeAll(async () => {
            await page.goto(baseURL + "/settings");
        });

        it("Change Language", async () => {
            await page.waitForSelector("#language");

            await page.select("#language", "zh-HK");
            let languageTitle = await page.evaluate(() => document.querySelector("[for=language]").innerText);
            expect(languageTitle).toMatch("語言");

            await page.select("#language", "en");
            languageTitle = await page.evaluate(() => document.querySelector("[for=language]").innerText);
            expect(languageTitle).toMatch("Language");
        });

        it("Change Theme", async () => {
            await sleep(1000);

            // Dark
            await click(page, ".btn[for=btncheck2]");
            await page.waitForSelector("div.dark");

            await sleep(1000);

            // Light
            await click(page, ".btn[for=btncheck1]");
            await page.waitForSelector("div.light");
        });

        // TODO: Heartbeat Bar Style

        // TODO: Timezone

        it("Search Engine Visibility", async () => {
            // Default
            let res = await axios.get(baseURL + "/robots.txt");
            expect(res.data).toMatch("Disallow: /");

            // Yes
            await click(page, "#searchEngineIndexYes");
            await click(page, "form > div > .btn[type=submit]");
            await sleep(2000);
            res = await axios.get(baseURL + "/robots.txt");
            expect(res.data).not.toMatch("Disallow: /");

            // No
            await click(page, "#searchEngineIndexNo");
            await click(page, "form > div > .btn[type=submit]");
            await sleep(2000);
            res = await axios.get(baseURL + "/robots.txt");
            expect(res.data).toMatch("Disallow: /");
        });

        it("Entry Page", async () => {
            const newPage = await browser.newPage();

            // Default
            await newPage.goto(baseURL);
            await sleep(3000);
            let pathname = await newPage.evaluate(() => location.pathname);
            expect(pathname).toEqual("/dashboard");

            // Status Page
            await click(page, "#entryPageNo");
            await click(page, "form > div > .btn[type=submit]");
            await sleep(4000);
            await newPage.goto(baseURL);
            await sleep(4000);
            pathname = await newPage.evaluate(() => location.pathname);
            expect(pathname).toEqual("/status");

            // Back to Dashboard
            await click(page, "#entryPageYes");
            await click(page, "form > div > .btn[type=submit]");
            await sleep(4000);
            await newPage.goto(baseURL);
            await sleep(4000);
            pathname = await newPage.evaluate(() => location.pathname);
            expect(pathname).toEqual("/dashboard");

            await newPage.close();
        });

        it("Change Password (wrong current password)", async () => {
            await page.goto(baseURL + "/settings");
            await page.waitForSelector("#current-password");

            await page.type("#current-password", "wrong_passw$$d");
            await page.type("#new-password", "new_password123");
            await page.type("#repeat-new-password", "new_password123");

            // Save
            await click(page, "form > div > .btn[type=submit]", 1);
            await sleep(4000);

            await click(page, ".btn-danger.btn.me-2");
            await login("admin", "new_password123");
            let elementCount = await page.evaluate(() => document.querySelectorAll("#floatingPassword").length);
            expect(elementCount).toEqual(1);

            await login("admin", "admin123");
        });

        it("Change Password (wrong repeat)", async () => {
            await page.goto(baseURL + "/settings");
            await page.waitForSelector("#current-password");

            await page.type("#current-password", "admin123");
            await page.type("#new-password", "new_password123");
            await page.type("#repeat-new-password", "new_password1234567898797898");

            await click(page, "form > div > .btn[type=submit]", 1);
            await sleep(4000);

            await click(page, ".btn-danger.btn.me-2");
            await login("admin", "new_password123");

            let elementCount = await page.evaluate(() => document.querySelectorAll("#floatingPassword").length);
            expect(elementCount).toEqual(1);

            await login("admin", "admin123");
            await sleep(3000);
        });

        // TODO: 2FA

        // TODO: Export Backup

        // TODO: Import Backup

        // TODO: Disable Auth

        // TODO: Clear Stats
    });

    /*
     * TODO
     * Create Monitor - All type
     * Edit Monitor
     * Delete Monitor
     *
     * Create Notification (token problem, maybe hard to test)
     *
     */

    describe("Status Page", () => {
        const title = "Uptime Kuma";
        beforeAll(async () => {
            await page.goto(baseURL + "/status");
        });
        it(`should be titled "${title}"`, async () => {
            await expect(page.title()).resolves.toMatch(title);
        });
    });
});

async function login(username, password) {
    await input(page, "#floatingInput", username);
    await input(page, "#floatingPassword", password);
    await page.click(".btn-primary[type=submit]");
    await sleep(5000);
}

async function click(page, selector, elementIndex = 0) {
    await page.waitForSelector(selector, {
        timeout: 5000,
    });
    return await page.evaluate((s, i) => {
        return document.querySelectorAll(s)[i].click();
    }, selector, elementIndex);
}

async function input(page, selector, text) {
    await page.waitForSelector(selector, {
        timeout: 5000,
    });
    const element = await page.$(selector);
    await element.click({ clickCount: 3 });
    await page.keyboard.press("Backspace");
    await page.type(selector, text);
}
