import { expect, test } from "@playwright/test";
import { login, restoreSqliteSnapshot, screenshot } from "../util-test";

test.describe("Maintenance Timeslot Timezone", () => {
    // The maintenance window is configured in UTC, the browser is not
    test.use({ timezoneId: "America/Chicago" });

    test.beforeEach(async ({ page }) => {
        await restoreSqliteSnapshot(page);
    });

    test("recurring maintenance window is listed in its own timezone", async ({ page }, testInfo) => {
        test.setTimeout(60000);

        const monitorName = "Maintenance Timezone Monitor";
        const maintenanceTitle = "UTC window";

        // A maintenance needs at least one monitor, so create one first
        await page.goto("./add");
        await login(page);
        await page.getByTestId("monitor-type-select").selectOption("http");
        await page.getByTestId("friendly-name-input").fill(monitorName);
        await page.getByTestId("url-input").fill("https://www.example.com/");
        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");

        // Recurring window: every Tuesday 05:00 - 06:00 UTC
        await page.goto("./add-maintenance");
        await page.locator("#name").fill(maintenanceTitle);
        await page.locator("#strategy").selectOption("cron");
        await page.locator("#cron").fill("0 5 * * 2");
        await page.locator("#duration").fill("60");
        await page.locator("#timezone").selectOption("UTC");

        const monitorPicker = page.locator(".multiselect", { has: page.locator("#affected_monitors") });
        await monitorPicker.click();
        await monitorPicker.getByText(monitorName, { exact: true }).click();

        await page.locator("#monitor-submit-btn").click();
        await page.waitForURL("/maintenance");

        // The list has to show the window in the timezone of the maintenance, not in the
        // timezone of the browser (2026-10-20 is the next Tuesday)
        const item = page.locator(".item", { hasText: maintenanceTitle });
        const timeslot = item.locator(".timeslot").first();

        await expect(timeslot).toHaveText(/\d{4}-\d{2}-\d{2} 05:00 - \d{4}-\d{2}-\d{2} 06:00/);
        await expect(item.locator(".timeslot").nth(1)).toHaveText(/UTC\+00:00/);

        await screenshot(testInfo, page);
    });
});
