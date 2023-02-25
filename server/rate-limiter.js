const { RateLimiter } = require("limiter");
const { log } = require("../src/util");

class KumaRateLimiter {
    /**
     * @param {Object} config Rate limiter configuration object
     */
    constructor(config) {
        this.errorMessage = config.errorMessage;
        this.rateLimiter = new RateLimiter(config);
    }

    /**
     * Callback for pass
     * @callback passCB
     * @param {Object} err Too many requests
     */

    /**
     * Should the request be passed through
     * @param {passCB} callback
     * @param {number} [num=1] Number of tokens to remove
     * @returns {Promise<boolean>}
     */
    async pass(callback, num = 1) {
        const remainingRequests = await this.removeTokens(num);
        log.info("rate-limit", "remaining requests: " + remainingRequests);
        if (remainingRequests < 0) {
            if (callback) {
                callback({
                    ok: false,
                    msg: this.errorMessage,
                });
            }
            return false;
        }
        return true;
    }

    /**
     * Remove a given number of tokens
     * @param {number} [num=1] Number of tokens to remove
     * @returns {Promise<number>}
     */
    async removeTokens(num = 1) {
        return await this.rateLimiter.removeTokens(num);
    }
}

const loginRateLimiter = new KumaRateLimiter({
    tokensPerInterval: 20,
    interval: "minute",
    fireImmediately: true,
    errorMessage: "Too frequently, try again later."
});

const twoFaRateLimiter = new KumaRateLimiter({
    tokensPerInterval: 30,
    interval: "minute",
    fireImmediately: true,
    errorMessage: "Too frequently, try again later."
});

module.exports = {
    loginRateLimiter,
    twoFaRateLimiter,
};
