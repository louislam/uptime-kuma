const jsesc = require("jsesc");
const { escape } = require("html-escaper");

/**
 * Returns a string that represents the javascript that is required to insert the Google Analytics scripts
 * into a webpage.
 * @param {string} tagId Google UA/G/AW/DC Property ID to use with the Google Analytics script.
 * @returns {string} HTML script tags to inject into page
 */
function getGoogleAnalyticsScript(tagId) {
    let escapedTagIdJS = jsesc(tagId, { isScriptContext: true });

    if (escapedTagIdJS) {
        escapedTagIdJS = escapedTagIdJS.trim();
    }

    // Escape the tag ID for use in an HTML attribute.
    let escapedTagIdHTMLAttribute = escape(tagId);

    return `
        <script async src="https://www.googletagmanager.com/gtag/js?id=${escapedTagIdHTMLAttribute}"></script>
        <script>window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date());gtag('config', '${escapedTagIdJS}'); </script>
    `;
}

module.exports = {
    getGoogleAnalyticsScript,
};
