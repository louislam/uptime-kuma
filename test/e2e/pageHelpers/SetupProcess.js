import { login, screenshot, takeSqliteSnapshot } from "../util-test";

/**
 * Represents the setup process for the application.
 */
export class SetupProcess {
    /**
     * @param {import('@playwright/test').Page} page - The Playwright page object.
     */
    constructor(page) {
        this.page = page;
    }

    /**
     * Sets up the SQLite database.
     * @param {import('@playwright/test').TestInfo} testInfo - The test information for logging.
     * @returns {Promise<void>} - A promise that resolves when the setup is complete.
     */
    async setupSqlite(testInfo) {
        await this.page.goto("./");
        await this.page.getByText("SQLite").click();
        await this.page.getByRole("button", { name: "Next" }).click();
        await screenshot(testInfo, this.page);
        await this.page.waitForURL("/setup");
        await screenshot(testInfo, this.page);
    }

    /**
     * Sets up the admin account.
     * @param {import('@playwright/test').TestInfo} testInfo - The test information for logging.
     * @param {string} username - The username for the admin account.
     * @param {string} password - The password for the admin account.
     * @returns {Promise<void>} - A promise that resolves when the setup is complete.
     */
    async setupAdmin(testInfo, username = "admin", password = "admin123") {
        await this.page.goto("./");
        await this.page.getByPlaceholder("Username").click();
        await this.page.getByPlaceholder("Username").fill(username);
        await this.page.getByPlaceholder("Username").press("Tab");
        await this.page
            .getByPlaceholder("Password", { exact: true })
            .fill(password);
        await this.page
            .getByPlaceholder("Password", { exact: true })
            .press("Tab");
        await this.page.getByPlaceholder("Repeat Password").fill(password);
        await this.page.getByRole("button", { name: "Create" }).click();
        await screenshot(testInfo, this.page);
    }

    /**
     * Logs in to the dashboard.
     * @param {import('@playwright/test').TestInfo} testInfo - The test information for logging.
     * @returns {Promise<void>} - A promise that resolves when login is complete.
     */
    async login(testInfo) {
        await this.page.goto("./dashboard");
        await login(this.page);
        await screenshot(testInfo, this.page);
    }

    /**
     * Logs out of the dashboard.
     * @param {import('@playwright/test').TestInfo} testInfo - The test information for logging.
     * @returns {Promise<void>} - A promise that resolves when logout is complete.
     */
    async logout(testInfo) {
        await this.page.goto("./dashboard");
        await login(this.page);
        await this.page.getByText("A", { exact: true }).click();
        await this.page.getByRole("button", { name: "Log out" }).click();
        await screenshot(testInfo, this.page);
    }

    /**
     * Takes a snapshot of the SQLite database.
     * @param {import('@playwright/test').TestInfo} testInfo - The test information for logging.
     * @returns {Promise<void>} - A promise that resolves when the snapshot is taken.
     */
    async takeSqliteSnapshot(testInfo) {
        await takeSqliteSnapshot(this.page);
        await screenshot(testInfo, this.page);
    }
}
