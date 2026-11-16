import { expect, test } from "../fixtures";
import { login, restoreSqliteSnapshot } from "../util-test";

test.beforeEach(async ({ page }) => {
    await restoreSqliteSnapshot(page);
});

/**
 * Create a monitor and land on its details page
 * @param {import("@playwright/test").Page} page Page
 * @param {string} name Monitor name
 * @param {string} type Monitor type
 * @returns {Promise<void>}
 */
async function createMonitor(page, name, type = "http") {
    await page.goto("./add");
    await login(page);
    await page.getByTestId("monitor-type-select").selectOption(type);
    await page.getByTestId("friendly-name-input").fill(name);
    if (type === "http") {
        await page.getByTestId("url-input").fill("https://example.com");
    }
    await page.getByTestId("save-button").click();
    await page.waitForURL("/dashboard/*");
}

/**
 * Confirm the open dialog
 * @param {import("@playwright/test").Page} page Page
 * @returns {Promise<void>}
 */
async function confirmDialog(page) {
    await page.locator(".modal.show").getByRole("button", { name: "Yes", exact: true }).click();
}

test.describe("Monitor details", () => {
    test("shows the monitor details and opens the edit form", async ({ page }) => {
        const name = "Detail Monitor";
        await createMonitor(page, name);

        await expect(page.locator("h1")).toContainText(name);
        await expect(page.locator(".url")).toContainText("https://example.com");
        await expect(page.getByText("Check every 60 seconds")).toBeVisible();
        await expect(page.getByTestId("monitor-status")).toBeVisible();

        await page.getByRole("link", { name: "Edit" }).click();
        await page.waitForURL("/edit/*");
        await expect(page.getByTestId("friendly-name-input")).toHaveValue(name);
    });

    test("shows the ping chart", async ({ page }) => {
        await createMonitor(page, "Chart Monitor");

        // The chart box is open by default and requests the beats on mount
        await expect(page.locator(".ping-chart-wrapper canvas")).toBeVisible();
    });

    test("pauses and resumes the monitor", async ({ page }) => {
        await createMonitor(page, "Pausable Monitor");

        await page.getByRole("button", { name: "Pause" }).click();
        await confirmDialog(page);
        await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();

        await page.getByRole("button", { name: "Resume" }).click();
        await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    });

    test("deletes the monitor from its details page", async ({ page }) => {
        const name = "Deletable Monitor";
        await createMonitor(page, name);

        await page.getByRole("button", { name: "Delete" }).click();
        await confirmDialog(page);
        await page.waitForURL(/\/dashboard$/);

        const list = page.getByTestId("monitor-list");
        await expect(list).not.toContainText(name);
    });
    test("clears the important events", async ({ page }) => {
        await createMonitor(page, "Clear Events Monitor", "push");

        // Send one heartbeat so there is an important event to clear
        const pushUrl = await page.locator('a[href*="/api/push/"]').first().getAttribute("href");
        await page.request.get(pushUrl);
        await page.reload();
        await expect(page.getByText("No important events")).toBeHidden();

        await page.getByRole("button", { name: "Clear Data" }).click();
        await page.getByRole("button", { name: "Events", exact: true }).click();
        await confirmDialog(page);

        await expect(page.getByText("No important events")).toBeVisible();
    });
    test("clears the heartbeats shown in the monitor list", async ({ page }) => {
        await createMonitor(page, "Clear Heartbeats Monitor", "push");
        const detailsURL = page.url();
        const monitorID = detailsURL.split("/").pop();

        // Send one heartbeat and confirm the list shows it
        const pushUrl = await page.locator('a[href*="/api/push/"]').first().getAttribute("href");
        await page.request.get(pushUrl);
        await page.goto("./dashboard");
        await expect(page.locator('[aria-label^="Heartbeat history: 1 checks"]')).toBeVisible();

        // Clear the heartbeats from the details page
        await page.goto("./dashboard/" + monitorID);
        await page.getByRole("button", { name: "Clear Data" }).click();
        await page.getByRole("button", { name: "Heartbeats", exact: true }).click();
        await confirmDialog(page);

        // The list row no longer has heartbeat data
        await page.goto("./dashboard");
        await expect(page.locator('[aria-label^="Heartbeat history: 0 checks"]')).toBeVisible();
    });
});
