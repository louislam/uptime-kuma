beforeAll(() => {

});

afterAll(() => {
    return console.log("Cleanup");
});

describe("Very Simple Test", () => {

    const title = "Uptime Kuma";

    beforeAll(async () => {
        await page.goto("http://127.0.0.1:3002");
    });

    it(`should be titled "${title}"`, async () => {
        await expect(page.title()).resolves.toMatch(title);
    });
});

