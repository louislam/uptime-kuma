/**
 * Returns true if the tag conforms to the format of 1-2 Letters followed by a dash and 8 numbers.
 * This should take care of the following property tag formats:
 * UA-########, G-########, AW-########, DC-########
 * @param {String} tagInput Google UA/G/AW/DC Property ID
 * @returns {boolean}
 */
function isValidTag(tagInput) {
    const re = /^\w{1,2}-\d{8}$/g;
    return tagInput.match(re) != null;
}

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
    isValidTag,
};
