// Unit tests for the analytics layer.
//
// Pinned by a real bug from the BaseModel snake↔camel mirror removal:
// `server/analytics/analytics.js` was reading `statusPage.analyticsType`
// (camel alias) which became undefined on a hydrated StatusPage instance.
// `getAnalyticsScript()` then always took the `default` branch and the
// status page rendered without a tracking script. The e2e suite caught
// it via a 60s `waitForFunction` timeout — these unit tests catch it
// in milliseconds.

process.env.UPTIME_KUMA_HIDE_LOG = ["info_db", "info_server"].join(",");

const { describe, test } = require("node:test");
const assert = require("node:assert/strict");

const { getAnalyticsScript, isValidAnalyticsConfig } = require("../../server/analytics/analytics");
const { getGoogleAnalyticsScript } = require("../../server/analytics/google-analytics");
const { getUmamiAnalyticsScript } = require("../../server/analytics/umami-analytics");
const { getPlausibleAnalyticsScript } = require("../../server/analytics/plausible-analytics");
const { getMatomoAnalyticsScript } = require("../../server/analytics/matomo-analytics");

/**
 * Build a hydrated-StatusPage-shaped object using the snake_case column
 * names — i.e. what the model surfaces after the snake↔camel mirror was
 * removed.
 * @param {object} fields Snake-case column overrides
 * @returns {object} Stub StatusPage
 */
function snakeStatusPage(fields) {
    return Object.assign({
        analytics_type: null,
        analytics_id: null,
        analytics_script_url: null,
    }, fields);
}

describe("analytics dispatcher (server/analytics/analytics.js)", () => {
    test("getAnalyticsScript reads snake_case columns for Google", () => {
        const statusPage = snakeStatusPage({
            analytics_type: "google",
            analytics_id: "G-TEST123",
        });
        const html = getAnalyticsScript(statusPage);
        assert.ok(html, "expected non-null script for google analytics");
        assert.match(html, /googletagmanager\.com\/gtag\/js\?id=/);
        assert.match(html, /G-TEST123/);
    });

    test("getAnalyticsScript reads snake_case columns for Umami", () => {
        const statusPage = snakeStatusPage({
            analytics_type: "umami",
            analytics_id: "umami-website-id",
            analytics_script_url: "https://umami.example.com/script.js",
        });
        const html = getAnalyticsScript(statusPage);
        assert.ok(html);
        assert.match(html, /umami\.example\.com\/script\.js/);
        assert.match(html, /umami-website-id/);
    });

    test("getAnalyticsScript reads snake_case columns for Plausible", () => {
        const statusPage = snakeStatusPage({
            analytics_type: "plausible",
            analytics_id: "example.com",
            analytics_script_url: "https://plausible.io/js/script.js",
        });
        const html = getAnalyticsScript(statusPage);
        assert.ok(html);
        assert.match(html, /plausible\.io\/js\/script\.js/);
        assert.match(html, /example\.com/);
    });

    test("getAnalyticsScript reads snake_case columns for Matomo", () => {
        const statusPage = snakeStatusPage({
            analytics_type: "matomo",
            analytics_id: "1",
            analytics_script_url: "https://matomo.example.com/",
        });
        const html = getAnalyticsScript(statusPage);
        assert.ok(html);
        assert.match(html, /matomo\.example\.com/);
    });

    test("getAnalyticsScript returns null when type is unset / unknown", () => {
        assert.strictEqual(getAnalyticsScript(snakeStatusPage()), null);
        assert.strictEqual(
            getAnalyticsScript(snakeStatusPage({ analytics_type: "not-a-real-provider" })),
            null
        );
    });

    test("getAnalyticsScript returns null when camelCase aliases are used (regression)", () => {
        // This is exactly the shape that broke production: a StatusPage
        // instance with the old camelCase aliases populated but the
        // snake_case columns missing. After the mirror removal the
        // dispatcher must NOT silently succeed off the camel keys.
        const aliasOnly = {
            analyticsType: "google",
            analyticsId: "G-TEST123",
        };
        assert.strictEqual(
            getAnalyticsScript(aliasOnly),
            null,
            "dispatcher must read snake_case, not camelCase"
        );
    });

    test("isValidAnalyticsConfig honours the snake_case columns", () => {
        assert.strictEqual(isValidAnalyticsConfig(snakeStatusPage()), false);
        assert.strictEqual(
            isValidAnalyticsConfig(snakeStatusPage({ analytics_type: "google" })),
            false,
            "google requires analytics_id"
        );
        assert.strictEqual(
            isValidAnalyticsConfig(snakeStatusPage({ analytics_type: "google",
                analytics_id: "G-1" })),
            true
        );
        assert.strictEqual(
            isValidAnalyticsConfig(
                snakeStatusPage({ analytics_type: "umami",
                    analytics_id: "x" })
            ),
            false,
            "umami requires analytics_script_url too"
        );
        assert.strictEqual(
            isValidAnalyticsConfig(
                snakeStatusPage({
                    analytics_type: "umami",
                    analytics_id: "x",
                    analytics_script_url: "https://u.example/s.js",
                })
            ),
            true
        );
    });
});

describe("analytics providers — script-tag smoke tests", () => {
    test("google emits an async script with the right id", () => {
        const html = getGoogleAnalyticsScript("G-XYZ");
        assert.match(html, /<script\s+async\s+src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-XYZ"/);
        assert.match(html, /gtag\('config', 'G-XYZ'\)/);
    });

    test("umami emits a defer script with the website id", () => {
        const html = getUmamiAnalyticsScript("https://umami.example/script.js", "umami-id");
        assert.match(html, /<script[^>]*data-website-id="umami-id"/);
        assert.match(html, /https:\/\/umami\.example\/script\.js/);
    });

    test("plausible emits a defer script with the data-domain", () => {
        const html = getPlausibleAnalyticsScript("https://plausible.io/js/script.js", "example.com");
        assert.match(html, /<script[^>]*data-domain="example\.com"/);
        assert.match(html, /https:\/\/plausible\.io\/js\/script\.js/);
    });

    test("matomo emits a script that pushes the site id and Matomo URL", () => {
        const html = getMatomoAnalyticsScript("matomo.example.com", "5");
        assert.match(html, /matomo\.example\.com/);
        assert.match(html, /'setSiteId',\s*5/);
    });
});
