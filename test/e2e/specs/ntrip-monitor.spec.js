import { expect, test } from "@playwright/test";
import net from "net";
import { login, restoreSqliteSnapshot, screenshot } from "../util-test";
import { buildMsm, buildMetadataMessage } from "../../backend-test/monitors/ntrip-support";

const FRESHNESS_HELP =
    "Arriving observation messages show the stream is flowing, not that the corrections are accurate.";

/**
 * Fill the fields every NTRIP monitor needs.
 * @param {import('@playwright/test').Page} page Playwright page
 * @param {object} options Field values
 * @returns {Promise<void>}
 */
async function fillRequiredFields(page, options = {}) {
    await page.getByTestId("monitor-type-select").selectOption("ntrip");
    await page.getByTestId("friendly-name-input").fill(options.name ?? "RTK base");
    await page.getByTestId("hostname-input").fill(options.hostname ?? "127.0.0.1");
    await page.getByTestId("ntrip-mountpoint-input").fill(options.mountpoint ?? "BASE");

    if (options.port !== undefined) {
        await page.locator("#port").fill(String(options.port));
    }
    if (options.interval !== undefined) {
        await page.locator("#interval").fill(String(options.interval));
    }
}

test.describe("NTRIP monitor form", () => {
    test.beforeEach(async () => {
        await restoreSqliteSnapshot();
    });

    test("offers the type and explains what health means", async ({ page }, testInfo) => {
        await page.goto("./add");
        await login(page);
        await page.getByTestId("monitor-type-select").selectOption("ntrip");

        await expect(page.getByLabel("Mountpoint", { exact: true })).toBeVisible();
        await expect(page.getByText(FRESHNESS_HELP, { exact: true })).toBeVisible();

        // The advertised message families have to be visible before the user
        // points this at a caster, not buried in documentation.
        await expect(page.getByText(/MSM1 to MSM7/)).toBeVisible();
        await expect(page.getByText(/only metadata is reported as down/)).toBeVisible();
        await expect(page.getByText(/Scheduled maintenance disconnects the session/)).toBeVisible();

        await screenshot(testInfo, page);
    });

    test("defaults the port to 2101 and keeps an edited value", async ({ page }) => {
        await page.goto("./add");
        await login(page);
        await page.getByTestId("monitor-type-select").selectOption("ntrip");

        await expect(page.locator("#port")).toHaveValue("2101");

        await page.locator("#port").fill("2102");
        await page.getByTestId("monitor-type-select").selectOption("ntp");
        await page.getByTestId("monitor-type-select").selectOption("ntrip");

        await expect(page.locator("#port")).toHaveValue("2102");
    });

    test("hides NTRIP controls for other monitor types", async ({ page }) => {
        await page.goto("./add");
        await login(page);
        await page.getByTestId("monitor-type-select").selectOption("ntrip");
        await expect(page.getByTestId("ntrip-mountpoint-input")).toBeVisible();

        await page.getByTestId("monitor-type-select").selectOption("http");

        await expect(page.getByTestId("ntrip-mountpoint-input")).toHaveCount(0);
        await expect(page.getByTestId("ntrip-stale-timeout-input")).toHaveCount(0);
        await expect(page.getByText(FRESHNESS_HELP, { exact: true })).toHaveCount(0);
    });

    test("shows fixed-position fields only when GGA is enabled", async ({ page }) => {
        await page.goto("./add");
        await login(page);
        await page.getByTestId("monitor-type-select").selectOption("ntrip");

        await expect(page.getByTestId("ntrip-latitude-input")).toHaveCount(0);

        await page.getByTestId("ntrip-gga-checkbox").check();

        await expect(page.getByTestId("ntrip-latitude-input")).toBeVisible();
        await expect(page.getByTestId("ntrip-longitude-input")).toBeVisible();
        await expect(page.getByTestId("ntrip-altitude-input")).toBeVisible();
        await expect(page.getByTestId("ntrip-gga-interval-input")).toBeVisible();

        await page.getByTestId("ntrip-gga-checkbox").uncheck();

        await expect(page.getByTestId("ntrip-latitude-input")).toHaveCount(0);
    });

    test("keeps the caster password hidden until it is revealed", async ({ page }) => {
        await page.goto("./add");
        await login(page);
        await page.getByTestId("monitor-type-select").selectOption("ntrip");

        const password = page.getByTestId("ntrip-password-input").locator("input");
        await password.fill("hunter2");

        await expect(password).toHaveAttribute("type", "password");

        await page.getByTestId("ntrip-password-input").locator("a").click();

        await expect(password).toHaveAttribute("type", "text");
        await expect(password).toHaveValue("hunter2");
    });

    test("refuses coordinates outside their valid range", async ({ page }) => {
        await page.goto("./add");
        await login(page);
        await fillRequiredFields(page);
        await page.getByTestId("ntrip-gga-checkbox").check();

        await page.getByTestId("ntrip-latitude-input").fill("91");
        await page.getByTestId("ntrip-longitude-input").fill("0");
        await page.getByTestId("ntrip-altitude-input").fill("50");
        await page.getByTestId("save-button").click();

        // The browser blocks the submit, so the form is still open.
        await expect(page.getByTestId("ntrip-latitude-input")).toBeVisible();
        await expect(page).toHaveURL(/\/add$/);
    });

    test("saves and reloads every NTRIP field", async ({ page }) => {
        await page.goto("./add");
        await login(page);
        await fillRequiredFields(page, {
            name: "Full NTRIP",
            hostname: "caster.example",
            port: 2102,
            mountpoint: "RTCM3_MSM",
        });

        await page.getByTestId("ntrip-revision-select").selectOption("1");
        await page.getByTestId("ntrip-tls-checkbox").check();
        await page.getByTestId("ntrip-username-input").fill("rover");
        await page.getByTestId("ntrip-password-input").locator("input").fill("hunter2");
        await page.getByTestId("ntrip-handshake-timeout-input").fill("12");
        await page.getByTestId("ntrip-initial-timeout-input").fill("25");
        await page.getByTestId("ntrip-stale-timeout-input").fill("40");
        await page.getByTestId("ntrip-gga-checkbox").check();
        await page.getByTestId("ntrip-latitude-input").fill("51.4778");
        await page.getByTestId("ntrip-longitude-input").fill("-0.0015");
        await page.getByTestId("ntrip-altitude-input").fill("45.5");
        await page.getByTestId("ntrip-gga-interval-input").fill("15");

        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");

        await page.getByRole("link", { name: "Edit" }).click();
        await page.waitForURL("/edit/*");

        await expect(page.getByTestId("monitor-type-select")).toHaveValue("ntrip");
        await expect(page.getByTestId("hostname-input")).toHaveValue("caster.example");
        await expect(page.locator("#port")).toHaveValue("2102");
        await expect(page.getByTestId("ntrip-mountpoint-input")).toHaveValue("RTCM3_MSM");
        await expect(page.getByTestId("ntrip-revision-select")).toHaveValue("1");
        await expect(page.getByTestId("ntrip-tls-checkbox")).toBeChecked();
        await expect(page.getByTestId("ntrip-username-input")).toHaveValue("rover");
        await expect(page.getByTestId("ntrip-password-input").locator("input")).toHaveValue("hunter2");
        await expect(page.getByTestId("ntrip-handshake-timeout-input")).toHaveValue("12");
        await expect(page.getByTestId("ntrip-initial-timeout-input")).toHaveValue("25");
        await expect(page.getByTestId("ntrip-stale-timeout-input")).toHaveValue("40");
        await expect(page.getByTestId("ntrip-gga-checkbox")).toBeChecked();
        await expect(page.getByTestId("ntrip-latitude-input")).toHaveValue("51.4778");
        await expect(page.getByTestId("ntrip-longitude-input")).toHaveValue("-0.0015");
        await expect(page.getByTestId("ntrip-altitude-input")).toHaveValue("45.5");
        await expect(page.getByTestId("ntrip-gga-interval-input")).toHaveValue("15");
    });

    test("turning GGA off clears the fixed position from the reloaded form", async ({ page }) => {
        await page.goto("./add");
        await login(page);
        await fillRequiredFields(page, { name: "GGA off again" });
        await page.getByTestId("ntrip-gga-checkbox").check();
        await page.getByTestId("ntrip-latitude-input").fill("51.4778");
        await page.getByTestId("ntrip-longitude-input").fill("-0.0015");
        await page.getByTestId("ntrip-altitude-input").fill("45.5");
        await page.getByTestId("save-button").click();
        await page.waitForURL("/dashboard/*");

        await page.getByRole("link", { name: "Edit" }).click();
        await page.waitForURL("/edit/*");
        await page.getByTestId("ntrip-gga-checkbox").uncheck();
        await page.getByTestId("save-button").click();

        // Saving an existing monitor stays on the form, so the round trip is
        // confirmed by the toast and then by a full reload.
        await expect(page.getByText("Saved.")).toBeVisible();
        await page.reload();

        await expect(page.getByTestId("ntrip-gga-checkbox")).not.toBeChecked();
        await expect(page.getByTestId("ntrip-latitude-input")).toHaveCount(0);
    });
});

