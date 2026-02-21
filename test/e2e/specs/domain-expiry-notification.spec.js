import { expect, test } from "@playwright/test";
import { login, restoreSqliteSnapshot, screenshot } from "../util-test";

test.describe("Domain Expiry Notification", () => {
    test.beforeEach(async ({ page }) => {
        await restoreSqliteSnapshot(page);
    });

    test("supported TLD auto-enables checkbox", async ({ page }, testInfo) => {
        await page.goto("./add");
        await login(page);

        const monitorTypeSelect = page.getByTestId("monitor-type-select");
        await monitorTypeSelect.selectOption("http");

        await page.getByTestId("url-input").fill("https://example.com");

        const checkbox = page.getByLabel("Domain Name Expiry Notification");
        await expect(checkbox).toBeChecked();
        await expect(checkbox).toBeEnabled();

        await screenshot(testInfo, page);
    });

    test("unsupported TLD leaves checkbox disabled", async ({ page }, testInfo) => {
        await page.goto("./add");
        await login(page);

        const monitorTypeSelect = page.getByTestId("monitor-type-select");
        await monitorTypeSelect.selectOption("http");

        await page.getByTestId("url-input").fill("https://example.co");

        const checkbox = page.getByLabel("Domain Name Expiry Notification");
        await expect(checkbox).not.toBeChecked();
        await expect(checkbox).toBeDisabled();

        await screenshot(testInfo, page);
    });

    test("switching from supported to unsupported TLD disables checkbox", async ({ page }, testInfo) => {
        await page.goto("./add");
        await login(page);

        const monitorTypeSelect = page.getByTestId("monitor-type-select");
        await monitorTypeSelect.selectOption("http");

        const urlInput = page.getByTestId("url-input");
        const checkbox = page.getByLabel("Domain Name Expiry Notification");

        await urlInput.fill("https://example.com");
        await expect(checkbox).toBeChecked();

        await urlInput.fill("https://example.co");
        await expect(checkbox).not.toBeChecked();
        await expect(checkbox).toBeDisabled();

        await screenshot(testInfo, page);
    });

    test("switching from unsupported to supported TLD enables checkbox", async ({ page }, testInfo) => {
        await page.goto("./add");
        await login(page);

        const monitorTypeSelect = page.getByTestId("monitor-type-select");
        await monitorTypeSelect.selectOption("http");

        const urlInput = page.getByTestId("url-input");
        const checkbox = page.getByLabel("Domain Name Expiry Notification");

        await urlInput.fill("https://example.co");
        await expect(checkbox).not.toBeChecked();

        await urlInput.fill("https://example.com");
        await expect(checkbox).toBeChecked();
        await expect(checkbox).toBeEnabled();

        await screenshot(testInfo, page);
    });

    test("manual uncheck preserved when URL changes within same TLD", async ({ page }, testInfo) => {
        await page.goto("./add");
        await login(page);

        const monitorTypeSelect = page.getByTestId("monitor-type-select");
        await monitorTypeSelect.selectOption("http");

        const urlInput = page.getByTestId("url-input");
        const checkbox = page.getByLabel("Domain Name Expiry Notification");

        await urlInput.fill("https://example.com");
        await expect(checkbox).toBeChecked();

        await checkbox.uncheck();
        await expect(checkbox).not.toBeChecked();

        await urlInput.fill("https://example.com/different-path");
        // Wait for debounce to fire and verify checkbox stays unchecked
        await page.waitForTimeout(600);
        await expect(checkbox).not.toBeChecked();
        await expect(checkbox).toBeEnabled();

        await screenshot(testInfo, page);
    });
});
