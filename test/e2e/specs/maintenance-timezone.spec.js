import { expect, test } from "@playwright/test";
import { login, restoreSqliteSnapshot, screenshot } from "../util-test";

// Every maintenance window is configured in UTC while the browser is not
test.use({ timezoneId: "America/Chicago" });

test.describe("Maintenance timeslot timezone", () => {
    const monitorName = "Maintenance Timezone Monitor";

    test.beforeEach(async ({ page }) => {
        await restoreSqliteSnapshot(page);
    });

    /**
     * Create a monitor, a maintenance needs at least one
     * @param {object} page Playwright page
     * @returns {Promise<void>}
     */
    async function createMonitor(page) {
        await page.goto("./add");
        await login(page);
        await page.getByTestId("monitor-type-select").selectOption("http");
        await page.getByTestId("friendly-name-input").fill(monitorName);
        await page.getByTestId("url-input").fill("https://www.example.com/");
        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");
    }

    /**
     * Open the maintenance form and fill the fields every strategy shares
     * @param {object} page Playwright page
     * @param {string} title Title of the maintenance
     * @param {string} strategy Strategy of the maintenance
     * @returns {Promise<void>}
     */
    async function openMaintenanceForm(page, title, strategy) {
        await page.goto("./add-maintenance");
        await page.locator("#name").fill(title);
        await page.locator("#strategy").selectOption(strategy);
        await page.locator("#timezone").selectOption("UTC");

        const monitorPicker = page.locator(".multiselect", { has: page.locator("#affected_monitors") });
        await monitorPicker.click();
        await monitorPicker.getByText(monitorName, { exact: true }).click();
    }

    test("recurring window is listed in the timezone of the maintenance", async ({ page }, testInfo) => {
        test.setTimeout(90000);

        await createMonitor(page);

        // Every Tuesday 05:00 - 06:00 UTC
        await openMaintenanceForm(page, "UTC window", "cron");
        await page.locator("#cron").fill("0 5 * * 2");
        await page.locator("#duration").fill("60");
        await page.locator("#monitor-submit-btn").click();
        await page.waitForURL("/maintenance");

        const item = page.locator(".item", { hasText: "UTC window" });
        const timeslot = item.locator(".timeslot").first();

        await expect(timeslot).toHaveText(/\d{4}-\d{2}-\d{2} 05:00\s*-\s*\d{4}-\d{2}-\d{2} 06:00/);
        await expect(item.locator(".timeslot").nth(1)).toHaveText(/UTC\+00:00/);

        await screenshot(testInfo, page);
    });

    test("single window keeps its configured wall time", async ({ page }, testInfo) => {
        test.setTimeout(90000);

        await createMonitor(page);

        await openMaintenanceForm(page, "Single window", "single");
        await page.locator('input[type="datetime-local"]').first().fill("2027-01-05T05:00");
        await page.locator('input[type="datetime-local"]').nth(1).fill("2027-01-05T06:00");
        await page.locator("#monitor-submit-btn").click();
        await page.waitForURL("/maintenance");

        const item = page.locator(".item", { hasText: "Single window" });
        const timeslot = item.locator(".timeslot").first();

        await expect(timeslot).toHaveText(/2027-01-05 05:00\s*-\s*2027-01-05 06:00/);
        await expect(item.locator(".timeslot").nth(1)).toHaveText(/UTC\+00:00/);

        await screenshot(testInfo, page);
    });
});
