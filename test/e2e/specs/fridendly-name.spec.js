import { expect, test } from "@playwright/test";
import { login, restoreSqliteSnapshot, screenshot } from "../util-test";

test.describe("Friendly Name Tests", () => {
    test.beforeEach(async ({ page }) => {
        await restoreSqliteSnapshot(page);
    });

    test("hostname", async ({ page }, testInfo) => {
        // Test DNS monitor with hostname
        await page.goto("./add");
        await login(page);
        await screenshot(testInfo, page);

        await page.getByTestId("monitor-type-select").selectOption("dns");
        await page.getByTestId("hostname-input").fill("example.com");
        await screenshot(testInfo, page);

        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");

        expect(page.getByTestId("monitor-list")).toContainText("example.com");
        await screenshot(testInfo, page);
    });

    test("URL hostname", async ({ page }, testInfo) => {
        // Test HTTP monitor with URL
        await page.goto("./add");
        await login(page);
        await screenshot(testInfo, page);

        await page.getByTestId("monitor-type-select").selectOption("http");
        await page.getByTestId("url-input").fill("https://www.example.com/");
        await screenshot(testInfo, page);

        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");

        expect(page.getByTestId("monitor-list")).toContainText("www.example.com");
        await screenshot(testInfo, page);
    });

    test("custom friendly name", async ({ page }, testInfo) => {
        // Test custom friendly name for HTTP monitor
        await page.goto("./add");
        await login(page);
        await screenshot(testInfo, page);

        await page.getByTestId("monitor-type-select").selectOption("http");
        await page.getByTestId("url-input").fill("https://www.example.com/");

        // Check if the friendly name placeholder is set to the hostname
        const friendlyNameInput = page.getByTestId("friendly-name-input");
        expect(friendlyNameInput).toHaveAttribute("placeholder", "www.example.com");
        await screenshot(testInfo, page);

        const customName = "Example Monitor";
        await friendlyNameInput.fill(customName);
        await screenshot(testInfo, page);

        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");

        expect(page.getByTestId("monitor-list")).toContainText(customName);
        await screenshot(testInfo, page);
    });

    test("default friendly name", async ({ page }, testInfo) => {
        // Test default friendly name when no custom name is provided
        await page.goto("./add");
        await login(page);
        await screenshot(testInfo, page);

        await page.getByTestId("monitor-type-select").selectOption("group");
        await screenshot(testInfo, page);

        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");

        expect(page.getByTestId("monitor-list")).toContainText("New Monitor");
        await screenshot(testInfo, page);
    });
});
