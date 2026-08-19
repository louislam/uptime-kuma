import { expect, test } from "@playwright/test";
import { login, restoreSqliteSnapshot, screenshot } from "../util-test";

/**
 * Logs in and waits for the dashboard shell, so later navigations do not race
 * the redirect login() leaves in flight.
 * @param {import('@playwright/test').Page} page The Playwright page instance.
 * @returns {Promise<void>}
 */
async function loginAndWait(page) {
    await page.goto("./dashboard");
    await login(page);
    await expect(page.getByTestId("monitor-list")).toBeVisible();
}

/**
 * Adds an HTTP monitor and waits for its details page.
 * @param {import('@playwright/test').Page} page The Playwright page instance.
 * @param {string} friendlyName Name to save the monitor under.
 * @returns {Promise<string>} The new monitor's id.
 */
async function addMonitor(page, friendlyName) {
    await page.goto("./add");
    await page.getByTestId("monitor-type-select").selectOption("http");
    await page.getByTestId("friendly-name-input").fill(friendlyName);
    await page.getByTestId("url-input").fill("https://www.example.com/");
    await page.getByTestId("save-button").click();
    await page.waitForURL(/\/dashboard\/\d+/);

    return /\/dashboard\/(\d+)/.exec(page.url())[1];
}

/**
 * Navigates within the app, the path a shared link takes once the app is
 * already loaded. No UI control builds a link carrying filter params today.
 * @param {import('@playwright/test').Page} page The Playwright page instance.
 * @param {string} target Location to navigate to.
 * @returns {Promise<void>}
 */
async function navigateInApp(page, target) {
    await page.evaluate((to) => {
        document.querySelector("#app").__vue_app__.config.globalProperties.$router.push(to);
    }, target);
}

test.describe("Monitor List Filter", () => {
    test.beforeEach(async ({ page }) => {
        await restoreSqliteSnapshot(page);
    });

    test("search is reflected in the URL and survives navigation", async ({ page }, testInfo) => {
        await loginAndWait(page);
        await addMonitor(page, "ReproMonitor");

        const searchInput = page.getByLabel("Search monitored sites");
        await searchInput.fill("Repro");
        await expect(page).toHaveURL(/[?&]search=Repro/);
        await screenshot(testInfo, page);

        // Moving to another page rebuilds the URL from router state, which never
        // holds the filter params. The search must not be lost along the way.
        await expect(page.getByTestId("monitor-list")).toContainText("ReproMonitor");
        await page.getByTestId("monitor-list").getByRole("link").first().click();
        await page.waitForURL(/\/dashboard\/\d+/);

        await expect(searchInput).toHaveValue("Repro");
        await expect(page).toHaveURL(/[?&]search=Repro/);
        await screenshot(testInfo, page);
    });

    test("search is applied from the URL on load", async ({ page }, testInfo) => {
        await loginAndWait(page);
        await addMonitor(page, "ReproMonitor");
        await addMonitor(page, "OtherMonitor");

        await page.goto("./dashboard?search=Repro");

        await expect(page.getByLabel("Search monitored sites")).toHaveValue("Repro");
        await expect(page.getByTestId("monitor-list")).toContainText("ReproMonitor");
        await expect(page.getByTestId("monitor-list")).not.toContainText("OtherMonitor");
        await screenshot(testInfo, page);
    });

    test("a link to a filtered view on another page applies the filter", async ({ page }, testInfo) => {
        await loginAndWait(page);
        const reproId = await addMonitor(page, "ReproMonitor");
        await addMonitor(page, "OtherMonitor");

        await page.goto("./dashboard");

        // The list must already be mounted and unfiltered, otherwise the
        // navigation below is served by its initial read of the URL and this
        // never exercises navigating into a filtered view.
        await expect(page.getByLabel("Search monitored sites")).toHaveValue("");
        await expect(page.getByTestId("monitor-list")).toContainText("OtherMonitor");

        await navigateInApp(page, `/dashboard/${reproId}?search=Repro`);

        await expect(page).toHaveURL(new RegExp(`/dashboard/${reproId}\\?search=Repro`));
        await expect(page.getByLabel("Search monitored sites")).toHaveValue("Repro");
        await expect(page.getByTestId("monitor-list")).toContainText("ReproMonitor");
        await expect(page.getByTestId("monitor-list")).not.toContainText("OtherMonitor");
        await screenshot(testInfo, page);
    });
});
