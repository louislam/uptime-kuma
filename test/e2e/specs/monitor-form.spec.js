import { expect, test } from "../fixtures";
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

    const invalidURLs = [
        "http:///",
        "http:///example.com",
        "https:///example.com",
        "http://\\example.com",
        "https://",
        "not-a-url",
    ];
    const validURLs = [
        "https://example.com",
        "http://localhost:3000",
        "http://127.0.0.1:8080",
        "http://[::1]:3000",
        "https://example.com:8443/path?x=1",
        "http://user:pass@example.com/path",
        "https://例え.テスト/path",
        "http://service.internal:8080/health",
        "http://user:p%40ss@EXAMPLE.com:80/path#fragment",
        "https://example.com?next=\\health",
        "https://example.com#\\section",
    ];

    for (const editing of [false, true]) {
        for (const url of [...invalidURLs, ...validURLs]) {
            const valid = validURLs.includes(url);
            test(`HTTP URL ${editing ? "editing" : "creation"} ${valid ? "accepts" : "rejects"} ${url}`, async ({
                page,
            }) => {
                await page.goto("./add");
                await login(page);
                await selectMonitorType(page, "http");
                const name = "HTTP URL validation";
                const originalURL = "http://127.0.0.1:1/original";
                await page.getByTestId("friendly-name-input").fill(name);

                if (editing) {
                    await page.getByTestId("url-input").fill(originalURL);
                    await page.getByTestId("save-button").click();
                    await page.waitForURL("/dashboard/*");
                    await page.getByRole("link", { name: "Edit", exact: true }).click();
                    await page.waitForURL("/edit/*");
                }

                const input = page.getByTestId("url-input");
                await input.fill(url);
                const nativeValid = await input.evaluate((element) => element.validity.valid);
                await page.getByTestId("save-button").click();

                if (valid) {
                    if (!editing) {
                        await page.waitForURL("/dashboard/*");
                        await page.getByRole("link", { name: "Edit", exact: true }).click();
                    } else {
                        await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
                    }
                    await page.reload();
                    await expect(page.getByTestId("url-input")).toHaveValue(url);
                } else {
                    if (nativeValid) {
                        await expect(page.getByText("Invalid URL", { exact: true })).toHaveCount(1);
                        await expect(page.getByText("Invalid URL", { exact: true })).toBeVisible();
                    } else {
                        expect(await input.evaluate((element) => element.validationMessage)).not.toBe("");
                    }
                    await expect(page).toHaveURL(editing ? /\/edit\/\d+$/ : /\/add$/);
                    if (editing) {
                        await page.reload();
                        await expect(page.getByTestId("url-input")).toHaveValue(originalURL);
                    } else {
                        await page.goto("./dashboard");
                        await expect(page.getByRole("link", { name, exact: true })).toHaveCount(0);
                    }
                }
            });
        }
    }

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
        await page.getByTestId("hostname-input").fill("kuma.pet");

        const resolveTypeSelect = page.getByTestId("resolve-type-select");
        await resolveTypeSelect.click();
        await resolveTypeSelect.getByRole("option", { name: "NS" }).click();

        await page.getByTestId("add-condition-button").click();
        expect(await page.getByTestId("condition").count()).toEqual(1); // 1 explicitly added

        await page.getByTestId("add-condition-button").click();
        expect(await page.getByTestId("condition").count()).toEqual(2); // 2 explicitly added

        await page.getByTestId("condition-value").nth(0).fill("carl.ns.cloudflare.com");
        await page.getByTestId("condition-and-or").nth(0).selectOption("or");
        await page.getByTestId("condition-value").nth(1).fill("jean.ns.cloudflare.com");

        await screenshot(testInfo, page);
        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");

        await expect(page.getByTestId("monitor-status")).toHaveText("up", { ignoreCase: true });

        await screenshot(testInfo, page);
    });

    test("failing condition", async ({ page }, testInfo) => {
        await page.goto("./add");
        await login(page);
        await screenshot(testInfo, page);
        await selectMonitorType(page);

        const friendlyName = "Example DNS NS";
        await page.getByTestId("friendly-name-input").fill(friendlyName);
        await page.getByTestId("hostname-input").fill("kuma.pet");

        const resolveTypeSelect = page.getByTestId("resolve-type-select");
        await resolveTypeSelect.click();
        await resolveTypeSelect.getByRole("option", { name: "NS" }).click();

        await page.getByTestId("add-condition-button").click();
        expect(await page.getByTestId("condition").count()).toEqual(1); // 1 explicitly added

        await page.getByTestId("condition-value").nth(0).fill("definitely-not.net");

        await screenshot(testInfo, page);
        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");

        await expect(page.getByTestId("monitor-status")).toHaveText("down", { ignoreCase: true });

        await screenshot(testInfo, page);
    });

    test("save response settings persist", async ({ page }, testInfo) => {
        await page.goto("./add");
        await login(page);
        await selectMonitorType(page, "http");

        const friendlyName = "Example HTTP Save Response";
        await page.getByTestId("friendly-name-input").fill(friendlyName);
        await page.getByTestId("url-input").fill("https://www.example.com/");

        // Expect error response save enabled by default
        await expect(page.getByLabel("Save HTTP Error Response for Notifications")).toBeChecked();

        await page.getByLabel("Save HTTP Success Response for Notifications").check();
        await page.getByLabel("Save HTTP Error Response for Notifications").uncheck();
        await page.getByLabel("Response Max Length (bytes)").fill("2048");

        await screenshot(testInfo, page);
        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");

        await page.getByRole("link", { name: "Edit" }).click();
        await page.waitForURL("/edit/*");

        await expect(page.getByLabel("Save HTTP Success Response for Notifications")).toBeHidden();
        await expect(page.getByLabel("Save HTTP Error Response for Notifications")).not.toBeChecked();
        await expect(page.getByLabel("Response Max Length (bytes)")).toHaveValue("2048");

        await screenshot(testInfo, page);
    });
});
