import { expect, test } from "../fixtures";
import { login, restoreSqliteSnapshot } from "../util-test";

test.beforeEach(async ({ page }) => {
    await restoreSqliteSnapshot(page);
});

/**
 * Create a monitor through the add form
 * @param {import("@playwright/test").Page} page Page
 * @param {object} options Monitor name, type and url
 * @param {boolean} loginFirst Log in on this navigation
 * @returns {Promise<void>}
 */
async function addMonitor(page, options, loginFirst = false) {
    const { name, type = "http", url = "https://example.com" } = options;
    await page.goto("./add");
    if (loginFirst) {
        await login(page);
    }
    await page.getByTestId("monitor-type-select").selectOption(type);
    await page.getByTestId("friendly-name-input").fill(name);
    if (type === "http") {
        await page.getByTestId("url-input").fill(url);
    }
    await page.getByTestId("save-button").click();
    await page.waitForURL("/dashboard/*");
}

/**
 * Open the dashboard and wait for the monitor list
 * @param {import("@playwright/test").Page} page Page
 * @returns {Promise<import("@playwright/test").Locator>} Monitor list locator
 */
async function openDashboard(page) {
    await page.goto("./dashboard");
    await page.waitForSelector('[data-testid="monitor-list"] .draggable-item');
    return page.getByTestId("monitor-list");
}

/**
 * Confirm the open dialog
 * @param {import("@playwright/test").Page} page Page
 * @returns {Promise<void>}
 */
async function confirmDialog(page) {
    await page.locator(".modal.show").getByRole("button", { name: "Yes", exact: true }).click();
}

