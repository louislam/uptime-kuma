import { expect, test } from "../fixtures";
import { login, restoreSqliteSnapshot } from "../util-test";

test.beforeEach(async ({ page }) => {
    await restoreSqliteSnapshot(page);
});

/**
 * Open the monitor history settings page and log in
 * @param {import("@playwright/test").Page} page Page
 * @returns {Promise<void>}
 */
async function openSettings(page) {
    await page.goto("./settings/monitor-history");
    // Log in only when the session is not restored yet
    await Promise.race([page.locator("#keepDataPeriodDays").waitFor(), page.getByPlaceholder("Username").waitFor()]);
    if (await page.getByPlaceholder("Username").isVisible()) {
        await login(page);
    }
    await expect(page.locator("#keepDataPeriodDays")).toBeVisible();
}

/**
 * Confirm the open dialog
 * @param {import("@playwright/test").Page} page Page
 * @returns {Promise<void>}
 */
async function confirmDialog(page) {
    await page.locator(".modal.show").getByRole("button", { name: "Yes", exact: true }).click();
}

test.describe("Monitor history settings", () => {
    test("saves the data retention period", async ({ page }) => {
        await openSettings(page);

        await page.locator("#keepDataPeriodDays").fill("30");
        await page.getByRole("button", { name: "Save", exact: true }).click();

        await page.reload();
        await expect(page.locator("#keepDataPeriodDays")).toHaveValue("30");
    });

    test("clears all statistics and heartbeats", async ({ page }) => {
        // Create a push monitor with one heartbeat
        await page.goto("./add");
        await login(page);
        await page.getByTestId("monitor-type-select").selectOption("push");
        await page.getByTestId("friendly-name-input").fill("Stats Monitor");
        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");
        const detailsURL = page.url();
        const monitorID = detailsURL.split("/").pop();
        const pushUrl = await page.locator('a[href*="/api/push/"]').first().getAttribute("href");
        await page.request.get(pushUrl);

        await page.goto("./dashboard");
        await expect(page.locator('[aria-label^="Heartbeat history: 1 checks"]')).toBeVisible();

        // Clear everything from the settings page
        await openSettings(page);
        await page.getByRole("button", { name: "Clear all statistics" }).click();
        await confirmDialog(page);

        // The monitor no longer has heartbeats
        await page.goto("./dashboard/" + monitorID);
        await page.goto("./dashboard");
        await expect(page.locator('[aria-label^="Heartbeat history: 0 checks"]')).toBeVisible();
    });

    test("shrinks the sqlite database", async ({ page }) => {
        await openSettings(page);

        await page.getByRole("button", { name: /Shrink Database/ }).click();

        await expect(page.locator(".Vue-Toastification__toast").first()).toContainText("Done");
    });
});
