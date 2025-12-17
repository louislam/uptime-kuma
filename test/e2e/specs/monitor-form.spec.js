import { expect, test } from "@playwright/test";
import { login, restoreSqliteSnapshot, screenshot } from "../util-test";

/**
 * Selects the monitor type from the dropdown.
 * @param {import('@playwright/test').Page} page - The Playwright page instance.
 * @param {string} monitorType - The monitor type to select (default is "dns").
 * @returns {Promise<void>} - A promise that resolves when the monitor type is selected.
 */
async function selectMonitorType(page, monitorType = "dns") {
    const monitorTypeSelect = page.getByTestId("monitor-type-select");
    await expect(monitorTypeSelect).toBeVisible();
    await monitorTypeSelect.selectOption(monitorType);

    const selectedValue = await monitorTypeSelect.evaluate((select) => select.value);
    expect(selectedValue).toBe(monitorType);
}

test.describe("Monitor Form", () => {
    test.beforeEach(async ({ page }) => {
        await restoreSqliteSnapshot(page);
    });

    test("condition ui", async ({ page }, testInfo) => {
        await page.goto("./add");
        await login(page);
        await screenshot(testInfo, page);
        await selectMonitorType(page);

        await page.getByTestId("add-condition-button").click();
        expect(await page.getByTestId("condition").count()).toEqual(1); // 1 explicitly added

        await page.getByTestId("add-group-button").click();
        expect(await page.getByTestId("condition-group").count()).toEqual(1);
        expect(await page.getByTestId("condition").count()).toEqual(2); // 1 solo conditions + 1 condition in group

        await screenshot(testInfo, page);

        await page.getByTestId("remove-condition").first().click();
        expect(await page.getByTestId("condition").count()).toEqual(1); // 0 solo condition + 1 condition in group

        await page.getByTestId("remove-condition-group").first().click();
        expect(await page.getByTestId("condition-group").count()).toEqual(0);

        await screenshot(testInfo, page);
    });

    test("successful condition", async ({ page }, testInfo) => {
        await page.goto("./add");
        await login(page);
        await screenshot(testInfo, page);
        await selectMonitorType(page);

        const friendlyName = "Example DNS NS";
        await page.getByTestId("friendly-name-input").fill(friendlyName);
        await page.getByTestId("hostname-input").fill("example.com");

        const resolveTypeSelect = page.getByTestId("resolve-type-select");
        await resolveTypeSelect.click();
        await resolveTypeSelect.getByRole("option", { name: "NS" }).click();

        await page.getByTestId("add-condition-button").click();
        expect(await page.getByTestId("condition").count()).toEqual(1); // 1 explicitly added

        await page.getByTestId("add-condition-button").click();
        expect(await page.getByTestId("condition").count()).toEqual(2); // 2 explicitly added

        await page.getByTestId("condition-value").nth(0).fill("a.iana-servers.net");
        await page.getByTestId("condition-and-or").nth(0).selectOption("or");
        await page.getByTestId("condition-value").nth(1).fill("b.iana-servers.net");

        await screenshot(testInfo, page);
        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");

        expect(page.getByTestId("monitor-status")).toHaveText("up", { ignoreCase: true });

        await screenshot(testInfo, page);
    });

    test("failing condition", async ({ page }, testInfo) => {
        await page.goto("./add");
        await login(page);
        await screenshot(testInfo, page);
        await selectMonitorType(page);

        const friendlyName = "Example DNS NS";
        await page.getByTestId("friendly-name-input").fill(friendlyName);
        await page.getByTestId("hostname-input").fill("example.com");

        const resolveTypeSelect = page.getByTestId("resolve-type-select");
        await resolveTypeSelect.click();
        await resolveTypeSelect.getByRole("option", { name: "NS" }).click();

        await page.getByTestId("add-condition-button").click();
        expect(await page.getByTestId("condition").count()).toEqual(1); // 1 explicitly added

        await page.getByTestId("condition-value").nth(0).fill("definitely-not.net");

        await screenshot(testInfo, page);
        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");

        expect(page.getByTestId("monitor-status")).toHaveText("down", { ignoreCase: true });

        await screenshot(testInfo, page);
    });

    test("real-browser monitor with keyword functionality", async ({ page }, testInfo) => {
        // Create a real-browser monitor that searches for specific text on a page
        await page.goto("./add");
        await login(page);
        await screenshot(testInfo, page);
        await selectMonitorType(page, "real-browser");

        // Configure monitor to visit httpbin.org/html (contains Moby Dick excerpt)
        await page.getByTestId("friendly-name-input").fill("Test Real Browser with Keyword");
        await page.getByTestId("url-input").fill("https://httpbin.org/html");

        // Verify keyword controls are available for real-browser monitor type
        const keywordInput = page.locator("#keyword");
        await expect(keywordInput).toBeVisible();
        const invertKeywordCheckbox = page.locator("#invert-keyword");
        await expect(invertKeywordCheckbox).toBeVisible();

        // Search for "Herman Melville" - this text exists on the test page
        await keywordInput.fill("Herman Melville");

        await screenshot(testInfo, page);
        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");
        await screenshot(testInfo, page);
    });

    test("real-browser monitor with invert keyword", async ({ page }, testInfo) => {
        // Create a real-browser monitor with inverted keyword logic (pass if NOT found)
        await page.goto("./add");
        await login(page);
        await selectMonitorType(page, "real-browser");

        // Configure monitor to ensure specific text is NOT present on the page
        await page.getByTestId("friendly-name-input").fill("Test Real Browser with Invert Keyword");
        await page.getByTestId("url-input").fill("https://httpbin.org/html");

        // Search for text that doesn't exist on the page
        const keywordInput = page.locator("#keyword");
        await keywordInput.fill("NonExistentText123");

        // Enable invert - monitor passes if keyword is NOT found
        const invertKeywordCheckbox = page.locator("#invert-keyword");
        await invertKeywordCheckbox.check();

        await screenshot(testInfo, page);
        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");
        await screenshot(testInfo, page);
    });

    test("real-browser monitor without keyword", async ({ page }, testInfo) => {
        // Create a real-browser monitor without keyword validation (just check page loads)
        await page.goto("./add");
        await login(page);
        await selectMonitorType(page, "real-browser");

        // Configure monitor without keyword - just verify page loads successfully
        await page.getByTestId("friendly-name-input").fill("Test Real Browser No Keyword");
        await page.getByTestId("url-input").fill("https://httpbin.org/html");

        // Keyword field is visible but not required - leave it empty
        const keywordInput = page.locator("#keyword");
        await expect(keywordInput).toBeVisible();

        await screenshot(testInfo, page);
        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");
        await screenshot(testInfo, page);
    });
});
