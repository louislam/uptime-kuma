let GoogleAnalytics = (() => {
    function getGoogleAnalyticsScript(tagId) {
        return "<script async src=\"https://www.googletagmanager.com/gtag/js?id=" + tagId + "\"></script>" +
            "<script>window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date());gtag('config', '" + tagId + "'); </script>";
    }
    return {
        getGoogleAnalyticsScript: getGoogleAnalyticsScript
    };
})();

module.exports = GoogleAnalytics;
