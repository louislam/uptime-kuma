process.env.UPTIME_KUMA_HIDE_LOG = ["info_db", "info_server"].join(",");

const { describe, test, mock, before, after } = require("node:test");
const assert = require("node:assert");
const TestDB = require("../mock-testdb");
const { Settings } = require("../../server/settings");
const StatusPage = require("../../server/model/status_page");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const {
    STATUS_PAGE_ALL_UP,
    STATUS_PAGE_ALL_DOWN,
    STATUS_PAGE_PARTIAL_DOWN,
    STATUS_PAGE_MAINTENANCE,
} = require("../../src/util");

dayjs.extend(utc);

describe("StatusPage", () => {
    describe("getStatusDescription()", () => {
        test("returns 'No Services' when status is -1", () => {
            const description = StatusPage.getStatusDescription(-1);
            assert.strictEqual(description, "No Services");
        });

        test("returns 'All Systems Operational' when all services are up", () => {
            const description = StatusPage.getStatusDescription(STATUS_PAGE_ALL_UP);
            assert.strictEqual(description, "All Systems Operational");
        });

        test("returns 'Partially Degraded Service' when some services are down", () => {
            const description = StatusPage.getStatusDescription(STATUS_PAGE_PARTIAL_DOWN);
            assert.strictEqual(description, "Partially Degraded Service");
        });

        test("returns 'Degraded Service' when all services are down", () => {
            const description = StatusPage.getStatusDescription(STATUS_PAGE_ALL_DOWN);
            assert.strictEqual(description, "Degraded Service");
        });

        test("returns 'Under maintenance' when status page is in maintenance", () => {
            const description = StatusPage.getStatusDescription(STATUS_PAGE_MAINTENANCE);
            assert.strictEqual(description, "Under maintenance");
        });

        test("returns '?' for unknown status values", () => {
            const description = StatusPage.getStatusDescription(999);
            assert.strictEqual(description, "?");
        });
    });

    // Contract: model READS snake columns (post-mirror-removal); toJSON
    // OUTPUT keys stay camel because that's what the frontend and the
    // /api/status-page consumers depend on. A regression here silently
    // breaks the analytics block (see fix(analytics) — server/analytics
    // reads `statusPage.analytics_*` directly off the loaded instance).
    describe("toJSON / toPublicJSON contract — DB round-trip", () => {
        const testDb = new TestDB("./data/test-status-page-contract");

        before(() => testDb.create());
        after(() => {
            Settings.stopCacheCleaner();
            return testDb.destroy();
        });

        test("round-trip preserves snake source + camelCase JSON output", async () => {
            const inserted = await StatusPage.query().insert({
                slug: "test-contract",
                title: "Contract test",
                description: "x",
                icon: "/icon.svg",
                theme: "auto",
                published: true,
                show_tags: true,
                custom_css: "body { background: pink }",
                footer_text: "© test",
                show_powered_by: false,
                auto_refresh_interval: 30,
                analytics_id: "G-12345",
                analytics_type: "google",
                analytics_script_url: null,
                show_certificate_expiry: true,
                show_only_last_heartbeat: false,
                rss_title: "rss-title",
            });
            const reloaded = await StatusPage.query().findById(inserted.id);

            // Source side reads the snake columns.
            assert.strictEqual(reloaded.analytics_id, "G-12345");
            assert.strictEqual(reloaded.analytics_type, "google");
            assert.strictEqual(reloaded.auto_refresh_interval, 30);
            assert.strictEqual(reloaded.custom_css, "body { background: pink }");
            // ...and there are no camel aliases anymore.
            assert.strictEqual(reloaded.analyticsId, undefined);
            assert.strictEqual(reloaded.autoRefreshInterval, undefined);
            assert.strictEqual(reloaded.customCSS, undefined);

            // Output JSON keys are still camelCase — frontend contract.
            const json = await reloaded.toJSON();
            assert.strictEqual(json.analyticsId, "G-12345");
            assert.strictEqual(json.analyticsType, "google");
            assert.strictEqual(json.autoRefreshInterval, 30);
            assert.strictEqual(json.customCSS, "body { background: pink }");
            assert.strictEqual(json.footerText, "© test");
            assert.strictEqual(json.showTags, true);
            assert.strictEqual(json.showPoweredBy, false);
            assert.strictEqual(json.showCertificateExpiry, true);
            assert.strictEqual(json.showOnlyLastHeartbeat, false);
            assert.strictEqual(json.rssTitle, "rss-title");

            // Public JSON omits the id and exposes the same camel keys.
            const publicJson = await reloaded.toPublicJSON();
            assert.strictEqual(publicJson.id, undefined, "id must not leak to public payload");
            assert.strictEqual(publicJson.analyticsId, "G-12345");
            assert.strictEqual(publicJson.analyticsScriptUrl, null);
            assert.strictEqual(publicJson.customCSS, "body { background: pink }");
        });

        test("Analytics dispatcher resolves the script for a hydrated StatusPage", async () => {
            // Real regression: dispatcher takes the loaded model directly,
            // so it MUST read the snake columns. Anything else regresses
            // to a silently empty <head>.
            const { getAnalyticsScript, isValidAnalyticsConfig } = require("../../server/analytics/analytics");

            const inserted = await StatusPage.query().insert({
                slug: "test-analytics-resolve",
                title: "Analytics resolve",
                description: "",
                icon: "/icon.svg",
                theme: "auto",
                published: true,
                show_tags: false,
                custom_css: "",
                footer_text: "",
                show_powered_by: false,
                auto_refresh_interval: 0,
                analytics_id: "G-RESOLVE",
                analytics_type: "google",
                analytics_script_url: null,
                show_certificate_expiry: false,
                show_only_last_heartbeat: false,
                rss_title: "",
            });
            const reloaded = await StatusPage.query().findById(inserted.id);

            assert.strictEqual(isValidAnalyticsConfig(reloaded), true);
            const html = getAnalyticsScript(reloaded);
            assert.ok(html, "analytics script must be non-null for a configured google StatusPage");
            assert.match(html, /G-RESOLVE/);
        });
    });

    describe("renderRSS()", () => {
        const MOCK_FEED_URL = "http://localhost:3001/status/test";

        test("pubDate uses UTC timezone for heartbeat.time without timezone info", async () => {
            const mockStatusPage = {
                title: "Test Status Page",
            };

            const mockHeartbeats = [
                {
                    name: "Test Monitor",
                    monitorID: 1,
                    time: "2026-01-24 13:16:25.400",
                },
            ];

            mock.method(StatusPage, "getRSSPageData", async () => ({
                heartbeats: mockHeartbeats,
                statusDescription: "All Systems Operational",
            }));

            try {
                const rss = await StatusPage.renderRSS(mockStatusPage, MOCK_FEED_URL);

                assert.ok(rss.includes("<pubDate>Sat, 24 Jan 2026 13:16:25 GMT</pubDate>"));
            } finally {
                mock.restoreAll();
            }
        });
    });
});
