import { test, expect } from "../fixtures";
import { login, restoreSqliteSnapshot } from "../util-test";

const serverUrl = require("../../../playwright.config.js").url;

const adminPassword = "Kuma-E2E-8f4Q2xR9p";

/**
 * Open the general settings page, logging in first if needed.
 * @param {import("@playwright/test").Page} page Page
 * @returns {Promise<void>}
 */
async function openGeneralSettings(page) {
    await page.goto("./settings/general");
    await Promise.race([page.locator("#prometheusApiEnabled").waitFor(), page.getByPlaceholder("Username").waitFor()]);
    if (await page.getByPlaceholder("Username").isVisible()) {
        await login(page);
    }
    // The login redirects back to the settings page
    await expect(page.locator("#prometheusApiEnabled")).toBeVisible();
}

/**
 * Enable the Prometheus API in the general settings.
 * @param {import("@playwright/test").Page} page Page
 * @returns {Promise<void>}
 */
async function enablePrometheusApi(page) {
    await openGeneralSettings(page);
    await page.locator("#prometheusApiEnabled").check();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
}

test.describe("/metrics", () => {
    test.beforeEach(async () => {
        await restoreSqliteSnapshot();
    });

    test("is disabled by default", async ({ request }) => {
        const response = await request.get(`${serverUrl}/metrics`);
        expect(response.status()).toBe(404);
    });

    test.describe("when the Prometheus API is enabled", () => {
        test.beforeEach(async ({ page }) => {
            await enablePrometheusApi(page);
        });

        test("returns 401 without credentials", async ({ request }) => {
            const response = await request.get(`${serverUrl}/metrics`);
            expect(response.status()).toBe(401);
        });

        test("returns 401 with a wrong password", async ({ request }) => {
            const response = await request.get(`${serverUrl}/metrics`, {
                headers: {
                    Authorization: "Basic " + btoa("admin:wrongpassword"),
                },
            });
            expect(response.status()).toBe(401);
        });

        test("returns the metrics with the correct credentials", async ({ request }) => {
            const response = await request.get(`${serverUrl}/metrics`, {
                headers: {
                    Authorization: "Basic " + btoa(`admin:${adminPassword}`),
                },
            });

            expect(response.status()).toBe(200);
            const body = await response.text();
            expect(body).toContain("# HELP");
            expect(body).toContain("# TYPE");
        });
    });
});
