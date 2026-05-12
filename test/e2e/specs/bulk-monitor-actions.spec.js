import { expect, test } from "@playwright/test";
import { login, restoreSqliteSnapshot, screenshot } from "../util-test";

/**
 * Creates a monitor through the add monitor form.
 * @param {import("@playwright/test").Page} page Playwright page
 * @param {object} options Monitor options
 * @param {string} options.name Monitor display name
 * @param {string} options.type Monitor type
 * @param {string} options.url HTTP monitor URL
 * @returns {Promise<void>}
 */
async function createMonitor(page, { name, type = "http", url = "https://www.example.com/" }) {
    await page.goto("./add");
    await expect(page.getByTestId("monitor-type-select")).toBeVisible();
    await page.getByTestId("monitor-type-select").selectOption(type);
    await page.getByTestId("friendly-name-input").fill(name);

    if (type === "http") {
        await page.getByTestId("url-input").fill(url);
    }

    await page.getByTestId("save-button").click();
    await page.waitForURL("/dashboard/*");
}

/**
 * Deselects the monitor row with the matching name.
 * @param {import("@playwright/test").Page} page Playwright page
 * @param {string} name Monitor name
 * @returns {Promise<void>}
 */
async function deselectMonitorRow(page, name) {
    await page
        .getByTestId("monitor-list-item")
        .filter({ hasText: name })
        .getByTestId("monitor-list-select")
        .click();
}

/**
 * Selects the monitor row with the matching name.
 * @param {import("@playwright/test").Page} page Playwright page
 * @param {string} name Monitor name
 * @returns {Promise<void>}
 */
async function selectMonitorRow(page, name) {
    await page
        .getByTestId("monitor-list-item")
        .filter({ hasText: name })
        .getByTestId("monitor-list-select")
        .check();
}

test.describe("Bulk Monitor Actions", () => {
    test.beforeEach(async ({ page }) => {
        await restoreSqliteSnapshot(page);
    });

    test("moves selected monitors into a group and deletes selected monitors", async ({ page }, testInfo) => {
        const groupName = "Bulk Target Group";
        const firstMonitor = "Bulk HTTP One";
        const secondMonitor = "Bulk HTTP Two";

        await page.goto("./dashboard");
        await login(page);
        await page.evaluate(() => window.localStorage.removeItem("monitorCollapsed"));

        await createMonitor(page, { name: groupName, type: "group" });
        await createMonitor(page, { name: firstMonitor, url: "https://www.example.com/bulk-one" });
        await createMonitor(page, { name: secondMonitor, url: "https://www.example.com/bulk-two" });

        await page.goto("./dashboard");
        await expect(page.getByTestId("monitor-list")).toContainText(groupName);
        await expect(page.getByTestId("monitor-list")).toContainText(firstMonitor);
        await expect(page.getByTestId("monitor-list")).toContainText(secondMonitor);

        await page.getByLabel("Select all monitors").check();
        await deselectMonitorRow(page, groupName);
        await page.getByRole("button", { name: "Actions" }).click();
        await page.getByTestId("bulk-move-group-action").click();
        await page.getByTestId("bulk-move-group-select").selectOption({ label: groupName });
        await page.getByTestId("bulk-move-group-apply").click();

        const groupRow = page.getByTestId("monitor-list-item").filter({ hasText: groupName });
        await expect(groupRow.getByTestId("monitor-list-collapse")).toBeVisible();
        await groupRow.getByTestId("monitor-list-collapse").click();
        await expect(page.getByTestId("monitor-list")).toContainText(firstMonitor);
        await expect(page.getByTestId("monitor-list")).toContainText(secondMonitor);

        await page.getByLabel("Select all monitors").check();
        await deselectMonitorRow(page, groupName);
        await selectMonitorRow(page, firstMonitor);
        await selectMonitorRow(page, secondMonitor);
        await page.getByRole("button", { name: "Actions" }).click();
        await page.getByRole("link", { name: "Delete" }).click();
        await page.getByRole("button", { name: "Yes" }).click();

        await expect(page.getByTestId("monitor-list")).not.toContainText(firstMonitor);
        await expect(page.getByTestId("monitor-list")).not.toContainText(secondMonitor);
        await screenshot(testInfo, page);
    });
});
