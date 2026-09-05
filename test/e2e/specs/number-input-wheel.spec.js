import { expect, test } from "@playwright/test";
import { login, restoreSqliteSnapshot } from "../util-test";

test.describe("Number input mouse wheel behaviour (#1796)", () => {
    test.beforeEach(async ({ page }) => {
        await restoreSqliteSnapshot(page);
    });

    test("scrolling over a focused number input does not change its value", async ({ page }) => {
        await page.goto("./add");
        await login(page);

        await page.getByTestId("monitor-type-select").selectOption("port");

        const portInput = page.locator("#port");
        await expect(portInput).toBeVisible();
        await portInput.fill("8080");

        // Focus the input, keep the pointer over it and scroll
        await portInput.click();
        await portInput.hover();
        await page.mouse.wheel(0, 120);
        await expect(portInput).toHaveValue("8080");

        await page.mouse.wheel(0, -120);
        await expect(portInput).toHaveValue("8080");
    });
});
