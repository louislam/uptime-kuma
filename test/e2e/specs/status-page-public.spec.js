import { expect, test } from "../fixtures";
import { login, restoreSqliteSnapshot } from "../util-test";

test.beforeEach(async ({ page }) => {
    await restoreSqliteSnapshot(page);
});

/**
 * Create an HTTP monitor
 * @param {import("@playwright/test").Page} page Page
 * @param {string} name Monitor name
 * @returns {Promise<void>}
 */
async function addHttpMonitor(page, name) {
    await page.goto("./add");
    await login(page);
    await page.getByTestId("monitor-type-select").selectOption("http");
    await page.getByTestId("friendly-name-input").fill(name);
    await page.getByTestId("url-input").fill("https://example.com");
    await page.getByTestId("save-button").click();
    await page.waitForURL(/\/dashboard\/\d+/);
    return page.url().split("/").pop();
}

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
 * Create a status page with one group holding the given monitor
 * @param {import("@playwright/test").Page} page Page
 * @param {string} name Status page name
 * @param {string} slug Status page slug
 * @param {string} monitorName Monitor to publish
 * @returns {Promise<void>}
 */
async function addStatusPageWithMonitor(page, name, slug, monitorName) {
    await page.goto("./add-status-page");
    await page.getByTestId("name-input").fill(name);
    await page.getByTestId("slug-input").fill(slug);
    await page.getByTestId("submit-button").click();
    await page.waitForURL(`/status/${slug}?edit`);
    await expect(page.getByTestId("edit-sidebar")).toHaveAttribute("data-status-page-id", /^\d+$/);

    await page.getByTestId("add-group-button").click();
    await page.getByTestId("group-name").fill("Core");
    await page.getByTestId("monitor-select").click();
    await page.getByTestId("monitor-select").getByRole("option", { name: monitorName }).click();
    await expect(page.getByTestId("monitor")).toHaveCount(1);

    // Saving reloads the page, the edit sidebar disappears afterwards
    await Promise.all([page.waitForEvent("load"), page.getByTestId("save-button").click()]);
    await expect(page.getByTestId("edit-sidebar")).toHaveCount(0);
}

test.describe("Public status page", () => {
    test("shows a published monitor to logged-out visitors", async ({ page }) => {
        const monitorID = await addHttpMonitor(page, "Public Monitor");
        await addStatusPageWithMonitor(page, "Public Demo", "public-demo", "Public Monitor");

        // Visit the page like a visitor without a session
        await page.context().clearCookies();
        await page.goto("./status/public-demo");

        await expect(page.getByTestId("group-name")).toContainText("Core");
        await expect(page.getByTestId("monitor-name")).toContainText("Public Monitor");
        await expect(page.getByTestId("edit-button")).toHaveCount(0);

        // The public monitor also answers the avg-response badge from its history
        const badge = await page.request.get(`/api/badge/${monitorID}/avg-response/24`);
        expect(badge.status()).toBe(200);
        expect(await badge.text()).toContain("<svg");
    });

    test("shows an active maintenance window to logged-out visitors", async ({ page }) => {
        const pushUrl = await addPushMonitor(page, "Maintenance Monitor");
        await addStatusPageWithMonitor(page, "Maintenance Demo", "maintenance-demo", "Maintenance Monitor");

        // A single window covering now, linked to the status page
        await page.goto("./add-maintenance");
        await page.locator("#name").fill("Planned Window");
        await page.locator("#strategy").selectOption("single");
        await page.getByText("Pick Affected Monitors…").click();
        await page.getByRole("option", { name: "Maintenance Monitor" }).click();
        await page.keyboard.press("Escape");
        await page.getByText("Select status pages…").click();
        await page.getByRole("option", { name: "Maintenance Demo" }).click();
        await page.keyboard.press("Escape");
        await page.locator("#monitor-submit-btn").click();
        await page.waitForURL(/\/maintenance$/);

        // The beat inside the window is recorded as maintenance
        await page.request.get(pushUrl);

        await page.context().clearCookies();
        await page.goto("./status/maintenance-demo");

        await expect(page.locator(".bg-maintenance")).toContainText("Planned Window");
        await expect(page.getByTestId("monitor-name")).toContainText("Maintenance Monitor");
    });
});
