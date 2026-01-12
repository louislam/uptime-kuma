const { BeanModel } = require("redbean-node/dist/bean-model");
const zlib = require("node:zlib");

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
            response: Heartbeat.decodeResponseValue(this._response),
        };
    }

    /**
     * Decode compressed response payload stored in database.
     * @param {string|null} response Encoded response payload.
     * @returns {string|null} Decoded response payload.
     */
    static decodeResponseValue(response) {
        if (!response) {
            return response;
        }

        try {
            return zlib.gunzipSync(Buffer.from(response, "base64")).toString("utf8");
        } catch (error) {
            return response;
        }
    }
}

module.exports = Heartbeat;
