import { test } from "@playwright/test";
import { login, screenshot } from "./util-test";

/*
 * Setup
 */

test("setup sqlite", async ({ page }, testInfo) => {
    await page.goto("./");
    await page.getByText("SQLite").click();
    await page.getByRole("button", { name: "Next" }).click();
    await screenshot(testInfo, page);
});

test("setup admin", async ({ page }, testInfo) => {
    await page.goto("./");
    await page.getByPlaceholder("Username").click();
    await page.getByPlaceholder("Username").fill("admin");
    await page.getByPlaceholder("Username").press("Tab");
    await page.getByPlaceholder("Password", { exact: true }).fill("admin123");
    await page.getByPlaceholder("Password", { exact: true }).press("Tab");
    await page.getByPlaceholder("Repeat Password").fill("admin123");
    await page.getByRole("button", { name: "Create" }).click();
    await screenshot(testInfo, page);
});

/*
 * All other tests should be run after setup
 */

test("login", async ({ page }, testInfo) => {
    await page.goto("./dashboard");
    await login(page);
    await screenshot(testInfo, page);
});

test("logout", async ({ page }, testInfo) => {
    await page.goto("./dashboard");
    await login(page);
    await page.getByText("A", { exact: true }).click();
    await page.getByRole("button", { name: "Logout" }).click();
    await screenshot(testInfo, page);
});
