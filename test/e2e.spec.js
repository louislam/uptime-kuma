// eslint-disable-next-line no-unused-vars
const { Page, Browser } = require("puppeteer");
const { sleep } = require("../src/util");

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
        await expect(page.title()).resolves.toEqual(title);
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
        await page.waitForSelector("h1.mb-3");
        pathname = await page.evaluate(() => location.pathname);
        expect(pathname).toEqual("/dashboard");
    });

    it("should create monitor", async () => {
        // Create monitor
        await page.goto(baseURL + "/add");
        await page.waitForSelector("#name");

        await page.type("#name", "Myself");
        await page.waitForSelector("#url");
        await page.click("#url", { clickCount: 3 });
        await page.keyboard.type(baseURL);
        await page.keyboard.press("Enter");

        await page.waitForFunction(() => {
            const badge = document.querySelector("span.badge");
            return badge && badge.innerText == "100%";
        }, { timeout: 5000 });

    });

    // Settings Page
    /*
    describe("Settings", () => {
        beforeEach(async () => {
            await page.goto(baseURL + "/settings");
        });

        it("Change Language", async () => {
            await page.goto(baseURL + "/settings/appearance");
            await page.waitForSelector("#language");

            await page.select("#language", "zh-HK");
            let languageTitle = await page.evaluate(() => document.querySelector("[for=language]").innerText);
            expect(languageTitle).toEqual("語言");

            await page.select("#language", "en");
            languageTitle = await page.evaluate(() => document.querySelector("[for=language]").innerText);
            expect(languageTitle).toEqual("Language");
        });

        it("Change Theme", async () => {
            await page.goto(baseURL + "/settings/appearance");

            // Dark
            await click(page, ".btn[for=btncheck2]");
            await page.waitForSelector("div.dark");

            await page.waitForSelector(".btn[for=btncheck1]");

            // Light
            await click(page, ".btn[for=btncheck1]");
            await page.waitForSelector("div.light");
        });

        it("Change Heartbeat Bar Style", async () => {
            await page.goto(baseURL + "/settings/appearance");

            // Bottom
            await click(page, ".btn[for=btncheck5]");
            await page.waitForSelector("div.hp-bar-big");

            // None
            await click(page, ".btn[for=btncheck6]");
            await page.waitForSelector("div.hp-bar-big", {
                hidden: true,
                timeout: 1000
            });
        });

        // TODO: Timezone

        it("Search Engine Visibility", async () => {
            // Default
            let res = await axios.get(baseURL + "/robots.txt");
            expect(res.data).toContain("Disallow: /");

            // Yes
            await click(page, "#searchEngineIndexYes");
            await click(page, "form > div > .btn[type=submit]");
            await sleep(1000);
            res = await axios.get(baseURL + "/robots.txt");
            expect(res.data).not.toContain("Disallow: /");

            // No
            await click(page, "#searchEngineIndexNo");
            await click(page, "form > div > .btn[type=submit]");
            await sleep(1000);
            res = await axios.get(baseURL + "/robots.txt");
            expect(res.data).toContain("Disallow: /");
        });

        it("Entry Page", async () => {
            const newPage = await browser.newPage();

            // Default
            await newPage.goto(baseURL);
            await newPage.waitForSelector("h1.mb-3", { timeout: 3000 });
            let pathname = await newPage.evaluate(() => location.pathname);
            expect(pathname).toEqual("/dashboard");

            // Status Page
            await click(page, "#entryPageNo");
            await click(page, "form > div > .btn[type=submit]");
            await sleep(1000);
            await newPage.goto(baseURL);
            await newPage.waitForSelector("img.logo", { timeout: 3000 });
            pathname = await newPage.evaluate(() => location.pathname);
            expect(pathname).toEqual("/status");

            // Back to Dashboard
            await click(page, "#entryPageYes");
            await click(page, "form > div > .btn[type=submit]");
            await sleep(1000);
            await newPage.goto(baseURL);
            await newPage.waitForSelector("h1.mb-3", { timeout: 3000 });
            pathname = await newPage.evaluate(() => location.pathname);
            expect(pathname).toEqual("/dashboard");

            await newPage.close();
        });

        it("Change Password (wrong current password)", async () => {
            await page.goto(baseURL + "/settings/security");
            await page.waitForSelector("#current-password");

            await page.type("#current-password", "wrong_passw$$d");
            await page.type("#new-password", "new_password123");
            await page.type("#repeat-new-password", "new_password123");

            // Save
            await click(page, "form > div > .btn[type=submit]", 0);
            await sleep(1000);

            await click(page, "#logout-btn");
            await login("admin", "new_password123");
            let elementCount = await page.evaluate(() => document.querySelectorAll("#floatingPassword").length);
            expect(elementCount).toEqual(1);

            await login("admin", "admin123");
        });

        it("Change Password (wrong repeat)", async () => {
            await page.goto(baseURL + "/settings/security");
            await page.waitForSelector("#current-password");

            await page.type("#current-password", "admin123");
            await page.type("#new-password", "new_password123");
            await page.type("#repeat-new-password", "new_password1234567898797898");

            await click(page, "form > div > .btn[type=submit]", 0);
            await sleep(1000);

            await click(page, "#logout-btn");
            await login("admin", "new_password123");

            let elementCount = await page.evaluate(() => document.querySelectorAll("#floatingPassword").length);
            expect(elementCount).toEqual(1);

            await login("admin", "admin123");
            await page.waitForSelector("#current-password");
            let pathname = await page.evaluate(() => location.pathname);
            expect(pathname).toEqual("/settings/security");
        });

        // TODO: 2FA

        // TODO: Export Backup

        // TODO: Import Backup

        it("Should disable & enable auth", async () => {
            await page.goto(baseURL + "/settings/security");
            await click(page, "#disableAuth-btn");
            await click(page, ".btn.btn-danger[data-bs-dismiss='modal']", 2); // Not a good way to do it
            await page.waitForSelector("#enableAuth-btn", { timeout: 3000 });
            await page.waitForSelector("#logout-btn", {
                hidden: true,
                timeout: 3000
            });

            const newPage = await browser.newPage();
            await newPage.goto(baseURL);
            await newPage.waitForSelector("span.badge", { timeout: 3000 });
            newPage.close();

            await click(page, "#enableAuth-btn");
            await login("admin", "admin123");
            await page.waitForSelector("#disableAuth-btn", { timeout: 3000 });
        });

        // it("Should clear all statistics", async () => {
        //     await page.goto(baseURL + "/settings/monitor-history");
        //     await click(page, "#clearAllStats-btn");
        //     await click(page, ".btn.btn-danger");
        //     await page.waitForFunction(() => {
        //         const badge = document.querySelector("span.badge");
        //         return badge && badge.innerText == "0%";
        //     }, { timeout: 3000 });
        // });
    });
     */

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
            await expect(page.title()).resolves.toEqual(title);
        });
    });
});

/**
 * Test login
 * @param {string} username
 * @param {string} password
 */
async function login(username, password) {
    await input(page, "#floatingInput", username);
    await input(page, "#floatingPassword", password);
    await page.click(".btn-primary[type=submit]");
    await sleep(5000);
}

/**
 * Click on an element on the page
 * @param {Page} page Puppeteer page instance
 * @param {string} selector
 * @param {number} elementIndex
 * @returns {Promise<any>}
 */
async function click(page, selector, elementIndex = 0) {
    await page.waitForSelector(selector, {
        timeout: 5000,
    });
    return await page.evaluate((s, i) => {
        return document.querySelectorAll(s)[i].click();
    }, selector, elementIndex);
}

/**
 * Input text into selected field
 * @param {Page} page Puppeteer page instance
 * @param {string} selector
 * @param {string} text Text to input
 */
async function input(page, selector, text) {
    await page.waitForSelector(selector, {
        timeout: 5000,
    });
    const element = await page.$(selector);
    await element.click({ clickCount: 3 });
    await page.keyboard.press("Backspace");
    await page.type(selector, text);
}
