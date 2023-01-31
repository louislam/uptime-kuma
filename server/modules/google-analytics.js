/**
 * Returns a string that represents the javascript that is required to insert the Google Analytics scripts
 * into a webpage.
 * @param tagId Google UA/G/AW/DC Property ID to use with the Google Analytics script.
 * @returns {string}
 */
function getGoogleAnalyticsScript(tagId) {
    return "<script async src=\"https://www.googletagmanager.com/gtag/js?id=" + tagId + "\"></script>" +
        "<script>window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date());gtag('config', '" + tagId + "'); </script>";
}

module.exports = {
    getGoogleAnalyticsScript,
};
