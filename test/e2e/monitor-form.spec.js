import { expect, test } from "@playwright/test";
import { beforeEachSetup, login, screenshot } from "./util-test";

test.describe("Monitor Form", () => {

    test.beforeEach(async ({ page }, testInfo) => {
        await beforeEachSetup(testInfo, page);
    });

    test("add condition", async ({ page }, testInfo) => {
        await page.goto("./add");
        await login(page);

        const monitorTypeSelect = page.getByTestId("monitor-type-select");
        await expect(monitorTypeSelect).toBeVisible();

        await monitorTypeSelect.selectOption("dns");
        const selectedValue = await monitorTypeSelect.evaluate(select => select.value);
        expect(selectedValue).toBe("dns");

        await page.getByTestId("friendly-name-input").fill("Example DNS NS");
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

        const addGroupButton = page.getByTestId("add-group-button");
        await expect(addGroupButton).toBeVisible();
        await addGroupButton.click();

        await expect(page.getByTestId("condition-group")).toBeVisible();
        await screenshot(testInfo, page);
    });

});
