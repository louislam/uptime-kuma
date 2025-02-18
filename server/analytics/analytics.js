const googleAnalytics = require("./google-analytics");
const umamiAnalytics = require("./umami-analytics");
const plausibleAnalytics = require("./plausible-analytics");

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
            return umamiAnalytics.getUmamiAnalyticsScript(statusPage.analyticsDomainUrl, statusPage.analyticsId);
        case "plausible":
            return plausibleAnalytics.getPlausibleAnalyticsScript(statusPage.analyticsDomainUrl, statusPage.analyticsId);
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
            return statusPage.analyticsId != null && statusPage.analyticsDomainUrl != null;
        default:
            return false;
    }
}

module.exports = {
    getAnalyticsScript,
    isValidAnalyticsConfig
};
