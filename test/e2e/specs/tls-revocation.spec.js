import { expect, test } from "@playwright/test";
import { login, restoreSqliteSnapshot, screenshot } from "../util-test";

/**
 * Create an HTTP monitor via the UI and navigate back to the dashboard.
 * @param {import('@playwright/test').Page} page - Playwright page instance.
 * @param {{ name: string, url: string, ignoreTls?: boolean }} param1 - Monitor parameters.
 * @returns {Promise<void>} Resolves when the monitor has been saved and the dashboard is shown.
 */
async function createHttpMonitor(page, { name, url, ignoreTls = false }) {
    await page.goto("./add");
    await login(page);

    await expect(page.getByTestId("monitor-type-select")).toBeVisible();
    await page.getByTestId("monitor-type-select").selectOption("http");

    await page.getByTestId("friendly-name-input").fill(name);
    await page.getByTestId("url-input").fill(url);

    if (ignoreTls) {
        // No data-testid, so select by id
        await page.locator("#ignore-tls").check();
    }

    await page.getByTestId("save-button").click();
    await page.waitForURL("/dashboard/*");
}

/**
 * Wait until the monitor status badge matches the expected value.
 * @param {import('@playwright/test').Page} page - Playwright page instance.
 * @param {string} expected - Expected status text (case-insensitive). One of: up | down | pending | maintenance.
 * @param {number} timeoutMs - Max time to wait in milliseconds. Default: 15000.
 * @returns {Promise<void>} Resolves when the expected status appears or rejects on timeout.
 */
async function waitForStatus(page, expected, timeoutMs = 15000) {
    await expect(page.getByTestId("monitor-status")).toHaveText(expected, {
        ignoreCase: true,
        timeout: timeoutMs,
    });
}

test.describe("TLS Revocation (Policy: OCSP Mixed with failHard=false)", () => {
    test.beforeEach(async ({ page }) => {
        await restoreSqliteSnapshot(page);
    });

    test("if a domain is not revoked, the monitor should be UP", async ({ page }, testInfo) => {
        await createHttpMonitor(page, { name: "not-revoked",
            url: "https://www.example.com" });
        await waitForStatus(page, "up");
        await screenshot(testInfo, page);
    });

    test("if a domain is OCSP-revoked, the monitor should be DOWN", async ({ page }, testInfo) => {
        await createHttpMonitor(page, { name: "ocsp-revoked",
            url: "https://aaacertificateservices.comodoca.com:444" });
        await waitForStatus(page, "down");
        await screenshot(testInfo, page);
    });

    // TODO: Modify this test when we support CRLs
    test("if a domain is CRL-only revoked, the monitor should be UP (because we don't support CRLs yet and failHard=false)", async ({ page }, testInfo) => {
        await createHttpMonitor(page, { name: "crl-only-revoked",
            url: "https://revoked.badssl.com" });
        await waitForStatus(page, "up");
        await screenshot(testInfo, page);
    });

    // StackOverflow uses Let's Encrypt which recently dropped OCSP support (c.f. https://letsencrypt.org/2025/08/06/ocsp-service-has-reached-end-of-life), making it a reliable test target
    test("if OCSP is unavailable for a domain, the monitor should be UP (because failHard=false)", async ({ page }, testInfo) => {
        await createHttpMonitor(page, { name: "ocsp-unavailable",
            url: "https://stackoverflow.com" });
        await waitForStatus(page, "up");
        await screenshot(testInfo, page);
    });

    test("if ignoreTls=true for a domain, the monitor should be UP (regardless of the certificate status)", async ({ page }, testInfo) => {
        await createHttpMonitor(page, { name: "tls-ignored",
            url: "https://aaacertificateservices.comodoca.com:444",
            ignoreTls: true });
        await waitForStatus(page, "up");
        await screenshot(testInfo, page);
    });
});
