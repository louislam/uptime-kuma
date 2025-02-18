const jsesc = require("jsesc");
const { escape } = require("html-escaper");

/**
 * Returns a string that represents the javascript that is required to insert the Plausible Analytics script
 * into a webpage.
 * @param {string} plausibleDomainUrl Domain name with tld to use with the Plausible Analytics script.
 * @param {string} domainsToMonitor Domains to track seperated by a ',' to add Plausible Analytics script.
 * @returns {string} HTML script tags to inject into page
 */
function getPlausibleAnalyticsScript(plausibleDomainUrl, domainsToMonitor) {
    let escapedDomainUrlJS = jsesc(plausibleDomainUrl, { isScriptContext: true });
    let escapedWebsiteIdJS = jsesc(domainsToMonitor, { isScriptContext: true });

    if (escapedDomainUrlJS) {
        escapedDomainUrlJS = escapedDomainUrlJS.trim();
    }

    if (escapedWebsiteIdJS) {
        escapedWebsiteIdJS = escapedWebsiteIdJS.trim();
    }

    // Escape the domain url for use in an HTML attribute.
    let escapedDomainUrlHTMLAttribute = escape(escapedDomainUrlJS);

    // Escape the website id for use in an HTML attribute.
    let escapedWebsiteIdHTMLAttribute = escape(escapedWebsiteIdJS);

    return `
        <script defer src="https://${escapedDomainUrlHTMLAttribute}/js/script.js" data-domain="${escapedWebsiteIdHTMLAttribute}"></script>
    `;
}

module.exports = {
    getPlausibleAnalyticsScript
};
