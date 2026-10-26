import { expect, test } from "../fixtures";
import { login, restoreSqliteSnapshot } from "../util-test";

test.beforeEach(async ({ page }) => {
    await restoreSqliteSnapshot(page);
});

/**
 * Create a push monitor and return its push URL
 * @param {import("@playwright/test").Page} page Page
 * @param {string} name Monitor name
 * @returns {Promise<string>} Push URL
 */
async function addPushMonitor(page, name) {
    await page.goto("./add");
    await login(page);
    await page.getByTestId("monitor-type-select").selectOption("push");
    await page.getByTestId("friendly-name-input").fill(name);
    await page.getByTestId("save-button").click();
    await page.waitForURL(/\/dashboard\/\d+/);
    return await page.locator('a[href*="/api/push/"]').first().getAttribute("href");
}

/**
 * Create a single maintenance window covering all monitors for the next hour
 * @param {import("@playwright/test").Page} page Page
 * @param {string} title Maintenance title
 * @param {string} monitorName Monitor to include
 * @returns {Promise<void>}
 */
async function addMaintenance(page, title, monitorName) {
    await page.goto("./add-maintenance");
    await page.locator("#name").fill(title);
    await page.locator("#strategy").selectOption("single");
    await page.getByText("Pick Affected Monitors…").click();
    await page.getByRole("option", { name: monitorName }).click();
    await page.keyboard.press("Escape");
    await page.locator("#monitor-submit-btn").click();
    await page.waitForURL(/\/maintenance$/);
}

test.describe("Maintenance", () => {
    test("counts monitors under maintenance in the list filter", async ({ page }) => {
        const pushUrl = await addPushMonitor(page, "Maintenance Monitor");
        await addMaintenance(page, "Planned Window", "Maintenance Monitor");
        await expect(page.locator(".item", { hasText: "Planned Window" })).toContainText("Under Maintenance");

        // The beat is recorded as maintenance instead of up
        await page.request.get(pushUrl);

        await page.goto("./dashboard");
        await page.waitForSelector('[data-testid="monitor-list"] .draggable-item');
        await page.getByTestId("filter-status").click();

        const maintenanceFilter = page.getByTestId("filter-status-maintenance");
        await expect(maintenanceFilter).toContainText("1");
        await maintenanceFilter.click();

        const list = page.getByTestId("monitor-list");
        await expect(list).toContainText("Maintenance Monitor");
    });
});
