const { log } = require("../../src/util");

/**
 * Formats a value for logging purposes
 * @param {*} v The value to format
 * @returns {string} The formatted string representation
 */
function formatValue(v) {
    if (typeof v === "string") {
        return v;
    }
    if (v instanceof Error) {
        return v.stack || v.message || String(v);
    }
    try {
        return JSON.stringify(v);
    } catch {
        return String(v);
    }
}

module.exports = {
    /**
     * Log sink for `hardened-https-agent` library that will redirect its logs to Kuma's logger system
     */
    kumaBindableLogSink: {
        bind: (component) => {
            const toKumaMsg = (message, args) => {
                if (!args || args.length === 0) {
                    return message;
                }
                const parts = [ message, ...args ].map((v) => formatValue(v));
                return parts.join(" ");
            };

            return {
                debug: (message, ...args) =>
                    log.debug(component, toKumaMsg(message, args)),
                info: (message, ...args) =>
                    log.info(component, toKumaMsg(message, args)),
                warn: (message, ...args) =>
                    log.warn(component, toKumaMsg(message, args)),
                error: (message, ...args) =>
                    log.error(component, toKumaMsg(message, args)),
            };
        },
    },
};
