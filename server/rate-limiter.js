const { RateLimiter } = require("limiter");
const { debug } = require("../src/util");

class KumaRateLimiter {
    constructor(config) {
        this.errorMessage = config.errorMessage;
        this.rateLimiter = new RateLimiter(config);
    }

    async pass(callback, num = 1) {
        const remainingRequests = await this.removeTokens(num);
        debug("Rate Limit (remainingRequests):" + remainingRequests);
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
