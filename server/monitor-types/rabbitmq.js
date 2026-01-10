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
                await this.checkSingleNode(monitor, baseUrl, `${nodeIndex}/${baseUrls.length}`);
                // If checkSingleNode succeeds (doesn't throw), set heartbeat to UP
                heartbeat.status = UP;
                heartbeat.msg =
                    baseUrls.length === 1
                        ? "Node is reachable and there are no alerts in the cluster"
                        : `One of the ${baseUrls.length} nodes is reachable and there are no alerts in the cluster`;
                return;
            } catch (error) {
                log.warn(this.name, `Node ${nodeIndex}: ${error.message}`);
                errors.push(`Node ${nodeIndex}: ${error.message}`);
            }
        }

        // If we reach here, all nodes failed
        throw new Error(`All ${errors.length} nodes failed because ${errors.join("; ")}`);
    }

    /**
     * Check a single RabbitMQ node
     * @param {object} monitor Monitor configuration
     * @param {string} baseUrl Base URL of the RabbitMQ node
     * @param {string} nodeInfo Node index info for logging (e.g., "1/3")
     * @returns {Promise<void>}
     * @throws {Error} If the node check fails
     */
    async checkSingleNode(monitor, baseUrl, nodeInfo) {
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
                Accept: "application/json",
                Authorization:
                    "Basic " +
                    Buffer.from(`${monitor.rabbitmqUsername || ""}:${monitor.rabbitmqPassword || ""}`).toString(
                        "base64"
                    ),
            },
            signal: axiosAbortSignal((monitor.timeout + 10) * 1000),
            // Capture reason for 503 status
            validateStatus: (status) => status === 200 || status === 503,
        };

        log.debug("monitor", `[${monitor.name}] Checking node ${nodeInfo}: ${baseUrl}`);

        try {
            const res = await axios.request(options);
            log.debug(
                "monitor",
                `[${monitor.name}] Axios Response: status=${res.status} body=${JSON.stringify(res.data)}`
            );

            if (res.status === 200) {
                log.debug("monitor", `[${monitor.name}] Node ${nodeInfo} is healthy`);
                // Success - return without error
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
