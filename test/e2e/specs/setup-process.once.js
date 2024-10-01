import { test } from "@playwright/test";
import { getSqliteDatabaseExists, login, screenshot, takeSqliteSnapshot } from "../util-test";
import { step } from "../tools/step";

test.describe("Uptime Kuma Setup", () => {

    // Skip tests if the SQLite database already exists (only run once per session)
    test.skip(() => getSqliteDatabaseExists(), "Must only run once per session");

    /*
     * Hook to take a screenshot after each test
     */
    test.afterEach(async ({ page }, testInfo) => {
        await screenshot(testInfo, page);
    });

    /*
     * Setup
     */

    test("setup sqlite", async ({ page }, testInfo) => {
        step("Navigating to setup page");
        await page.goto("./");
        step("Clicking on SQLite option");
        await page.getByText("SQLite").click();
        step("Proceeding to next step");
        await page.getByRole("button", { name: "Next" }).click();
        await screenshot(testInfo, page);
        await page.waitForURL("/setup"); // ensures the server is ready to continue to the next test
    });

    test("setup admin", async ({ page }) => {
        step("Setting up admin credentials");
        await page.goto("./");
        await page.getByPlaceholder("Username").click();
        await page.getByPlaceholder("Username").fill("admin");
        await page.getByPlaceholder("Username").press("Tab");
        await page.getByPlaceholder("Password", { exact: true }).fill("admin123");
        await page.getByPlaceholder("Password", { exact: true }).press("Tab");
        await page.getByPlaceholder("Repeat Password").fill("admin123");
        step("Creating admin account");
        await page.getByRole("button", { name: "Create" }).click();
    });

    /*
     * All other tests should be run after setup
     */

    test("login", async ({ page }) => {
        step("Logging in to dashboard");
        await page.goto("./dashboard");
        await login(page);
    });

    test("logout", async ({ page }) => {
        step("Logging out from dashboard");
        await page.goto("./dashboard");
        await login(page);
        await page.getByText("A", { exact: true }).click();
        step("Clicking logout button");
        await page.getByRole("button", { name: "Log out" }).click();
    });

    test("take sqlite snapshot", async ({ page }) => {
        step("Taking SQLite snapshot");
        await takeSqliteSnapshot(page);
    });

});
