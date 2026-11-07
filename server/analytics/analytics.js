const cheerio = require("cheerio");
const googleAnalytics = require("./google-analytics");
const umamiAnalytics = require("./umami-analytics");
const plausibleAnalytics = require("./plausible-analytics");
const matomoAnalytics = require("./matomo-analytics");
const rybbitAnalytics = require("./rybbit-analytics");

/**
 * Returns a string that represents the javascript that is required to insert the selected Analytics' script
 * into a webpage.
 * @param {typeof import("../model/status_page").StatusPage} statusPage Status page populate HTML with
 * @returns {string} HTML script tags to inject into page
 */
function getAnalyticsScript(statusPage) {
    switch (statusPage.analyticsType) {
        case "google":
            return googleAnalytics.getGoogleAnalyticsScript(statusPage.analyticsId);
        case "umami":
            return umamiAnalytics.getUmamiAnalyticsScript(statusPage.analyticsScriptUrl, statusPage.analyticsId);
        case "plausible":
            return plausibleAnalytics.getPlausibleAnalyticsScript(
                statusPage.analyticsScriptUrl,
                statusPage.analyticsId
            );
        case "matomo":
            return matomoAnalytics.getMatomoAnalyticsScript(statusPage.analyticsScriptUrl, statusPage.analyticsId);
        case "rybbit":
            return rybbitAnalytics.getRybbitAnalyticsScript(statusPage.analyticsScriptUrl, statusPage.analyticsId);
        default:
            return null;
    }
}

/**
 * Function that checks wether the selected analytics has been configured properly
 * @param {typeof import("../model/status_page").StatusPage} statusPage Status page populate HTML with
 * @returns {boolean} Boolean defining if the analytics config is valid
 */
function isValidAnalyticsConfig(statusPage) {
    switch (statusPage.analyticsType) {
        case "google":
            return statusPage.analyticsId != null;
        case "umami":
        case "plausible":
        case "matomo":
        case "rybbit":
            return statusPage.analyticsId != null && statusPage.analyticsScriptUrl != null;
        default:
            return false;
    }
}

/**
 * Disables the given analytics script tags so the browser does not execute them
 * until the visitor gives consent. The frontend re-creates them after consent.
 * @param {string} html HTML script tags returned by getAnalyticsScript()
 * @returns {string} The same tags with type="text/plain" and a consent marker
 */
function deferUntilConsent(html) {
    const $ = cheerio.load(html, null, false);

    $("script").each((_, element) => {
        const script = $(element);
        const originalType = script.attr("type");

        if (originalType) {
            script.attr("data-original-type", originalType);
        }

        script.attr("type", "text/plain");
        script.attr("data-uk-consent", "analytics");
    });

    return $.html();
}

module.exports = {
    getAnalyticsScript,
    isValidAnalyticsConfig,
    deferUntilConsent,
};
