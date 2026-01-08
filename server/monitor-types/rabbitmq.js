const { MonitorType } = require("./monitor-type");
const { log, UP } = require("../../src/util");
const { axiosAbortSignal } = require("../util-server");
const axios = require("axios");

class RabbitMqMonitorType extends MonitorType {
    name = "rabbitmq";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, server) {
        let baseUrls = [];
        try {
            baseUrls = JSON.parse(monitor.rabbitmqNodes);
        } catch (error) {
            throw new Error("Invalid RabbitMQ Nodes");
        }

        if (baseUrls.length === 0) {
            throw new Error("No RabbitMQ nodes configured");
        }

        const errors = [];

        for (let i = 0; i < baseUrls.length; i++) {
            let baseUrl = baseUrls[i];
            try {
                // Without a trailing slash, path in baseUrl will be removed. https://example.com/api -> https://example.com
                if ( !baseUrl.endsWith("/") ) {
                    baseUrl += "/";
                }
                const options = {
                    // Do not start with slash, it will strip the trailing slash from baseUrl
                    url: new URL("api/health/checks/alarms/", baseUrl).href,
                    method: "get",
                    timeout: monitor.timeout * 1000,
                    headers: {
                        "Accept": "application/json",
                        "Authorization": "Basic " + Buffer.from(`${monitor.rabbitmqUsername || ""}:${monitor.rabbitmqPassword || ""}`).toString("base64"),
                    },
                    signal: axiosAbortSignal((monitor.timeout + 10) * 1000),
                    // Capture reason for 503 status
                    validateStatus: (status) => status === 200 || status === 503,
                };
                log.debug("monitor", `[${monitor.name}] Checking node ${i + 1}/${baseUrls.length}: ${baseUrl}`);
                const res = await axios.request(options);
                log.debug("monitor", `[${monitor.name}] Axios Response: status=${res.status} body=${JSON.stringify(res.data)}`);
                if (res.status === 200) {
                    heartbeat.status = UP;
                    heartbeat.msg = "OK";
                    log.info("monitor", `[${monitor.name}] Node ${i + 1}/${baseUrls.length} is healthy`);
                    return;
                } else if (res.status === 503) {
                    const errorMsg = `Node ${i + 1}: ${res.data.reason}`;
                    log.warn("monitor", `[${monitor.name}] ${errorMsg}`);
                    errors.push(errorMsg);
                } else {
                    const errorMsg = `Node ${i + 1}: ${res.status} - ${res.statusText}`;
                    log.warn("monitor", `[${monitor.name}] ${errorMsg}`);
                    errors.push(errorMsg);
                }
            } catch (error) {
                if (axios.isCancel(error)) {
                    const errorMsg = `Node ${i + 1}: Request timed out`;
                    log.warn("monitor", `[${monitor.name}] ${errorMsg}`);
                    errors.push(errorMsg);
                } else {
                    const errorMsg = `Node ${i + 1}: ${error.message}`;
                    log.warn("monitor", `[${monitor.name}] ${errorMsg}`);
                    errors.push(errorMsg);
                }
            }
        }

        // If we reach here, all nodes failed
        const consolidatedError = errors.length > 1 
            ? `All ${errors.length} nodes failed: ${errors.join("; ")}`
            : errors[0] || "All RabbitMQ nodes are unavailable";
        log.error("monitor", `[${monitor.name}] ${consolidatedError}`);
        throw new Error(consolidatedError);
    }
}

module.exports = {
    RabbitMqMonitorType,
};
