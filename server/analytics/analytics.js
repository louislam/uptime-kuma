const googleAnalytics = require("./google-analytics");
const umamiAnalytics = require("./umami-analytics");
const plausibleAnalytics = require("./plausible-analytics");
const matomoAnalytics = require("./matomo-analytics");

/**
 * Returns a string that represents the javascript that is required to insert the selected Analytics' script
 * into a webpage.
 * @param {typeof import("../model/status_page").StatusPage} statusPage Status page populate HTML with
 * @returns {string} HTML script tags to inject into page
 */
function getAnalyticsScript(statusPage) {
    switch (statusPage.analytics_type) {
        case "google":
            return googleAnalytics.getGoogleAnalyticsScript(statusPage.analytics_id);
        case "umami":
            return umamiAnalytics.getUmamiAnalyticsScript(statusPage.analytics_script_url, statusPage.analytics_id);
        case "plausible":
            return plausibleAnalytics.getPlausibleAnalyticsScript(
                statusPage.analytics_script_url,
                statusPage.analytics_id
            );
        case "matomo":
            return matomoAnalytics.getMatomoAnalyticsScript(statusPage.analytics_script_url, statusPage.analytics_id);
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
    switch (statusPage.analytics_type) {
        case "google":
            return statusPage.analytics_id != null;
        case "umami":
        case "plausible":
        case "matomo":
            return statusPage.analytics_id != null && statusPage.analytics_script_url != null;
        default:
            return false;
    }
}

module.exports = {
    getAnalyticsScript,
    isValidAnalyticsConfig,
};
