import { expect, test } from "@playwright/test";
import { login, restoreSqliteSnapshot, screenshot } from "../util-test";

test.describe("Maintenance", () => {

    test.beforeEach(async ({ page }) => {
        await restoreSqliteSnapshot(page);
    });

    test("create, pause, and resume maintenance with cron strategy", async ({ page }, testInfo) => {
        test.setTimeout(60000);

        // Maintenance details
        const maintenanceTitle = "Test Maintenance for Pause/Resume";

        // Navigate to add maintenance page
        await page.goto("./add-maintenance");
        await login(page);
        await screenshot(testInfo, page);

        // Fill in the title
        await page.locator("#name").fill(maintenanceTitle);

        // Select cron strategy (this is the strategy that uses last_start_date)
        await page.locator("#strategy").selectOption("cron");

        // Fill in cron expression (every 3 hours, same as in the issue)
        await page.locator("#cron").fill("0 */3 * * *");

        // Fill in duration
        await page.locator("#duration").fill("180");

        await screenshot(testInfo, page);

        // Save the maintenance
        await page.getByRole("button", { name: "Save" }).click();

        // Wait for redirect to maintenance list
        await page.waitForURL("/maintenance");

        // Verify maintenance was created
        await expect(page.locator(".item")).toContainText(maintenanceTitle);
        await screenshot(testInfo, page);

        // Find and click the Pause button
        const maintenanceItem = page.locator(".item").filter({ hasText: maintenanceTitle });
        await maintenanceItem.getByRole("button", { name: "Pause" }).click();

        // Confirm pause in the dialog
        await page.getByRole("button", { name: "Yes" }).click();

        // Wait for the UI to update and verify maintenance is paused (status should change to inactive)
        await expect(maintenanceItem).toHaveClass(/inactive/);
        await expect(maintenanceItem).toContainText("Inactive");
        await screenshot(testInfo, page);

        // Now resume the maintenance
        await maintenanceItem.getByRole("button", { name: "Resume" }).click();

        // Verify maintenance is resumed (status should change back to scheduled)
        await expect(maintenanceItem).toHaveClass(/scheduled/);
        await expect(maintenanceItem).toContainText("Scheduled");
        await screenshot(testInfo, page);

        // Clean up: delete the maintenance
        await maintenanceItem.getByRole("button", { name: "Delete" }).click();
        await page.getByRole("button", { name: "Yes" }).click();

        // Verify maintenance was deleted
        await expect(page.locator(".item").filter({ hasText: maintenanceTitle })).toHaveCount(0);
        await screenshot(testInfo, page);
    });

});