/**
 * Start a caster on loopback that accepts one client and streams RTCM 3.
 *
 * The frames come from the shared test builder, which packs bits independently
 * of the frame checker under test. Each epoch is the current GPS time of week,
 * so the monitor reports a realistic correction age.
 * @returns {Promise<object>} Handle carrying the port and a close function
 */
async function startMockCaster() {
    let timer = null;

    const server = net.createServer((socket) => {
        socket.once("data", () => {
            socket.write("ICY 200 OK\r\n\r\n");

            // Metadata alone must never establish health, so the stream carries
            // both: the observations are what the monitor is required to notice.
            timer = setInterval(() => {
                // GPS time of week: GPS runs 18 s ahead of UTC, from 1980-01-06.
                const epochMs = (Date.now() + 18000 - 315964800000) % (7 * 24 * 60 * 60 * 1000);
                socket.write(buildMetadataMessage(1005));
                socket.write(
                    buildMsm({
                        messageType: 1074,
                        stationId: 0,
                        epochMs,
                        satellites: [1, 2, 3, 4],
                        signals: [1],
                    })
                );
            }, 1000);
        });

        socket.on("close", () => {
            clearInterval(timer);
            timer = null;
        });
        socket.on("error", () => {});
    });

    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

    return {
        port: server.address().port,
        close: async () => {
            clearInterval(timer);
            await new Promise((resolve) => server.close(resolve));
        },
    };
}

