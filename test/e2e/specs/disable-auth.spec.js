import { test, expect } from "../fixtures";
import { login, restoreSqliteSnapshot } from "../util-test";

const serverUrl = require("../../../playwright.config.js").url;
const PASSWORD = "Kuma-E2E-8f4Q2xR9p";

/**
 * Open the security settings page, logging in first if needed.
 * @param {import("@playwright/test").Page} page Page
 * @returns {Promise<void>}
 */
async function openSecuritySettings(page) {
    await page.goto("./settings/security");
    await Promise.race([page.locator("#disableAuth-btn").waitFor(), page.getByPlaceholder("Username").waitFor()]);
    if (await page.getByPlaceholder("Username").isVisible()) {
        await login(page);
        // The login request has to finish before leaving the page, or the cookie is lost
        await expect(page.getByText("Add New Monitor")).toBeVisible();
        await page.goto("./settings/security");
    }
    await expect(page.locator("#disableAuth-btn")).toBeVisible();
}

/**
 * Open the dashboard in a browser that has no session cookie.
 * @param {import("@playwright/test").Browser} browser Browser
 * @returns {Promise<import("@playwright/test").Page>} The new page
 */
async function openAnonymousDashboard(browser) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${serverUrl}/dashboard`);
    return page;
}

test.describe("Disable Auth", () => {
    test("the dashboard loads without login, and enabling auth brings the login page back", async ({
        page,
        browser,
    }) => {
        let reEnabled = false;

        try {
            await openSecuritySettings(page);

            // Disabling auth requires the current password, typed in the change password form
            await page
                .locator("form")
                .filter({ has: page.getByRole("button", { name: "Update Password" }) })
                .locator("#current-password")
                .fill(PASSWORD);
            await page.locator("#disableAuth-btn").click();
            await page.getByRole("button", { name: "I understand, please disable" }).click();
            await expect(page.getByText("Saved.")).toBeVisible();

            // A browser without the session cookie can open the dashboard
            const anonymous = await openAnonymousDashboard(browser);
            try {
                await expect(anonymous.getByText("Add New Monitor")).toBeVisible();
            } finally {
                await anonymous.context().close();
            }

            // Enable auth again, the button does not ask for the password
            await page.goto("./settings/security");
            await page.locator("#enableAuth-btn").click();

            // The login page is back for a browser without a session
            const anonymousAgain = await openAnonymousDashboard(browser);
            try {
                await expect(anonymousAgain.getByPlaceholder("Username")).toBeVisible();
                reEnabled = true;
            } finally {
                await anonymousAgain.context().close();
            }
        } finally {
            // A failed run must not leave the whole suite without auth
            if (!reEnabled) {
                await restoreSqliteSnapshot();
            }
        }
    });
});
