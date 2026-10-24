import { expect, test } from "@playwright/test";
import { login, restoreSqliteSnapshot } from "../util-test";

test.describe("Maintenance actions", () => {
    test.beforeEach(async ({ page }) => {
        await restoreSqliteSnapshot();
        await page.goto("./add-maintenance");
        await login(page);
        await page.locator("#name").fill("Mobile maintenance");
        await page.locator("#strategy").selectOption("manual");
        await page.locator("#show-on-all-pages").check();
        await page.locator("#monitor-submit-btn").click();
        await page.locator(".modal.show").getByRole("button", { name: "Yes", exact: true }).click();
        await page.waitForURL("/maintenance");
    });

    for (const [locale, labels] of [
        ["en", ["Pause", "Resume"]],
        ["nl-NL", ["Pauze", "Hervatten"]],
    ]) {
        test(`buttons stay inside the card (${locale})`, async ({ page }) => {
            await page.evaluate((locale) => {
                localStorage.locale = locale;
            }, locale);
            await page.reload();
            const card = page.locator(".item").filter({ hasText: "Mobile maintenance" });
            const buttons = card.locator(".buttons .btn");

            for (const active of [true, false]) {
                await expect(card.locator(".buttons button").first()).toHaveText(labels[active ? 0 : 1]);

                for (const width of [320, 375, 390, 550, 551, 767, 768, 1024, 1280]) {
                    await page.setViewportSize({ width, height: 900 });
                    if (width < 768) {
                        await expect(page.locator("body")).toHaveClass(/\bmobile\b/);
                    } else {
                        await expect(page.locator("body")).not.toHaveClass(/\bmobile\b/);
                    }
                    await expect(buttons).toHaveCount(4);
                    for (const button of await buttons.all()) {
                        await expect(button).toBeVisible();
                    }
                    await expect
                        .poll(
                            async () => {
                                return card.evaluate((item) => {
                                    const cardBounds = item.getBoundingClientRect();
                                    const buttons = Array.from(item.querySelectorAll(".buttons .btn"));
                                    return (
                                        buttons.length === 4 &&
                                        buttons.every((button) => {
                                            const bounds = button.getBoundingClientRect();
                                            return (
                                                bounds.width > 0 &&
                                                bounds.height > 0 &&
                                                bounds.left >= cardBounds.left - 1 &&
                                                bounds.right <= cardBounds.right + 1
                                            );
                                        }) &&
                                        document.documentElement.scrollWidth <= window.innerWidth
                                    );
                                });
                            },
                            { message: `Buttons fit at ${width}px (active=${active})` }
                        )
                        .toBe(true);
                }

                if (active) {
                    await card.locator(".buttons button").first().click();
                    await page.locator(".modal.show .modal-footer .btn-primary").click();
                    await expect(card.locator(".buttons .btn-primary")).toBeVisible();
                }
            }
        });
    }
});
