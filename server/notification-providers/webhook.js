const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const FormData = require("form-data");

/**
 * Escape a string for safe embedding inside a JSON string value.
 * Handles newlines, tabs, backslashes, and double quotes.
 * @param {string} str input
 * @returns {string} escaped string
 */
function jsonEscape(str) {
    if (typeof str !== "string") {
        return str;
    }
    return str
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");
}

class Webhook extends NotificationProvider {
    name = "webhook";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            const httpMethod = notification.httpMethod?.toLowerCase() || "post";

            let data = {
                heartbeat: heartbeatJSON,
                monitor: monitorJSON,
                msg,
            };
            let config = {
                headers: {},
            };

            if (httpMethod === "get") {
                config.params = {
                    msg: msg,
                };

                if (heartbeatJSON) {
                    config.params.heartbeat = JSON.stringify(heartbeatJSON);
                }

                if (monitorJSON) {
                    config.params.monitor = JSON.stringify(monitorJSON);
                }
            } else if (notification.webhookContentType === "form-data") {
                const formData = new FormData();
                formData.append("data", JSON.stringify(data));
                config.headers = formData.getHeaders();
                data = formData;
            } else if (notification.webhookContentType === "custom") {
                // Escape msg for safe embedding in JSON templates (#3778)
                const escapedMsg = jsonEscape(msg);
                data = await this.renderTemplate(notification.webhookCustomBody, escapedMsg, monitorJSON, heartbeatJSON);
                try {
                    // Parse to object so axios serializes it correctly
                    data = JSON.parse(data);
                } catch (e) {
                    // Not JSON — send as-is without axios transforming it
                    config.transformRequest = [ (d) => d ];
                }
            }

            if (notification.webhookAdditionalHeaders) {
                try {
                    config.headers = {
                        ...config.headers,
                        ...JSON.parse(notification.webhookAdditionalHeaders),
                    };
                } catch (err) {
                    throw new Error("Additional Headers is not a valid JSON");
                }
            }

            config = this.getAxiosConfigWithProxy(config);

            if (httpMethod === "get") {
                await axios.get(notification.webhookURL, config);
            } else {
                await axios.post(notification.webhookURL, data, config);
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Webhook;
