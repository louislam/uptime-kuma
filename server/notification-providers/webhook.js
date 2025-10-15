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
            // Default to POST for backward compatibility
            const httpMethod = notification.httpMethod || "post";

            let data = {
                heartbeat: heartbeatJSON,
                monitor: monitorJSON,
                msg,
            };
            let config = {
                headers: {}
            };

            // For GET requests, we'll send data as query parameters
            if (httpMethod.toLowerCase() === "get") {
                // Prepare query parameters
                config.params = {
                    msg: msg
                };

                // Add heartbeat data if available
                if (heartbeatJSON) {
                    config.params.heartbeat = JSON.stringify(heartbeatJSON);
                }

                // Add monitor data if available
                if (monitorJSON) {
                    config.params.monitor = JSON.stringify(monitorJSON);
                }

                // Additional headers can still be added for GET requests
                if (notification.webhookAdditionalHeaders) {
                    try {
                        config.headers = {
                            ...config.headers,
                            ...JSON.parse(notification.webhookAdditionalHeaders)
                        };
                    } catch (err) {
                        throw "Additional Headers is not a valid JSON";
                    }
                }

                config = this.getAxiosConfigWithProxy(config);
                await axios.get(notification.webhookURL, config);
                return okMsg;

            } else {
                // POST request logic (original behavior)
                if (notification.webhookContentType === "form-data") {
                    const formData = new FormData();
                    formData.append("data", JSON.stringify(data));
                    config.headers = formData.getHeaders();
                    data = formData;
                } else if (notification.webhookContentType === "custom") {
                    data = await this.renderTemplate(notification.webhookCustomBody, msg, monitorJSON, heartbeatJSON);
                }

                if (notification.webhookAdditionalHeaders) {
                    try {
                        config.headers = {
                            ...config.headers,
                            ...JSON.parse(notification.webhookAdditionalHeaders)
                        };
                    } catch (err) {
                        throw "Additional Headers is not a valid JSON";
                    }
                }

                config = this.getAxiosConfigWithProxy(config);
                await axios.post(notification.webhookURL, data, config);
                return okMsg;
            }

        } catch (error) {
            this.throwGeneralAxiosError(error);
        }

    }

}

module.exports = Webhook;
