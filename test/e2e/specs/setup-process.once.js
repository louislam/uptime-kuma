import { test } from "@playwright/test";
import { getSqliteDatabaseExists, login, screenshot } from "../util-test";

test.describe("Uptime Kuma Setup", () => {
    test.skip(() => getSqliteDatabaseExists(), "Must only run once per session");

    test.afterEach(async ({ page }, testInfo) => {
        await screenshot(testInfo, page);
    });

    /*
     * Setup
     */

    test("setup sqlite", async ({ page }, testInfo) => {
        await page.goto("./setup-database");
        await page.getByText("SQLite").click();
        await page.getByRole("button", { name: "Next" }).click();
        await screenshot(testInfo, page);
        await page.waitForURL("/setup"); // ensures the server is ready to continue to the next test
    });

    test("setup admin", async ({ page }) => {
        await page.goto("./setup");
        await page.getByRole("textbox", { name: "Username" }).click();
        await page.getByRole("textbox", { name: "Username" }).fill("admin");
        await page.getByRole("textbox", { name: "Password", exact: true }).fill("admin123");
        await page.getByRole("textbox", { name: "Repeat Password" }).fill("admin123");
        await page.getByRole("button", { name: "Create" }).click();
        // User is auto-logged in and redirected to dashboard
        await page.waitForURL("/dashboard");
    });

    /*
     * All other tests should be run after setup
     */

    test("login", async ({ page }) => {
        await page.goto("./dashboard");
        await login(page);
    });

    test("failed login shows error alert", async ({ page }, testInfo) => {
        await page.goto("./dashboard");
        await page.getByPlaceholder("Username").fill("admin");
        await page.getByPlaceholder("Password").fill("wrongpassword");
        await page.getByRole("button", { name: "Log in" }).click();
        await page.waitForSelector(".alert.alert-danger", { state: "visible" });
        await screenshot(testInfo, page);
    });

    test("logout", async ({ page }) => {
        await page.goto("./dashboard");
        await login(page);
        await page.getByText("A", { exact: true }).click();
        await page.getByRole("button", { name: "Log out" }).click();
    });
});
