import { expect, test } from "../fixtures";
import { login, restoreSqliteSnapshot } from "../util-test";

test.beforeEach(async ({ page }) => {
    await restoreSqliteSnapshot(page);
});

/**
 * Create a monitor through the add form
 * @param {import("@playwright/test").Page} page Page
 * @param {object} options Name, type and optional parent group
 * @param {boolean} loginFirst Log in on this navigation
 * @returns {Promise<void>}
 */
async function addMonitor(page, options, loginFirst = false) {
    const { name, type = "http", parent } = options;
    await page.goto("./add");
    if (loginFirst) {
        await login(page);
    }
    await page.getByTestId("monitor-type-select").selectOption(type);
    await page.getByTestId("friendly-name-input").fill(name);
    if (type === "http") {
        await page.getByTestId("url-input").fill("https://example.com");
    }
    if (parent) {
        await page.locator("#monitorGroupSelector").selectOption({ label: parent });
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

/**
 * Open a monitor's details page from the list
 * @param {import("@playwright/test").Page} page Page
 * @param {string} name Monitor name
 * @returns {Promise<void>}
 */
async function openDetails(page, name) {
    await page.goto("./dashboard");
    await page.waitForSelector('[data-testid="monitor-list"] .draggable-item');
    await page.locator("a.item", { hasText: name }).first().click();
    await page.waitForURL(/\/dashboard\/\d+/);
}

test.describe("Monitor list actions", () => {
    test("shows a renamed monitor in the list", async ({ page }) => {
        await addMonitor(page, { name: "Old Name" }, true);
        await openDetails(page, "Old Name");

        await page.getByRole("link", { name: "Edit" }).click();
        await page.waitForURL("/edit/*");
        await page.getByTestId("friendly-name-input").fill("New Name");
        await page.getByTestId("save-button").click();
        await expect(page.locator(".Vue-Toastification__toast").first()).toContainText("Saved");

        const list = await openDashboard(page);
        await expect(list).toContainText("New Name");
        await expect(list).not.toContainText("Old Name");
    });

    test("clones a monitor into the list", async ({ page }) => {
        await addMonitor(page, { name: "Original Monitor" }, true);
        await openDetails(page, "Original Monitor");

        await page.getByRole("link", { name: "Clone" }).click();
        await page.waitForURL("/clone/*");
        await page.getByTestId("friendly-name-input").fill("Cloned Monitor");
        await page.getByTestId("save-button").click();
        await page.waitForURL(/\/dashboard\/\d+/);

        const list = await openDashboard(page);
        await expect(list).toContainText("Original Monitor");
        await expect(list).toContainText("Cloned Monitor");
    });

    test("renames a group and keeps its child", async ({ page }) => {
        await addMonitor(page, { name: "Group A", type: "group" }, true);
        await addMonitor(page, { name: "Child A", parent: "Group A" });

        await openDetails(page, "Group A");
        await page.getByRole("link", { name: "Edit" }).click();
        await page.waitForURL("/edit/*");
        await page.getByTestId("friendly-name-input").fill("Renamed Group");
        await page.getByTestId("save-button").click();
        await expect(page.locator(".Vue-Toastification__toast").first()).toContainText("Saved");

        const list = await openDashboard(page);
        await expect(list).toContainText("Renamed Group");
        await page.getByTestId("monitor-collapse").first().click();
        await expect(list).toContainText("Child A");
    });

    test("deletes a group but keeps its monitors", async ({ page }) => {
        await addMonitor(page, { name: "Group B", type: "group" }, true);
        await addMonitor(page, { name: "Child B", parent: "Group B" });

        await openDetails(page, "Group B");
        await page.getByRole("button", { name: "Delete" }).click();
        await confirmDialog(page);
        await page.waitForURL(/\/dashboard$/);

        const list = await openDashboard(page);
        await expect(list).not.toContainText("Group B");
        await expect(list).toContainText("Child B");
    });

    test("deletes a group together with its monitors", async ({ page }) => {
        await addMonitor(page, { name: "Group C", type: "group" }, true);
        await addMonitor(page, { name: "Child C", parent: "Group C" });

        await openDetails(page, "Group C");
        await page.getByRole("button", { name: "Delete" }).click();
        await page.locator("#delete-children-checkbox").check();
        await confirmDialog(page);
        await page.waitForURL(/\/dashboard$/);

        // Nothing is left, so the list shows the empty state instead of rows
        await expect(page.locator(".draggable-item")).toHaveCount(0);
        await expect(page.getByTestId("monitor-list")).toContainText("No Monitors");
    });

    test("creates a group from the monitor form", async ({ page }) => {
        await page.goto("./add");
        await login(page);

        // The action button lives next to the group select
        await page.locator("#monitorGroupSelector + button").click();
        await page.locator("#draftGroupName").fill("Draft Group");
        await page.getByRole("button", { name: "Confirm", exact: true }).click();
        // The dialog and its backdrop must be gone before the form can be saved
        await expect(page.locator("#draftGroupName")).toBeHidden();

        await expect(page.locator("#monitorGroupSelector")).toContainText("Draft Group");

        await page.getByTestId("monitor-type-select").selectOption("http");
        await page.getByTestId("friendly-name-input").fill("Draft Child");
        await page.getByTestId("url-input").fill("https://example.com");
        await page.locator("#monitorGroupSelector").selectOption({ label: "Draft Group" });
        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");

        const list = await openDashboard(page);
        await expect(list).toContainText("Draft Group");
    });

    test("expands and collapses all groups", async ({ page }) => {
        await addMonitor(page, { name: "Group One", type: "group" }, true);
        await addMonitor(page, { name: "Child One", parent: "Group One" });
        await addMonitor(page, { name: "Group Two", type: "group" });
        await addMonitor(page, { name: "Child Two", parent: "Group Two" });

        const list = await openDashboard(page);
        await expect(list).not.toContainText("Child One");
        await expect(list).not.toContainText("Child Two");

        await page.getByTestId("collapse-all").click();
        await expect(list).toContainText("Child One");
        await expect(list).toContainText("Child Two");

        await page.getByTestId("collapse-all").click();
        await expect(list).not.toContainText("Child One");
        await expect(list).not.toContainText("Child Two");
    });

    test("switches the heartbeat bar theme", async ({ page }) => {
        await addMonitor(page, { name: "Beat Monitor" }, true);
        let list = await openDashboard(page);
        await expect(list.locator(".heartbeat-canvas").first()).toBeVisible();

        await page.goto("./settings/appearance");
        await page.locator('label[for="btncheck6"]').click();
        list = await openDashboard(page);
        await expect(list.locator(".heartbeat-canvas")).toHaveCount(0);

        await page.goto("./settings/appearance");
        await page.locator('label[for="btncheck4"]').click();
        list = await openDashboard(page);
        await expect(list.locator(".heartbeat-canvas").first()).toBeVisible();
    });
});
