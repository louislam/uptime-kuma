import { expect, test } from "@playwright/test";
import { login, restoreSqliteSnapshot, screenshot } from "../util-test";

test.describe("Example Spec", () => {

    test.beforeEach(async ({ page }) => {
        await restoreSqliteSnapshot(page);
    });

    test("dashboard", async ({ page }, testInfo) => {
        await page.goto("./dashboard");
        await login(page);
        await screenshot(testInfo, page);
    });

    test("change display timezone", async ({ page }, testInfo) => {
        await page.goto("./settings/general");
        await login(page);
        await page.getByLabel("Display Timezone").selectOption("Pacific/Fiji");
        await page.getByRole("button", { name: "Save" }).click();
        await screenshot(testInfo, page);

        await page.goto("./dashboard");
        await page.goto("./settings/general");
        await expect(page.getByLabel("Display Timezone")).toHaveValue("Pacific/Fiji");
    });

    test("database is reset after previous test", async ({ page }, testInfo) => {
        await page.goto("./settings/general");
        await login(page);

        const timezoneEl = page.getByLabel("Display Timezone");
        await expect(timezoneEl).toBeVisible();
        await expect(timezoneEl).toHaveValue("auto");
        await screenshot(testInfo, page);
    });

});
