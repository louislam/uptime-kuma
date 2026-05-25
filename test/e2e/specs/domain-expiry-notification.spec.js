import { expect, test } from "@playwright/test";
import { login, restoreSqliteSnapshot, screenshot } from "../util-test";

test.describe("Domain Expiry Notification", () => {
    test.beforeEach(async ({ page }) => {
        await restoreSqliteSnapshot(page);
    });

    test("TLD enabled for new monitor", async ({ page }, testInfo) => {
        await page.goto("./add");
        await login(page);

        const monitorTypeSelect = page.getByTestId("monitor-type-select");
        await monitorTypeSelect.selectOption("http");

        await page.getByTestId("url-input").fill("https://example.com");

        const checkbox = page.getByLabel("Domain Name Expiry Notification");
        await expect(checkbox).toBeChecked();

        await screenshot(testInfo, page);
    });
});
