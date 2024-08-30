import { expect, test } from "@playwright/test";
import { login, restoreSqliteSnapshot, screenshot } from "../util-test";

test.describe("Monitor Form", () => {

    test.beforeEach(async ({ page }) => {
        await restoreSqliteSnapshot(page);
    });

    test("condition ui", async ({ page }, testInfo) => {
        await page.goto("./add");
        await login(page);
        await screenshot(testInfo, page);

        const monitorTypeSelect = page.getByTestId("monitor-type-select");
        await expect(monitorTypeSelect).toBeVisible();

        await monitorTypeSelect.selectOption("dns");
        const selectedValue = await monitorTypeSelect.evaluate(select => select.value);
        expect(selectedValue).toBe("dns");

        // Add Conditions & verify:
        await page.getByTestId("add-condition-button").click();
        expect(await page.getByTestId("condition").count()).toEqual(2); // 1 added by default + 1 explicitly added

        // Add a Condition Group & verify:
        await page.getByTestId("add-group-button").click();
        expect(await page.getByTestId("condition-group").count()).toEqual(1);
        expect(await page.getByTestId("condition").count()).toEqual(3); // 2 solo conditions + 1 condition in group

        await screenshot(testInfo, page);

        // Remove a condition & verify:
        await page.getByTestId("remove-condition").first().click();
        expect(await page.getByTestId("condition").count()).toEqual(2); // 1 solo condition + 1 condition in group

        // Remove a condition group & verify:
        await page.getByTestId("remove-condition-group").first().click();
        expect(await page.getByTestId("condition-group").count()).toEqual(0);

        await screenshot(testInfo, page);
    });

    test("successful condition", async ({ page }, testInfo) => {
        await page.goto("./add");
        await login(page);
        await screenshot(testInfo, page);

        const monitorTypeSelect = page.getByTestId("monitor-type-select");
        await expect(monitorTypeSelect).toBeVisible();

        await monitorTypeSelect.selectOption("dns");
        const selectedValue = await monitorTypeSelect.evaluate(select => select.value);
        expect(selectedValue).toBe("dns");

        const friendlyName = "Example DNS NS";
        await page.getByTestId("friendly-name-input").fill(friendlyName);
        await page.getByTestId("hostname-input").fill("example.com");

        // Vue-Multiselect component
        const resolveTypeSelect = page.getByTestId("resolve-type-select");
        await resolveTypeSelect.click();
        await resolveTypeSelect.getByRole("option", { name: "NS" }).click();

        await page.getByTestId("add-condition-button").click();
        expect(await page.getByTestId("condition").count()).toEqual(2); // 1 added by default + 1 explicitly added
        await page.getByTestId("condition-value").nth(0).fill("a.iana-servers.net");
        await page.getByTestId("condition-and-or").nth(0).selectOption("or");
        await page.getByTestId("condition-value").nth(1).fill("b.iana-servers.net");
        await screenshot(testInfo, page);

        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*"); // wait for the monitor to be created
        await expect(page.getByTestId("monitor-status")).toHaveText("up", { ignoreCase: true });
        await screenshot(testInfo, page);
    });

    test("failing condition", async ({ page }, testInfo) => {
        await page.goto("./add");
        await login(page);
        await screenshot(testInfo, page);

        const monitorTypeSelect = page.getByTestId("monitor-type-select");
        await expect(monitorTypeSelect).toBeVisible();

        await monitorTypeSelect.selectOption("dns");
        const selectedValue = await monitorTypeSelect.evaluate(select => select.value);
        expect(selectedValue).toBe("dns");

        const friendlyName = "Example DNS NS";
        await page.getByTestId("friendly-name-input").fill(friendlyName);
        await page.getByTestId("hostname-input").fill("example.com");

        // Vue-Multiselect component
        const resolveTypeSelect = page.getByTestId("resolve-type-select");
        await resolveTypeSelect.click();
        await resolveTypeSelect.getByRole("option", { name: "NS" }).click();

        expect(await page.getByTestId("condition").count()).toEqual(1); // 1 added by default
        await page.getByTestId("condition-value").nth(0).fill("definitely-not.net");
        await screenshot(testInfo, page);

        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*"); // wait for the monitor to be created
        await expect(page.getByTestId("monitor-status")).toHaveText("down", { ignoreCase: true });
        await screenshot(testInfo, page);
    });

});
