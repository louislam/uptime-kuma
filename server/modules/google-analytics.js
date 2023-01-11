let GoogleAnalytics = (() => {
    function getGoogleAnalyticsScript(tagId) {
        return "<script async src=\"https://www.googletagmanager.com/gtag/js?id=" + tagId + "\"></script>" +
            "<script>window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date());gtag('config', '" + tagId + "'); </script>";
    }
    function isValidTag(tagInput) {
        const re = /^\w{1,2}-\d{8}$/g;
        return tagInput.match(re) != null;
    }
    return {
        getGoogleAnalyticsScript: getGoogleAnalyticsScript,
        isValidTag: isValidTag
    };
})();

module.exports = GoogleAnalytics;
