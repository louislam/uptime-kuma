const fs = require("fs");
const path = require("path");
const dbPath = "./../../data/playwright-test/kuma.db";

/**
 * @param {TestInfo} testInfo Test info
 * @param {Page} page Page
 * @returns {Promise<void>}
 */
export async function screenshot(testInfo, page) {
    const screenshot = await page.screenshot();
    await testInfo.attach("screenshot", {
        body: screenshot,
        contentType: "image/png",
    });
}

/**
 * @param {Page} page Page
 * @returns {Promise<void>}
 */
export async function login(page) {
    // Login
    await page.getByPlaceholder("Username").click();
    await page.getByPlaceholder("Username").fill("admin");
    await page.getByPlaceholder("Username").press("Tab");
    await page.getByPlaceholder("Password").fill("admin123");
    await page.getByLabel("Remember me").check();
    await page.getByRole("button", { name: "Log in" }).click();
    await page.getByRole("heading", { name: "Add New Monitor" }).waitFor({ state: "visible" });
}

/**
 * Determines if the SQLite database has been created. This indicates setup has completed.
 * @returns {boolean} True if exists
 */
export function getSqliteDatabaseExists() {
    return fs.existsSync(path.resolve(__dirname, dbPath));
}
