const fs = require("fs");

beforeAll(() => {
    fs.rmdirSync("./data/test", {
        recursive: true,
    });
});

afterAll(() => {

});

describe("Very Simple Test", () => {
    const title = "Uptime Kuma";

    beforeAll(async () => {
        await page.goto("http://127.0.0.1:3002");
    });

    it(`should be titled "${title}"`, async () => {
        await expect(page.title()).resolves.toMatch(title);
    });

    it("Create an admin account", async () => {
        await page.evaluate(() => document.);
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

