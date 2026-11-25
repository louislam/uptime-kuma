import { test, expect } from "../fixtures";
import { login, restoreSqliteSnapshot } from "../util-test";

const serverUrl = require("../../../playwright.config.js").url;

const legacyKeyName = "e2e-legacy-key";
const currentKeyName = "e2e-current-key";

/**
 * Open the API keys settings page, logging in first if needed.
 * @param {import("@playwright/test").Page} page Page
 * @returns {Promise<void>}
 */
async function openAPIKeys(page) {
    await page.goto("./settings/api-keys");
    await Promise.race([
        page.getByRole("button", { name: "Add API Key" }).waitFor(),
        page.getByPlaceholder("Username").waitFor(),
    ]);
    if (await page.getByPlaceholder("Username").isVisible()) {
        await login(page);
    }
    await expect(page.getByRole("button", { name: "Add API Key" })).toBeVisible();
}

/**
 * Create a key through the dialog, so it ends up in the Better Auth table.
 * @param {import("@playwright/test").Page} page Page
 * @param {string} name Key name
 * @returns {Promise<void>}
 */
async function addCurrentKey(page, name) {
    await page.getByRole("button", { name: "Add API Key" }).click();
    await page.locator("#name").fill(name);
    await page.getByLabel("Don't expire").check();
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByText("Key Added")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator('[data-group="current"]').getByText(name, { exact: true })).toBeVisible();
}

/**
 * Seed a key in the old api_key table, as an upgraded 2.x install would have.
 * @param {import("@playwright/test").APIRequestContext} request Request context
 * @param {string} name Key name
 * @returns {Promise<{ id: number, key: string }>} Seeded key
 */
async function addLegacyKey(request, name = legacyKeyName) {
    const response = await request.post(`${serverUrl}/_e2e/add-legacy-api-key`, {
        data: { name },
    });
    expect(response.ok()).toBe(true);
    return await response.json();
}

test.describe("API keys settings", () => {
    test.beforeEach(async () => {
        await restoreSqliteSnapshot();
    });

    test("lists legacy keys in their own section", async ({ page, request }) => {
        await addLegacyKey(request);
        await openAPIKeys(page);
        await addCurrentKey(page, currentKeyName);

        const currentGroup = page.locator('[data-group="current"]');
        const legacyGroup = page.locator('[data-group="legacy"]');

        await expect(currentGroup.getByText(currentKeyName, { exact: true })).toBeVisible();
        await expect(currentGroup.getByText(legacyKeyName, { exact: true })).toHaveCount(0);

        await expect(legacyGroup.getByText("Legacy API Keys", { exact: true })).toBeVisible();
        await expect(legacyGroup.getByText(/only work for Prometheus \/metrics/)).toBeVisible();
        await expect(legacyGroup.getByText(legacyKeyName, { exact: true })).toBeVisible();
        await expect(legacyGroup.getByText(currentKeyName, { exact: true })).toHaveCount(0);
        await expect(legacyGroup.getByRole("button", { name: "Delete" })).toBeVisible();
    });

    test("shows the creation date in YYYY-MM-DD HH:MM:SS", async ({ page }) => {
        await openAPIKeys(page);
        await addCurrentKey(page, currentKeyName);

        const currentGroup = page.locator('[data-group="current"]');
        await expect(currentGroup.locator(".date").first()).toHaveText(
            /^Created: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
        );
    });

    test("deletes a legacy key", async ({ page, request }) => {
        await addLegacyKey(request);
        await openAPIKeys(page);

        const legacyGroup = page.locator('[data-group="legacy"]');
        await expect(legacyGroup.getByText(legacyKeyName, { exact: true })).toBeVisible();

        await legacyGroup.getByRole("button", { name: "Delete" }).click();
        await page.locator(".modal.show").getByRole("button", { name: "Yes", exact: true }).click();

        await expect(page.getByText(legacyKeyName, { exact: true })).toHaveCount(0);
        await expect(page.locator('[data-group="legacy"]')).toHaveCount(0);
    });
});
