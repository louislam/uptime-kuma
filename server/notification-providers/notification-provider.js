const { Liquid, Drop } = require("liquidjs");
const zlib = require("node:zlib");
const { promisify } = require("node:util");
const { DOWN } = require("../../src/util");
const { HttpProxyAgent } = require("http-proxy-agent");
const { HttpsProxyAgent } = require("https-proxy-agent");

const brotliDecompress = promisify(zlib.brotliDecompress);

/**
 * LiquidJS Drop for heartbeats.
 *
 * Exposes the stored HTTP response (which is compressed in the DB) to templates
 * as both a string (`request`) and parsed JSON (`requestJSON`), cached so templates
 * don't need to deal with compression or repeated JSON.parse.
 *
 * Also forwards existing heartbeat fields (status, msg, time, etc.) so
 * `heartbeatJSON` behaves like the original object with a few extra helpers.
 *
 * See https://liquidjs.com/tutorials/drops.html
 */
class HeartbeatDrop extends Drop {
    /**
     * @param {object} heartbeat Original heartbeat JSON (including `response` as stored in DB).
     */
    constructor(heartbeat) {
        super();
        this._heartbeat = heartbeat || {};
        this._decoded = undefined;
        this._parsed = undefined;
    }

    /**
     * Decode compressed response payload (base64 + brotli). Used by request() and by tests.
     * @param {string|null} response Encoded response payload.
     * @returns {Promise<string|null>} Decoded response payload.
     */
    static async decodeResponseValue(response) {
        if (!response) {
            return response;
        }
        try {
            return (await brotliDecompress(Buffer.from(response, "base64"))).toString("utf8");
        } catch (error) {
            return response;
        }
    }

    /**
     * Decoded response body. Cached after first call.
     * @returns {Promise<string>} Decoded response body.
     */
    async request() {
        if (this._decoded !== undefined) {
            return this._decoded;
        }
        this._decoded = await HeartbeatDrop.decodeResponseValue(this._heartbeat.response);
        return this._decoded ?? "";
    }

    /**
     * Response body as JSON. Uses request() and caches the result.
     * @returns {Promise<object|null>} Parsed JSON object or null on failure.
     */
    async requestJSON() {
        if (this._parsed !== undefined) {
            return this._parsed;
        }
        const decoded = await this.request();
        try {
            this._parsed = decoded ? JSON.parse(decoded) : null;
        } catch (e) {
            this._parsed = null;
        }
        return this._parsed;
    }

    /**
     * LiquidJS calls this for property names the Drop doesn't have; we return the value from the heartbeat.
     * @param {string} key Property name (e.g. status, msg, time).
     * @returns {*} Value from the heartbeat, or undefined.
     */
    liquidMethodMissing(key) {
        return this._heartbeat[key];
    }

    /**
     * When the Drop is used as a value, return heartbeat fields plus request and requestJSON so they can be accessed.
     * @returns {object} Heartbeat fields plus request and requestJSON.
     */
    valueOf() {
        return Object.assign({}, this._heartbeat, {
            request: this.request.bind(this),
            requestJSON: this.requestJSON.bind(this),
        });
    }

    /**
     * So {{ heartbeatJSON | json }} outputs a flat dict with heartbeat fields + request + requestJSON (no _heartbeat).
     * JSON.stringify calls this; request/requestJSON use cached values if already accessed.
     * @returns {object} Plain object for JSON serialization.
     */
    toJSON() {
        return Object.assign({}, this._heartbeat, {
            request: this._decoded ?? null,
            requestJSON: this._parsed ?? null,
        });
    }
}

class NotificationProvider {
    /**
     * Notification Provider Name
     * @type {string}
     */
    name = undefined;

    /**
     * Send a notification
     * @param {BeanModel} notification Notification to send
     * @param {string} msg General Message
     * @param {?object} monitorJSON Monitor details (For Up/Down only)
     * @param {?object} heartbeatJSON Heartbeat details (For Up/Down only)
     * @returns {Promise<string>} Return Successful Message
     * @throws Error with fail msg
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        throw new Error("Have to override Notification.send(...)");
    }

    /**
     * Extracts the address from a monitor JSON object based on its type.
     * @param {?object} monitorJSON Monitor details (For Up/Down only)
     * @returns {string} The extracted address based on the monitor type.
     */
    extractAddress(monitorJSON) {
        if (!monitorJSON) {
            return "";
        }
        switch (monitorJSON["type"]) {
            case "push":
                return "Heartbeat";
            case "ping":
                return monitorJSON["hostname"];
            case "port":
            case "dns":
            case "gamedig":
            case "steam":
                if (monitorJSON["port"]) {
                    return monitorJSON["hostname"] + ":" + monitorJSON["port"];
                }
                return monitorJSON["hostname"];
            case "globalping":
                switch (monitorJSON["subtype"]) {
                    case "ping":
                        return monitorJSON["hostname"];
                    case "http":
                        return monitorJSON["url"];
                    default:
                        return "";
                }
            default:
                if (!["https://", "http://", ""].includes(monitorJSON["url"])) {
                    return monitorJSON["url"];
                }
                return "";
        }
    }

