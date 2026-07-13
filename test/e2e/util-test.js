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
export async function login(page, username = "admin", password = "admin123", rememberMe = true) {
    // Login
    await page.getByPlaceholder("Username").click();
    await page.getByPlaceholder("Username").fill(username);
    await page.getByPlaceholder("Username").press("Tab");
    await page.getByPlaceholder("Password").fill(password);
    await page.getByLabel("Remember me").check();
    await page.getByRole("button", { name: "Log in" }).click();
    await page.isVisible("text=Add New Monitor");
}

/**
 * Determines if the SQLite database has been created. This indicates setup has completed.
 * @returns {boolean} True if exists
 */
export function getSqliteDatabaseExists() {
    return fs.existsSync(path.resolve(__dirname, dbPath));
}
