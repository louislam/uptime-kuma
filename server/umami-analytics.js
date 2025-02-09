const jsesc = require("jsesc");
const { escape } = require("html-escaper");

/**
 * Returns a string that represents the javascript that is required to insert the Umami Analytics script
 * into a webpage.
 * @param {string} domainUrl Domain name with tld to use with the Umami Analytics script.
 * @param {string} websiteId Website ID to use with the Umami Analytics script.
 * @returns {string} HTML script tags to inject into page
 */
function getUmamiAnalyticsScript(domainUrl, websiteId) {
    let escapedDomainUrlJS = jsesc(domainUrl, { isScriptContext: true });
    let escapedWebsiteIdJS = jsesc(websiteId, { isScriptContext: true });

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
        <script defer src="https://${escapedDomainUrlHTMLAttribute}/script.js" data-website-id="${escapedWebsiteIdHTMLAttribute}"></script>
    `;
}

module.exports = {
    getUmamiAnalyticsScript,
};
