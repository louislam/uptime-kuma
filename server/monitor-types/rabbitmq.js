const { MonitorType } = require("./monitor-type");
const { log, UP, DOWN } = require("../../src/util");
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

        heartbeat.status = DOWN;
        for (let baseUrl of baseUrls) {
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
                log.debug("monitor", `[${monitor.name}] Axios Request: ${JSON.stringify(options)}`);
                const res = await axios.request(options);
                log.debug("monitor", `[${monitor.name}] Axios Response: status=${res.status} body=${JSON.stringify(res.data)}`);
                if (res.status === 200) {
                    heartbeat.status = UP;
                    heartbeat.msg = "OK";
                    break;
                } else if (res.status === 503) {
                    heartbeat.msg = res.data.reason;
                } else {
                    heartbeat.msg = `${res.status} - ${res.statusText}`;
                }
            } catch (error) {
                if (axios.isCancel(error)) {
                    heartbeat.msg = "Request timed out";
                    log.debug("monitor", `[${monitor.name}] Request timed out`);
                } else {
                    log.debug("monitor", `[${monitor.name}] Axios Error: ${JSON.stringify(error.message)}`);
                    heartbeat.msg = error.message;
                }
            }
        }
    }
}

module.exports = {
    RabbitMqMonitorType,
};
