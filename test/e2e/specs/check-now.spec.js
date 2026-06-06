import { expect, test } from "@playwright/test";
import { login, restoreSqliteSnapshot, screenshot } from "../util-test";

/**
 * returns the number of recorded checks from the detail page heartbeat bar.
 * @param {import('@playwright/test').Page} page Playwright page
 * @returns {Promise<number>} Number of checks recorded so far
 */
async function getCheckCount(page) {
    const label = await page
        .locator(".shadow-box", { has: page.getByTestId("monitor-status") })
        .locator(".heartbeat-canvas")
        .getAttribute("aria-label");
    const match = label?.match(/(\d+) checks/);
    return match ? Number(match[1]) : 0;
}

test.describe("Check monitor now", () => {
    test.beforeEach(async ({ page }) => {
        await restoreSqliteSnapshot(page);
    });

    test("Triggers an immediate check", async ({ page }, testInfo) => {
        await page.goto("./add");
        await login(page);

        const monitorTypeSelect = page.getByTestId("monitor-type-select");
        await monitorTypeSelect.selectOption("http");

        // await page.getByTestId("friendly-name-input").fill("Check Now Monitor");
        await page.getByTestId("url-input").fill("https://www.example.com/");
        await page.getByTestId("save-button").click();
        // await page.waitForURL("/dashboard/*");

        // Wait for the first beat so we have a baseline.
        await expect(page.getByTestId("monitor-status")).toHaveText("up", { ignoreCase: true });
        const checkCountBeforeCheckNow = await getCheckCount(page);
        await screenshot(testInfo, page);

        await page.getByRole("button", { name: "Check Now" }).click();

        await expect.poll(async () => getCheckCount(page), { timeout: 10_000 }).toBeGreaterThan(checkCountBeforeCheckNow);
        await screenshot(testInfo, page);
    });
});