test.describe("Monitor list", () => {
    test("connects to the socket over websocket", async ({ page }) => {
        await addMonitor(page, { name: "Socket Monitor" }, true);
        await openDashboard(page);

        const transport = await page.evaluate(() => {
            const app = document.querySelector("#app").__vue_app__;
            const root = app._container._vnode.component.proxy;
            return root.getSocket().io.engine.transport.name;
        });

        expect(transport).toBe("websocket");
    });

    test("clears the loading overlay once the list is ready", async ({ page }) => {
        await addMonitor(page, { name: "Overlay Monitor" }, true);

        const list = await openDashboard(page);
        await expect(list).toContainText("Overlay Monitor");
        await expect(page.locator(".app-loading")).toHaveCount(0);
    });

    test("searches monitors by name", async ({ page }) => {
        await addMonitor(page, { name: "Alpha Monitor" }, true);
        await addMonitor(page, { name: "Beta Monitor" });

        const list = await openDashboard(page);

        await page.getByTestId("monitor-search").fill("Alpha");
        await expect(list).toContainText("Alpha Monitor");
        await expect(list).not.toContainText("Beta Monitor");

        await page.getByTestId("monitor-search").fill("");
        await expect(list).toContainText("Beta Monitor");
    });

    test("filters monitors by status", async ({ page }) => {
        await addMonitor(page, { name: "Push Up", type: "push" }, true);
        const pushUp = await page.locator('a[href*="/api/push/"]').first().getAttribute("href");
        await page.request.get(pushUp);

        await addMonitor(page, { name: "Push Down", type: "push" });
        const pushDown = await page.locator('a[href*="/api/push/"]').first().getAttribute("href");
        await page.request.get(pushDown.replace("status=up", "status=down"));

        const list = await openDashboard(page);

        await page.getByTestId("filter-status").click();
        await page.getByTestId("filter-status-down").click();

        await expect(list).toContainText("Push Down");
        await expect(list).not.toContainText("Push Up");
    });

    test("status filter excludes a paused monitor that went down", async ({ page }) => {
        await addMonitor(page, { name: "Paused Down", type: "push" }, true);
        const pushUrl = await page.locator('a[href*="/api/push/"]').first().getAttribute("href");
        await page.request.get(pushUrl.replace("status=up", "status=down"));

        // Pause it, so the stats count it as paused instead of down
        await page.getByRole("button", { name: "Pause" }).click();
        await confirmDialog(page);

        const list = await openDashboard(page);
        await page.getByTestId("filter-status").click();
        await expect(page.getByTestId("filter-status-down")).toContainText("0");

        await page.getByTestId("filter-status-down").click();
        await expect(list).not.toContainText("Paused Down");
    });

    test("filters monitors by paused state and resumes them in bulk", async ({ page }) => {
        await addMonitor(page, { name: "Alpha Monitor" }, true);
        await addMonitor(page, { name: "Beta Monitor" });

        const list = await openDashboard(page);

        // Entering select mode selects everything; keep only Alpha selected
        await page.getByTestId("select-mode-toggle").click();
        await expect(page.getByTestId("select-all-toggle")).toBeVisible();
        await page.locator('[data-testid^="monitor-select-"]').nth(1).uncheck();
        await page.getByTestId("bulk-actions").click();
        await page.getByTestId("bulk-pause").click();
        await page.locator(".modal.show").waitFor();
        await confirmDialog(page);
        await expect(page.locator(".Vue-Toastification__toast").first()).toContainText("Paused");

        // Only the paused monitor is listed
        await page.getByTestId("filter-status").click();
        await page.getByTestId("filter-active-paused").click();
        await expect(list).toContainText("Alpha Monitor");
        await expect(list).not.toContainText("Beta Monitor");

        // Resume it again (bulk pause leaves select mode)
        if (!(await page.getByTestId("select-all-toggle").isVisible())) {
            await page.getByTestId("select-mode-toggle").click();
            await expect(page.getByTestId("select-all-toggle")).toBeVisible();
        }
        await page.locator('[data-testid^="monitor-select-"]').first().check();
        await page.getByTestId("bulk-actions").click();
        await page.getByTestId("bulk-resume").click();

        // Clearing the filter shows both again
        await page.getByTestId("filter-status").click();
        await page.getByTestId("filter-active-paused").click();
        await expect(list).toContainText("Beta Monitor");
    });

    test("deletes selected monitors in bulk", async ({ page }) => {
        await addMonitor(page, { name: "Alpha Monitor" }, true);
        await addMonitor(page, { name: "Beta Monitor" });

        const list = await openDashboard(page);

        await page.getByTestId("select-mode-toggle").click();
        await expect(page.getByTestId("select-all-toggle")).toBeVisible();
        await page.getByTestId("select-all-toggle").check();
        await page.getByTestId("bulk-actions").click();
        await page.getByTestId("bulk-delete").click();
        await confirmDialog(page);

        await expect(list).not.toContainText("Alpha Monitor");
        await expect(list).not.toContainText("Beta Monitor");
    });
    test("filters monitors by tag", async ({ page }) => {
        await addMonitor(page, { name: "Tagged Monitor" }, true);
        await addMonitor(page, { name: "Untagged Monitor" });

        // Add a tag to the first monitor through its edit form
        await page.goto("./dashboard");
        await page.waitForSelector('[data-testid="monitor-list"] .draggable-item');
        const href = await page.locator("a.item", { hasText: "Tagged Monitor" }).first().getAttribute("href");
        const monitorID = href.split("/").pop();

        await page.goto("./edit/" + monitorID);
        await page.getByTestId("add-tag-button").click();
        await page.getByTestId("tag-name-input").fill("team");
        await page.getByTestId("tag-value-input").fill("infra");
        await page.getByTestId("tag-color-select").click();
        await page.getByTestId("tag-color-select").getByRole("option", { name: "Orange" }).click();
        await page.getByTestId("add-tags-final-button").click();
        await page.getByTestId("save-button").click();
        await expect(page.locator(".Vue-Toastification__toast").first()).toContainText("Saved");

        const list = await openDashboard(page);
        await page.getByTestId("filter-tags").click();
        await page.locator('[data-testid^="filter-tag-"]').first().waitFor();
        await page.locator('[data-testid^="filter-tag-"]').first().click();

        await expect(list).toContainText("Tagged Monitor");
        await expect(list).not.toContainText("Untagged Monitor");
    });
});
