// eslint-disable-next-line no-unused-vars
const { Page } = require("puppeteer");
const { sleep } = require("../src/util");

/**
 * Set back the correct data type for page object
 * @type {Page}
 */
page;

beforeAll(() => {
    if (process.env.JUST_FOR_TEST) {
        console.log(process.env.JUST_FOR_TEST);

        if (process.env.JUST_FOR_TEST === "JUST_FOR_TEST_HELLO") {
            console.log("secret ok");
        }
    }
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
        const pathname = await page.evaluate(() => location.pathname);
        expect(pathname).toEqual("/dashboard");

        // Go to /
        await page.goto(baseURL);
        expect(pathname).toEqual("/dashboard");
    });

    describe("Settings", () => {
        beforeAll(async () => {
            await page.goto(baseURL + "/settings");
        });

        it("Change Language", async () => {
            await page.select("#language", "zh-HK");
            let languageTitle = await page.evaluate(() => document.querySelector("[for=language]").innerText);
            expect(languageTitle).toMatch("語言");

            await page.select("#language", "en");
            languageTitle = await page.evaluate(() => document.querySelector("[for=language]").innerText);
            expect(languageTitle).toMatch("Language");
        });

        it("Change Theme", async () => {
            // Light
            await page.click(".btn[for=btncheck1]");
            await page.waitForSelector("div.light");

            await page.click(".btn[for=btncheck2]");
            await page.waitForSelector("div.dark");
        });
    });

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