    /**
     * Renders a message template with notification context
     * @param {string} template the template
     * @param {string} msg the message that will be included in the context
     * @param {?object} monitorJSON Monitor details (For Up/Down/Cert-Expiry only)
     * @param {?object} heartbeatJSON Heartbeat details (For Up/Down only)
     * @returns {Promise<string>} rendered template
     */
    async renderTemplate(template, msg, monitorJSON, heartbeatJSON) {
        const engine = new Liquid({
            root: "./no-such-directory-uptime-kuma",
            relativeReference: false,
            dynamicPartials: false,
        });
        const parsedTpl = engine.parse(template);

        // Let's start with dummy values to simplify code
        let monitorName = "Monitor Name not available";
        let monitorHostnameOrURL = "testing.hostname";

        if (monitorJSON !== null) {
            monitorName = monitorJSON["name"];
            monitorHostnameOrURL = this.extractAddress(monitorJSON);
        }

        let serviceStatus = "⚠️ Test";
        if (heartbeatJSON !== null) {
            serviceStatus = heartbeatJSON["status"] === DOWN ? "🔴 Down" : "✅ Up";
        }

        // Drop exposes request(), requestJSON(), and heartbeat fields via liquidMethodMissing.
        let contextHeartbeatJSON = heartbeatJSON;
        if (heartbeatJSON !== null) {
            contextHeartbeatJSON = new HeartbeatDrop(heartbeatJSON);
        }

        const context = {
            // for v1 compatibility, to be removed in v3
            STATUS: serviceStatus,
            NAME: monitorName,
            HOSTNAME_OR_URL: monitorHostnameOrURL,

            // variables which are officially supported
            status: serviceStatus,
            name: monitorName,
            hostnameOrURL: monitorHostnameOrURL,
            monitorJSON,
            heartbeatJSON: contextHeartbeatJSON,
            msg,
        };

        return engine.render(parsedTpl, context);
    }

    /**
     * Throws an error
     * @param {any} error The error to throw
     * @returns {void}
     * @throws {any} The error specified
     */
    throwGeneralAxiosError(error) {
        let msg = error && error.message ? error.message : String(error);

        if (error && error.code) {
            msg += ` (code=${error.code})`;
        }

        if (error && error.response && error.response.status) {
            msg += ` (HTTP ${error.response.status}${error.response.statusText ? " " + error.response.statusText : ""})`;
        }

        if (error && error.response && error.response.data) {
            if (typeof error.response.data === "string") {
                msg += " " + error.response.data;
            } else {
                try {
                    msg += " " + JSON.stringify(error.response.data);
                } catch (e) {
                    msg += " " + String(error.response.data);
                }
            }
        }

        // Expand AggregateError to show underlying causes
        let agg = null;
        if (error && error.name === "AggregateError" && Array.isArray(error.errors)) {
            agg = error;
        } else if (error && error.cause && error.cause.name === "AggregateError" && Array.isArray(error.cause.errors)) {
            agg = error.cause;
        }

        if (agg) {
            let causes = agg.errors
                .map((e) => {
                    let m = e && e.message ? e.message : String(e);
                    if (e && e.code) {
                        m += ` (code=${e.code})`;
                    }
                    return m;
                })
                .join("; ");
            msg += " - caused by: " + causes;
        } else if (error && error.cause && error.cause.message) {
            msg += " - cause: " + error.cause.message;
        }

        throw new Error(msg);
    }

    /**
     * Returns axios config with proxy agent if proxy env is set.
     * @param {object} axiosConfig - Axios config containing params
     * @returns {object} Axios config
     */
    getAxiosConfigWithProxy(axiosConfig = {}) {
        const proxyEnv = process.env.notification_proxy || process.env.NOTIFICATION_PROXY;
        if (proxyEnv) {
            const proxyUrl = new URL(proxyEnv);

            if (proxyUrl.protocol === "http:") {
                axiosConfig.httpAgent = new HttpProxyAgent(proxyEnv);
                axiosConfig.httpsAgent = new HttpsProxyAgent(proxyEnv);
            } else if (proxyUrl.protocol === "https:") {
                const agent = new HttpsProxyAgent(proxyEnv);
                axiosConfig.httpAgent = agent;
                axiosConfig.httpsAgent = agent;
            }

            axiosConfig.proxy = false;
        }
        return axiosConfig;
    }
}

module.exports = NotificationProvider;
module.exports.HeartbeatDrop = HeartbeatDrop;