import { expect, test } from "@playwright/test";
import { login, restoreSqliteSnapshot, screenshot } from "../util-test";
import { step } from "../tools/step";

/**
 * Initializes the monitor form by navigating to the add page, logging in,
 * taking a screenshot, and selecting a monitor type from the dropdown.
 * @param {import('@playwright/test').Page} page - The Playwright page instance.
 * @param {import('@playwright/test').TestInfo} testInfo - Information about the current test run.
 * @param {string} monitorType - The monitor type to select (default is "dns").
 * @returns {Promise<void>} - A promise that resolves when the form setup is complete.
 */
async function setupMonitorForm(page, testInfo, monitorType = "dns") {
    step("Navigating to add monitor form");
    await page.goto("./add");

    step("Logging in");
    await login(page);
    await screenshot(testInfo, page);

    const monitorTypeSelect = page.getByTestId("monitor-type-select");
    await expect(monitorTypeSelect).toBeVisible();

    step(`Selecting monitor type: ${monitorType}`);
    await monitorTypeSelect.selectOption(monitorType);

    const selectedValue = await monitorTypeSelect.evaluate(
        (select) => select.value
    );
    expect(selectedValue).toBe(monitorType);
}

test.describe("Monitor Form", () => {
    test.beforeEach(async ({ page }) => {
        await restoreSqliteSnapshot(page);
    });

    test("condition ui", async ({ page }, testInfo) => {
        await setupMonitorForm(page, testInfo);

        step("Adding a condition");
        await page.getByTestId("add-condition-button").click();
        expect(await page.getByTestId("condition").count()).toEqual(2); // 1 added by default + 1 explicitly added

        step("Adding a condition group");
        await page.getByTestId("add-group-button").click();
        expect(await page.getByTestId("condition-group").count()).toEqual(1);
        expect(await page.getByTestId("condition").count()).toEqual(3); // 2 solo conditions + 1 condition in group

        await screenshot(testInfo, page);

        step("Removing a condition");
        await page.getByTestId("remove-condition").first().click();
        expect(await page.getByTestId("condition").count()).toEqual(2); // 1 solo condition + 1 condition in group

        step("Removing a condition group");
        await page.getByTestId("remove-condition-group").first().click();
        expect(await page.getByTestId("condition-group").count()).toEqual(0);

        await screenshot(testInfo, page);
    });

    test("successful condition", async ({ page }, testInfo) => {
        await setupMonitorForm(page, testInfo);

        const friendlyName = "Example DNS NS";

        step("Filling in friendly name and hostname");
        await page.getByTestId("friendly-name-input").fill(friendlyName);
        await page.getByTestId("hostname-input").fill("example.com");

        // Vue-Multiselect component
        const resolveTypeSelect = page.getByTestId("resolve-type-select");

        step("Selecting resolve type: NS");
        await resolveTypeSelect.click();
        await resolveTypeSelect.getByRole("option", { name: "NS" }).click();

        step("Adding a condition");
        await page.getByTestId("add-condition-button").click();

        expect(await page.getByTestId("condition").count()).toEqual(2); // 1 added by default + 1 explicitly added

        step("Filling in condition values");
        await page
            .getByTestId("condition-value")
            .nth(0)
            .fill("a.iana-servers.net");
        await page.getByTestId("condition-and-or").nth(0).selectOption("or");
        await page
            .getByTestId("condition-value")
            .nth(1)
            .fill("b.iana-servers.net");

        await screenshot(testInfo, page);

        step("Saving the condition");
        await page.getByTestId("save-button").click();

        await page.waitForURL("/dashboard/*"); // wait for the monitor to be created

        expect(page.getByTestId("monitor-status")).toHaveText("up", {
            ignoreCase: true,
        });

        await screenshot(testInfo, page);
    });

    test("failing condition", async ({ page }, testInfo) => {
        await setupMonitorForm(page, testInfo);

        const friendlyName = "Example DNS NS";

        step("Filling in friendly name and hostname for failing condition");
        await page.getByTestId("friendly-name-input").fill(friendlyName);
        await page.getByTestId("hostname-input").fill("example.com");

        // Vue-Multiselect component
        const resolveTypeSelect = page.getByTestId("resolve-type-select");

        step("Selecting resolve type: NS");
        await resolveTypeSelect.click();
        await resolveTypeSelect.getByRole("option", { name: "NS" }).click();

        expect(await page.getByTestId("condition").count()).toEqual(1); // 1 added by default

        step("Filling in failing condition value");
        await page
            .getByTestId("condition-value")
            .nth(0)
            .fill("definitely-not.net");

        await screenshot(testInfo, page);

        step("Saving the failing condition");
        await page.getByTestId("save-button").click();

        await page.waitForURL("/dashboard/*"); // wait for the monitor to be created

        expect(page.getByTestId("monitor-status")).toHaveText("down", {
            ignoreCase: true,
        });

        await screenshot(testInfo, page);
    });
});
