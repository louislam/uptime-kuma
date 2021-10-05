// eslint-disable-next-line no-unused-vars
const { Page } = require("puppeteer");

/**
 * Set back the correct data type for page object
 * @type {Page}
 */
page;

beforeAll(() => {

});

afterAll(() => {

});

describe("Init", () => {
    const title = "Uptime Kuma";

    beforeAll(async () => {
        await page.goto("http://127.0.0.1:3002");
    });

    it(`should be titled "${title}"`, async () => {
        await expect(page.title()).resolves.toMatch(title);
    });

    it("Setup", async () => {
        // Create an Admin
        await page.waitForSelector("#floatingInput");
        await page.waitForSelector("#repeat");
        await page.click("#floatingInput");
        await page.type("#floatingInput", "admin");
        await page.type("#floatingPassword", "admin123");
        await page.type("#repeat", "admin123");
        await page.click(".btn-primary[type=submit]");
        await page.waitFor(3000);

        // Go to /setup again
        await page.goto("http://127.0.0.1:3002/setup");
        await page.waitFor(3000);
        const pathname = await page.evaluate(() => location.pathname);
        expect(pathname).toEqual("/dashboard");

        // Go to /
        await page.goto("http://127.0.0.1:3002");
        expect(pathname).toEqual("/dashboard");
        expect(pathname).toEqual("/dashboard");
    });

    describe("Init", () => {

    });
});

describe("Status Page", () => {
    const title = "Uptime Kuma";
    beforeAll(async () => {
        await page.goto("http://127.0.0.1:3002/status");
    });
    it(`should be titled "${title}"`, async () => {
        await expect(page.title()).resolves.toMatch(title);
    });
});

