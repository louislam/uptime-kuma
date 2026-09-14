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

    test("filter params that cannot be used are dropped", async ({ page }, testInfo) => {
        await loginAndWait(page);
        await addMonitor(page, "ReproMonitor");
        await addMonitor(page, "OtherMonitor");

        // status=9 is outside the status enum and tags= is empty: neither can filter
        // anything, so they must be ignored rather than emptying the list, and must
        // not be written back into the URL where they could be shared again.
        await page.goto("./dashboard?status=9&tags=&search=Repro");

        await expect(page.getByLabel("Search monitored sites")).toHaveValue("Repro");
        await expect(page.getByTestId("monitor-list")).toContainText("ReproMonitor");
        await expect(page.getByTestId("monitor-list")).not.toContainText("OtherMonitor");
        await expect(page).toHaveURL(/\/dashboard\?search=Repro$/);
        await screenshot(testInfo, page);

        // Same URL with nothing usable left in it at all. This leaves the filters
        // untouched rather than changing them, so the write has to happen on the
        // strength of the read alone, or the junk stays in the address bar.
        await page.goto("./dashboard?status=9");

        await expect(page.getByTestId("monitor-list")).toContainText("ReproMonitor");
        await expect(page.getByTestId("monitor-list")).toContainText("OtherMonitor");
        await expect(page).toHaveURL(/\/dashboard$/);
        await screenshot(testInfo, page);
    });

    test("search survives back and forward", async ({ page }, testInfo) => {
        await loginAndWait(page);
        await addMonitor(page, "ReproMonitor");

        await page.goto("./dashboard");
        const searchInput = page.getByLabel("Search monitored sites");
        await searchInput.fill("Repro");
        await expect(page).toHaveURL(/[?&]search=Repro/);

        await page.getByTestId("monitor-list").getByRole("link").first().click();
        await page.waitForURL(/\/dashboard\/\d+\?search=Repro/);

        // Change the search here, so this history entry and the one behind it hold
        // different filters. The list itself never unmounts, so this is the only way
        // back/forward can disagree with component state - and the only case that
        // actually proves the URL is being read back rather than merely re-asserted.
        await searchInput.fill("Other");
        await expect(page).toHaveURL(/\/dashboard\/\d+\?search=Other/);

        await page.goBack();
        await expect(page).toHaveURL(/\/dashboard\?search=Repro/);
        await expect(searchInput).toHaveValue("Repro");

        await page.goForward();
        await expect(page).toHaveURL(/\/dashboard\/\d+\?search=Other/);
        await expect(searchInput).toHaveValue("Other");
        await screenshot(testInfo, page);
    });

    test("a filter set in the UI round-trips through the URL", async ({ page }, testInfo) => {
        await loginAndWait(page);
        await addMonitor(page, "ReproMonitor");

        await page.goto("./dashboard");
        await expect(page.getByTestId("monitor-list")).toContainText("ReproMonitor");

        // Filters reach the URL through a different watcher than the search text.
        // Nothing is paused, so filtering by Paused empties the list.
        const pausedOption = page
            .locator(".filter-dropdown-menu")
            .first()
            .locator(".dropdown-item")
            .filter({ hasText: "Paused" });

        await page.locator(".filter-dropdown-status").first().click();
        await pausedOption.click();

        await expect(page).toHaveURL(/[?&]active=false/);
        await expect(page.getByTestId("monitor-list")).not.toContainText("ReproMonitor");
        await screenshot(testInfo, page);

        // Turning the filter back off has to take the param out of the URL again,
        // otherwise an unfiltered view stays shareable as a filtered one.
        await pausedOption.click();

        await expect(page).toHaveURL(/\/dashboard$/);
        await expect(page.getByTestId("monitor-list")).toContainText("ReproMonitor");
        await screenshot(testInfo, page);
    });

    test("a valid filter param survives being loaded directly", async ({ page }, testInfo) => {
        await loginAndWait(page);
        await addMonitor(page, "ReproMonitor");

        // The kiosk case from the issue: a link opened straight into a filtered view.
        // Reading the URL now rewrites it, so a valid param has to round-trip intact
        // rather than being normalised away.
        await page.goto("./dashboard?active=true");

        await expect(page.getByTestId("monitor-list")).toContainText("ReproMonitor");
        await expect(page).toHaveURL(/\/dashboard\?active=true$/);
        await screenshot(testInfo, page);
    });
});
