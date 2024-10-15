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
        // HTTP basic auth
        let basicAuthHeader = {};
        basicAuthHeader = {
            "Authorization": "Basic " + this.encodeBase64(monitor.rabbitmqUsername, monitor.rabbitmqPassword),
        };

        let status = DOWN;
        let msg = "";

        for (const baseUrl of JSON.parse(monitor.rabbitmqNodes)) {
            try {
                const options = {
                    url: new URL("/api/health/checks/alarms", baseUrl).href,
                    method: "get",
                    timeout: monitor.timeout * 1000,
                    headers: {
                        "Accept": "application/json",
                        ...(basicAuthHeader),
                    },
                    signal: axiosAbortSignal((monitor.timeout + 10) * 1000),
                    validateStatus: () => true,
                };
                log.debug("monitor", `[${monitor.name}] Axios Request: ${JSON.stringify(options)}`);
                const res = await axios.request(options);
                log.debug("monitor", `[${monitor.name}] Axios Response: status=${res.status} body=${JSON.stringify(res.data)}`);
                if (res.status === 200) {
                    status = UP;
                    msg = "OK";
                    break;
                } else {
                    msg = `${res.status} - ${res.statusText}`;
                }
            } catch (error) {
                if (axios.isCancel(error)) {
                    msg = "Request timed out";
                    log.debug("monitor", `[${monitor.name}] Request timed out`);
                } else {
                    log.debug("monitor", `[${monitor.name}] Axios Error: ${JSON.stringify(error.message)}`);
                    msg = error.message;
                }
            }
        }

        heartbeat.msg = msg;
        heartbeat.status = status;
    }

    /**
     * Encode user and password to Base64 encoding
     * for HTTP "basic" auth, as per RFC-7617
     * @param {string|null} user - The username (nullable if not changed by a user)
     * @param {string|null} pass - The password (nullable if not changed by a user)
     * @returns {string} Encoded Base64 string
     */
    encodeBase64(user, pass) {
        return Buffer.from(`${user || ""}:${pass || ""}`).toString("base64");
    }
}

module.exports = {
    RabbitMqMonitorType,
};
