const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class Flowtriq extends NotificationProvider {
    name = "Flowtriq";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let status = "info";
            let monitorName = monitorJSON?.name || "Unknown";

            if (heartbeatJSON != null) {
                if (heartbeatJSON.status === DOWN) {
                    status = "down";
                } else if (heartbeatJSON.status === UP) {
                    status = "up";
                }
            }

            let data = {
                source: "uptime-kuma",
                status: status,
                monitor: monitorName,
                msg: msg,
            };

            if (heartbeatJSON) {
                data.heartbeat = {
                    status: heartbeatJSON.status,
                    time: heartbeatJSON.time,
                    ping: heartbeatJSON.ping,
                    msg: heartbeatJSON.msg,
                    timezone: heartbeatJSON.timezone,
                };
            }

            if (monitorJSON) {
                data.monitorInfo = {
                    id: monitorJSON.id,
                    name: monitorJSON.name,
                    type: monitorJSON.type,
                    url: monitorJSON.url,
                    hostname: monitorJSON.hostname,
                    port: monitorJSON.port,
                };
            }

            let headers = {
                "Content-Type": "application/json",
            };

            if (notification.flowtriqApiKey) {
                headers["X-API-Key"] = notification.flowtriqApiKey;
            }

            let config = this.getAxiosConfigWithProxy({
                headers: headers,
            });

            let result = await axios.post(notification.flowtriqWebhookUrl, data, config);

            if (result.status < 200 || result.status >= 300) {
                throw new Error("Flowtriq notification failed with status code " + result.status);
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Flowtriq;
