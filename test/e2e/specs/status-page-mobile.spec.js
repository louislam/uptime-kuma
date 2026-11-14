import { expect, test } from "@playwright/test";
import { login, restoreSqliteSnapshot, screenshot } from "../util-test";

test.describe("Status Page Edit Mode On Mobile", () => {
    test.beforeEach(async ({ page }) => {
        await restoreSqliteSnapshot(page);
    });

    test("edit mode does not overflow the viewport or hide the incident buttons", async ({ page }, testInfo) => {
        test.setTimeout(60000);

        // A phone sized viewport is needed to catch the layout issue
        await page.setViewportSize({ width: 393, height: 851 });

        await page.goto("./add");
        await login(page);
        await expect(page.getByTestId("monitor-type-select")).toBeVisible();

        await page.goto("./add-status-page");
        await page.getByTestId("name-input").fill("Mobile Layout");
        await page.getByTestId("slug-input").fill("mobile-layout");
        await page.getByTestId("submit-button").click();
        await page.waitForURL("/status/mobile-layout?edit");

        // Add an incident so the edit and delete buttons are rendered
        await page.getByTestId("create-incident-button").click();
        await page.getByTestId("incident-title").fill("Mobile Incident");
        await page.getByTestId("incident-content-editable").fill("Testing the mobile layout.");
        await page.getByTestId("post-incident-button").click();
        await page.waitForTimeout(500);

        const layout = await page.evaluate(() => {
            const width = document.documentElement.clientWidth;
            const isOffscreen = (selector) => {
                const el = document.querySelector(selector);
                return el ? el.getBoundingClientRect().right > width : null;
            };
            return {
                overflow: document.documentElement.scrollWidth - width,
                saveOffscreen: isOffscreen('[data-testid="save-button"]'),
            };
        });

        // Nothing should push the page sideways
        expect(layout.overflow).toBe(0);
        // The sidebar footer must stay reachable
        expect(layout.saveOffscreen).toBe(false);

        // The save button should be clickable, not covered by the sidebar
        await expect(page.getByTestId("save-button")).toBeVisible();
        await page.getByTestId("save-button").click();
        await expect(page.getByTestId("edit-sidebar")).toHaveCount(0);

        await screenshot(testInfo, page);
    });

    test("incident actions stay usable on a phone viewport", async ({ page }, testInfo) => {
        test.setTimeout(60000);

        await page.setViewportSize({ width: 393, height: 851 });

        await page.goto("./add");
        await login(page);
        await expect(page.getByTestId("monitor-type-select")).toBeVisible();

        await page.goto("./add-status-page");
        await page.getByTestId("name-input").fill("Mobile Actions");
        await page.getByTestId("slug-input").fill("mobile-actions");
        await page.getByTestId("submit-button").click();
        await page.waitForURL("/status/mobile-actions?edit");

        await page.getByTestId("create-incident-button").click();
        await page.getByTestId("incident-title").fill("Action Incident");
        await page.getByTestId("incident-content-editable").fill("Testing incident actions.");
        await page.getByTestId("post-incident-button").click();
        await page.waitForTimeout(500);

        const incident = page.getByTestId("incident").filter({ hasText: "Action Incident" });

        // The edit and delete buttons have to be inside the visible area
        const editButton = incident.locator("button", { hasText: "Edit" });
        const deleteButton = incident.locator("button", { hasText: "Delete" });
        await expect(editButton).toBeInViewport();
        await expect(deleteButton).toBeInViewport();

        // Deleting opens the confirmation dialog, which must be tappable
        await deleteButton.click();
        const confirmDialog = page.locator(".modal.show");
        await expect(confirmDialog).toBeVisible();

        const yesButton = confirmDialog.locator("button", { hasText: "Yes" });
        await expect(yesButton).toBeInViewport();
        await yesButton.click();
        await expect(confirmDialog).toHaveCount(0);
        await expect(incident).toHaveCount(0);

        // No backdrop should be left behind blocking the page
        await expect(page.locator(".modal-backdrop")).toHaveCount(0);

        await screenshot(testInfo, page);
    });
});
