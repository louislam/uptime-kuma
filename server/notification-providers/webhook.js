const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const FormData = require("form-data");

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
                // First try rendering with the original unescaped message
                const rendered = await this.renderTemplate(notification.webhookCustomBody, msg, monitorJSON, heartbeatJSON);
                
                try {
                    data = JSON.parse(rendered);
                } catch (_) {
                    // If parsing fails, it might be due to unescaped special characters in a JSON template (Issue #3778).
                    // Let's escape them and try rendering again.
                    const escapedMsg = msg
                        ? msg.replace(/\\/g, "\\\\")
                             .replace(/"/g, "\\\"")
                             .replace(/\n/g, "\\n")
                             .replace(/\r/g, "\\r")
                             .replace(/\t/g, "\\t")
                        : msg;
                    
                    const renderedEscaped = await this.renderTemplate(notification.webhookCustomBody, escapedMsg, monitorJSON, heartbeatJSON);
                    
                    try {
                        // If it successfully parses now, it was indeed a JSON payload
                        data = JSON.parse(renderedEscaped);
                    } catch (__) {
                        // If it still fails, it's likely meant to be plain text or another format
                        data = rendered;
                    }
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
