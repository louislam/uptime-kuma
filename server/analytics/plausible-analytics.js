const jsesc = require("jsesc");
const { escape } = require("html-escaper");

/**
 * Returns a string that represents the javascript that is required to insert the Plausible Analytics script
 * into a webpage.
 * @param {string} scriptUrl the Plausible Analytics script url.
 * @param {string} domainsToMonitor Domains to track separated by a ',' to add Plausible Analytics script.
 * @returns {string} HTML script tags to inject into page
 */
function getPlausibleAnalyticsScript(scriptUrl, domainsToMonitor) {
    let escapedScriptUrlJS = jsesc(scriptUrl, { isScriptContext: true });
    let escapedWebsiteIdJS = jsesc(domainsToMonitor, { isScriptContext: true });

    if (escapedScriptUrlJS) {
        escapedScriptUrlJS = escapedScriptUrlJS.trim();
    }

    if (escapedWebsiteIdJS) {
        escapedWebsiteIdJS = escapedWebsiteIdJS.trim();
    }

    // Escape the domain url for use in an HTML attribute.
    let escapedScriptUrlHTMLAttribute = escape(escapedScriptUrlJS);

    // Escape the website id for use in an HTML attribute.
    let escapedWebsiteIdHTMLAttribute = escape(escapedWebsiteIdJS);

    return `
        <script defer src="${escapedScriptUrlHTMLAttribute}" data-domain="${escapedWebsiteIdHTMLAttribute}"></script>
    `;
}

module.exports = {
    getPlausibleAnalyticsScript,
};
