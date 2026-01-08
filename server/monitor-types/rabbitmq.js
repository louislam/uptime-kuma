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
            const baseUrl = baseUrls[i];
            const nodeIndex = i + 1;

            try {
                await this.checkSingleNode(monitor, heartbeat, baseUrl, nodeIndex, baseUrls.length);
                // If checkSingleNode succeeds, heartbeat is set to UP and we can return
                return;
            } catch (error) {
                const errorMsg = `Node ${nodeIndex}: ${error.message}`;
                log.warn(this.name, errorMsg);
                errors.push(errorMsg);
            }
        }

        // If we reach here, all nodes failed
        throw new Error(`All ${errors.length} nodes failed because ${errors.join("; ")}`);
    }

    /**
     * Check a single RabbitMQ node
     * @param {object} monitor Monitor configuration
     * @param {object} heartbeat Heartbeat object to update
     * @param {string} baseUrl Base URL of the RabbitMQ node
     * @param {number} nodeIndex Index of the current node (1-based for logging)
     * @param {number} totalNodes Total number of nodes configured
     * @returns {Promise<void>}
     * @throws {Error} If the node check fails
     */
    async checkSingleNode(monitor, heartbeat, baseUrl, nodeIndex, totalNodes) {
        // Without a trailing slash, path in baseUrl will be removed. https://example.com/api -> https://example.com
        let normalizedUrl = baseUrl;
        if (!normalizedUrl.endsWith("/")) {
            normalizedUrl += "/";
        }

        const options = {
            // Do not start with slash, it will strip the trailing slash from baseUrl
            url: new URL("api/health/checks/alarms/", normalizedUrl).href,
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

        log.debug("monitor", `[${monitor.name}] Checking node ${nodeIndex}/${totalNodes}: ${baseUrl}`);

        try {
            const res = await axios.request(options);
            log.debug("monitor", `[${monitor.name}] Axios Response: status=${res.status} body=${JSON.stringify(res.data)}`);

            if (res.status === 200) {
                heartbeat.status = UP;
                heartbeat.msg = "OK";
                log.info("monitor", `[${monitor.name}] Node ${nodeIndex}/${totalNodes} is healthy`);
            } else if (res.status === 503) {
                throw new Error(res.data.reason);
            } else {
                throw new Error(`${res.status} - ${res.statusText}`);
            }
        } catch (error) {
            if (axios.isCancel(error)) {
                throw new Error("Request timed out");
            } else if (error.response) {
                // Re-throw with the original error message if it's already formatted
                throw error;
            } else {
                throw new Error(error.message);
            }
        }
    }
}

module.exports = {
    RabbitMqMonitorType,
};
