import { expect, test } from "../fixtures";
import { login, restoreSqliteSnapshot } from "../util-test";

test.beforeEach(async ({ page }) => {
    await restoreSqliteSnapshot(page);
});

test.describe("Badge endpoints", () => {
    test("serve uptime and ping badges for a monitor with heartbeats", async ({ page }) => {
        await page.goto("./add");
        await login(page);
        await page.getByTestId("monitor-type-select").selectOption("push");
        await page.getByTestId("friendly-name-input").fill("Badge Monitor");
        await page.getByTestId("save-button").click();
        await page.waitForURL(/\/dashboard\/\d+/);

        const monitorID = page.url().split("/").pop();
        const pushUrl = await page.locator('a[href*="/api/push/"]').first().getAttribute("href");
        await page.request.get(`${pushUrl}?ping=50`);

        const uptimeBadge = await page.request.get(`/api/badge/${monitorID}/uptime/24`);
        expect(uptimeBadge.status()).toBe(200);
        expect(await uptimeBadge.text()).toContain("<svg");

        const pingBadge = await page.request.get(`/api/badge/${monitorID}/ping/24`);
        expect(pingBadge.status()).toBe(200);
        expect(await pingBadge.text()).toContain("<svg");
    });
});
