import { expect, test } from "@playwright/test";
import { getMonitorStatus, login, restoreSqliteSnapshot, screenshot } from "../util-test";

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

        const addConditionButton = page.getByTestId("add-condition-button");
        await expect(addConditionButton).toBeVisible();

        // Add 2 conditions & ensure they show in the UI
        await addConditionButton.click();
        await addConditionButton.click();
        expect(await page.getByTestId("condition").count()).toEqual(2);

        // Add a condition group & ensure it shows in the UI
        const addGroupButton = page.getByTestId("add-group-button");
        await expect(addGroupButton).toBeVisible();
        await addGroupButton.click();
        expect(await page.getByTestId("condition-group").count()).toEqual(1);
        expect(await page.getByTestId("condition").count()).toEqual(3); // 2 solo conditions + 1 condition in group

        await screenshot(testInfo, page);

        // Remove a condition & ensure it dissappears:
        await page.getByTestId("remove-condition").first().click();
        expect(await page.getByTestId("condition").count()).toEqual(2); // 1 solo condition + 1 condition in group

        // Remove the condition group & ensure it dissappears:
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

        const addConditionButton = page.getByTestId("add-condition-button");
        await expect(addConditionButton).toBeVisible();

        await addConditionButton.click();
        await addConditionButton.click();

        expect(await page.getByTestId("condition").count()).toBeGreaterThan(0);
        await page.getByTestId("condition-value").nth(0).fill("a.iana-servers.net");
        await page.getByTestId("condition-value").nth(1).fill("b.iana-servers.net");
        await page.getByTestId("condition-and-or").nth(0).selectOption("or");
        await screenshot(testInfo, page);

        const saveButton = page.getByTestId("save-button");
        await saveButton.click();

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

        const addConditionButton = page.getByTestId("add-condition-button");
        await expect(addConditionButton).toBeVisible();

        await addConditionButton.click();
        expect(await page.getByTestId("condition").count()).toBeGreaterThan(0);
        await page.getByTestId("condition-value").nth(0).fill("definitely-not.net");
        await screenshot(testInfo, page);

        const saveButton = page.getByTestId("save-button");
        await saveButton.click();

        await page.waitForURL("/dashboard/*"); // wait for the monitor to be created
        await expect(page.getByTestId("monitor-status")).toHaveText("down", { ignoreCase: true });
        await screenshot(testInfo, page);
    });

});