test.describe("NTRIP monitor against a loopback caster", () => {
    test.beforeEach(async () => {
        await restoreSqliteSnapshot();
    });

    test("reaches UP and charts correction age", async ({ page }, testInfo) => {
        test.setTimeout(120000);
        const caster = await startMockCaster();

        try {
            await page.goto("./add");
            await login(page);
            await fillRequiredFields(page, {
                name: "Loopback caster",
                hostname: "127.0.0.1",
                port: caster.port,
                mountpoint: "BASE",
                interval: 20,
            });
            await page.getByTestId("ntrip-revision-select").selectOption("1");
            await page.getByTestId("ntrip-stale-timeout-input").fill("10");
            await page.getByTestId("ntrip-initial-timeout-input").fill("10");
            await page.getByTestId("save-button").click();
            await page.waitForURL("/dashboard/*");

            // The first heartbeat only starts the session, so UP cannot arrive
            // before the second one. That delay is the design, not a flaky wait:
            // the interval is 20 s and the caster streams at 1 Hz throughout.
            await expect(page.getByTestId("monitor-status")).toContainText("Up", { timeout: 60000 });
            await screenshot(testInfo, page);

            // Correction age takes the place of response time.
            await expect(page.getByText("Correction Age", { exact: true })).toBeVisible();
            await expect(page.getByText("Avg. Correction Age", { exact: true })).toBeVisible();
            await expect(page.getByText("Ping", { exact: true })).toHaveCount(0);
            await expect(page.locator(".ping-chart-wrapper")).toBeVisible();
        } finally {
            await caster.close();
        }
    });
});
