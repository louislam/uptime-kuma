const { BeanModel } = require("redbean-node/dist/bean-model");
const zlib = require("node:zlib");
const { promisify } = require("node:util");
const brotliDecompress = promisify(zlib.brotliDecompress);

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
            response: Heartbeat.decodeResponseValueSync(this._response),
            responseHeaders: Heartbeat.decodeResponseHeaders(this._responseHeaders),
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
            responseHeaders: opts?.decodeResponse ? Heartbeat.decodeResponseHeaders(this._responseHeaders) : undefined,
        };
    }

    /**
     * Decode compressed response payload stored in database (sync).
     * @param {string|null} response Encoded response payload.
     * @returns {string|null} Decoded response payload.
     */
    static decodeResponseValueSync(response) {
        if (!response) {
            return response;
        }

        try {
            return zlib.brotliDecompressSync(Buffer.from(response, "base64")).toString("utf8");
        } catch (error) {
            return response;
        }
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

    /**
     * Decode base64-encoded response headers stored in database.
     * @param {string|null} headers Encoded headers payload.
     * @returns {object|null} Decoded headers object, or null if absent/invalid.
     */
    static decodeResponseHeaders(headers) {
        if (!headers) {
            return null;
        }
        try {
            return JSON.parse(Buffer.from(headers, "base64").toString("utf8"));
        } catch (error) {
            return null;
        }
    }
}

module.exports = Heartbeat;
