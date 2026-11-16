import { expect, test } from "../fixtures";
import { login, restoreSqliteSnapshot } from "../util-test";

test.beforeEach(async ({ page }) => {
    await restoreSqliteSnapshot(page);
});

/**
 * Create a monitor with one tag through the add form
 * @param {import("@playwright/test").Page} page Page
 * @param {string} name Monitor name
 * @param {string} tagName Tag name
 * @returns {Promise<void>}
 */
async function addTaggedMonitor(page, name, tagName) {
    await page.goto("./add");
    await login(page);
    await page.getByTestId("monitor-type-select").selectOption("http");
    await page.getByTestId("friendly-name-input").fill(name);
    await page.getByTestId("url-input").fill("https://example.com");
    await page.getByTestId("add-tag-button").click();
    await page.getByTestId("tag-name-input").fill(tagName);
    await page.getByTestId("tag-value-input").fill("infra");
    await page.getByTestId("tag-color-select").click();
    await page.getByTestId("tag-color-select").getByRole("option", { name: "Orange" }).click();
    await page.getByTestId("add-tags-final-button").click();
    await page.getByTestId("save-button").click();
    await page.waitForURL(/\/dashboard/);
}

/**
 * Open the dashboard and wait for the monitor rows
 * @param {import("@playwright/test").Page} page Page
 * @returns {Promise<import("@playwright/test").Locator>} Monitor list locator
 */
async function openDashboard(page) {
    await page.goto("./dashboard");
    await page.waitForSelector('[data-testid="monitor-list"] .draggable-item');
    return page.getByTestId("monitor-list");
}

test.describe("Monitor tags", () => {
    test("renames a tag on the monitor list", async ({ page }) => {
        await addTaggedMonitor(page, "Tagged Item", "team");

        await page.goto("./settings/tags");
        await page.locator(".tags-list-row", { hasText: "team" }).click();
        await expect(page.locator("#tag-name")).toHaveValue("team");
        await page.locator("#tag-name").fill("crew");
        await page.locator(".modal.show").getByRole("button", { name: "Save", exact: true }).click();
        await expect(page.locator(".modal.show")).toBeHidden();

        const list = await openDashboard(page);
        const row = list.locator(".draggable-item", { hasText: "Tagged Item" });
        await expect(row.locator(".tag-wrapper")).toContainText("crew: infra");
        await expect(row.locator(".tag-wrapper")).not.toContainText("team");
    });

    test("removes a tag from a monitor", async ({ page }) => {
        await addTaggedMonitor(page, "Tagged Item", "team");

        const list = await openDashboard(page);
        await expect(list.locator(".draggable-item", { hasText: "Tagged Item" }).locator(".tag-wrapper")).toHaveCount(
            1
        );

        const href = await list.locator("a.item", { hasText: "Tagged Item" }).first().getAttribute("href");
        await page.goto("./edit/" + href.split("/").pop());
        await page.locator(".tag-wrapper .btn-remove").first().click();
        await page.getByTestId("save-button").click();
        await expect(page.locator(".Vue-Toastification__toast").filter({ hasText: "Saved" })).toBeVisible();

        const updatedList = await openDashboard(page);
        await expect(
            updatedList.locator(".draggable-item", { hasText: "Tagged Item" }).locator(".tag-wrapper")
        ).toHaveCount(0);
    });

    test("deletes a tag from the tag settings", async ({ page }) => {
        await addTaggedMonitor(page, "Tagged Item", "team");

        await page.goto("./settings/tags");
        await page.locator(".tags-list-row", { hasText: "team" }).locator(".btn-rm-tag").click();
        await page.locator(".modal.show").getByRole("button", { name: "Yes", exact: true }).click();
        await expect(page.locator(".tags-list-row")).toHaveCount(0);

        const list = await openDashboard(page);
        await expect(list.locator(".draggable-item", { hasText: "Tagged Item" }).locator(".tag-wrapper")).toHaveCount(
            0
        );
    });
});
