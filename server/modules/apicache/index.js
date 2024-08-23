const apicache = require("./apicache");

apicache.options({
    headerBlacklist: [
        "cache-control"
    ],
    headers: {
        // Disable client side cache, only server side cache.
        // BUG! Not working for the second request
        "cache-control": "no-cache",
    },
});

module.exports = apicache;
