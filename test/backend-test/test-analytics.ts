import { describe, test } from "node:test";
import assert from "node:assert";
import analytics from "../../server/analytics/analytics";

describe("Status page analytics", () => {
    describe("getAnalyticsScript()", () => {
        test("returns the Google tag script for google analytics", () => {
            const html = analytics.getAnalyticsScript({
                analyticsType: "google",
                analyticsId: "G-ABC123",
            });

            assert.match(html, /googletagmanager\.com\/gtag\/js\?id=G-ABC123/);
            assert.match(html, /gtag\('config', 'G-ABC123'\)/);
        });

        test("escapes a script-closing payload in the google tag id", () => {
            const html = analytics.getAnalyticsScript({
                analyticsType: "google",
                analyticsId: "</script><script>alert(1)</script>",
            });

            assert.ok(!html.includes("</script><script>alert(1)</script>"));
        });

        test("returns the Matomo script with tracker url and site id", () => {
            const html = analytics.getAnalyticsScript({
                analyticsType: "matomo",
                analyticsScriptUrl: "matomo.example.com",
                analyticsId: "7",
            });

            assert.match(html, /var u="\/\/matomo\.example\.com\/"/);
            assert.match(html, /setSiteId', 7/);
        });

        test("returns the Plausible script with script url and domain", () => {
            const html = analytics.getAnalyticsScript({
                analyticsType: "plausible",
                analyticsScriptUrl: "https://plausible.io/js/script.js",
                analyticsId: "example.com",
            });

            assert.match(html, /src="https:\/\/plausible\.io\/js\/script\.js"/);
            assert.match(html, /data-domain="example\.com"/);
        });

        test("returns the Umami script with script url and website id", () => {
            const html = analytics.getAnalyticsScript({
                analyticsType: "umami",
                analyticsScriptUrl: "https://umami.example.com/script.js",
                analyticsId: "website-1",
            });

            assert.match(html, /src="https:\/\/umami\.example\.com\/script\.js"/);
            assert.match(html, /data-website-id="website-1"/);
        });

        test("returns the Rybbit script with script url and site id", () => {
            const html = analytics.getAnalyticsScript({
                analyticsType: "rybbit",
                analyticsScriptUrl: "https://rybbit.example.com/script.js",
                analyticsId: "site-1",
            });

            assert.match(html, /src="https:\/\/rybbit\.example\.com\/script\.js"/);
            assert.match(html, /data-site-id="site-1"/);
        });

        test("returns null for an unknown analytics type", () => {
            assert.strictEqual(analytics.getAnalyticsScript({ analyticsType: "unknown" }), null);
        });
    });

    describe("isValidAnalyticsConfig()", () => {
        test("accepts google analytics with only an id", () => {
            assert.strictEqual(analytics.isValidAnalyticsConfig({ analyticsType: "google", analyticsId: "G-1" }), true);
        });

        test("rejects google analytics without an id", () => {
            assert.strictEqual(analytics.isValidAnalyticsConfig({ analyticsType: "google" }), false);
        });

        test("accepts umami with both url and id", () => {
            assert.strictEqual(
                analytics.isValidAnalyticsConfig({
                    analyticsType: "umami",
                    analyticsScriptUrl: "https://umami.example.com/script.js",
                    analyticsId: "id",
                }),
                true
            );
        });

        test("rejects umami without a script url", () => {
            assert.strictEqual(analytics.isValidAnalyticsConfig({ analyticsType: "umami", analyticsId: "id" }), false);
        });

        test("rejects matomo without a site id", () => {
            assert.strictEqual(
                analytics.isValidAnalyticsConfig({
                    analyticsType: "matomo",
                    analyticsScriptUrl: "matomo.example.com",
                }),
                false
            );
        });

        test("rejects an unknown analytics type", () => {
            assert.strictEqual(analytics.isValidAnalyticsConfig({ analyticsType: "unknown" }), false);
        });
    });
});
