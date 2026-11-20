const { BeanModel } = require("redbean-node/dist/bean-model");
const zlib = require("node:zlib");
const { promisify } = require("node:util");
const brotliDecompress = promisify(zlib.brotliDecompress);

/**
 * Classify a probe failure without exposing its original message.
 * @param {string|null} message Internal heartbeat message
 * @returns {string|number|null} Fixed reason code or HTTP error status
 */
function publicFailureReason(message) {
    if (/\b(?:ENOTFOUND|EAI_AGAIN|ENODATA)\b/.test(message)) {
        return "dns";
    }
    if (/\b(?:ETIMEDOUT|ESOCKETTIMEDOUT|ECONNABORTED)\b|^timeout of \d+ms exceeded$/i.test(message)) {
        return "timeout";
    }
    const status = /^Request failed with status code ([45]\d{2})\b/.exec(message);
    return status ? Number(status[1]) : null;
}

/**
 * status:
 *      0 = DOWN
 *      1 = UP
 *      2 = PENDING
 *      3 = MAINTENANCE
 */
class Heartbeat extends BeanModel {
    /**
     * Return an object that ready to parse to JSON for public
     * Only show necessary data to public
     * @returns {object} Object ready to parse
     */
    toPublicJSON() {
        return {
            status: this.status,
            time: this.time,
            msg: "", // Hide for public
            ...(this.status === 0 ? { failureReason: publicFailureReason(this.msg) } : {}),
            ping: this.ping,
        };
    }

    /**
     * Return an object that ready to parse to JSON
     * @returns {object} Object ready to parse
     */
    toJSON() {
        return {
            monitorID: this._monitorId,
            status: this._status,
            time: this._time,
            msg: this._msg,
            ping: this._ping,
            important: this._important,
            duration: this._duration,
            retries: this._retries,
            response: this._response,
        };
    }

    /**
     * Return an object that ready to parse to JSON
     * @param {{ decodeResponse?: boolean }} opts Options for JSON serialization
     * @returns {Promise<object>} Object ready to parse
     */
    async toJSONAsync(opts) {
        return {
            monitorID: this._monitorId,
            status: this._status,
            time: this._time,
            msg: this._msg,
            ping: this._ping,
            important: this._important,
            duration: this._duration,
            retries: this._retries,
            response: opts?.decodeResponse ? await Heartbeat.decodeResponseValue(this._response) : undefined,
        };
    }

    /**
     * Decode compressed response payload stored in database.
     * @param {string|null} response Encoded response payload.
     * @returns {string|null} Decoded response payload.
     */
    static async decodeResponseValue(response) {
        if (!response) {
            return response;
        }

        try {
            // Offload brotli decode from main event loop to libuv thread pool
            return (await brotliDecompress(Buffer.from(response, "base64"))).toString("utf8");
        } catch (error) {
            return response;
        }
    }
}

module.exports = Heartbeat;
