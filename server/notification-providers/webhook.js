const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const FormData = require("form-data");
const { Liquid } = require("liquidjs");

class Webhook extends NotificationProvider {

    name = "webhook";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

        try {
            let data = {
                heartbeat: heartbeatJSON,
                monitor: monitorJSON,
                msg,
            };
            let config = {
                headers: {}
            };

            if (notification.webhookContentType === "form-data") {
                const formData = new FormData();
                formData.append("data", JSON.stringify(data));
                config.headers = formData.getHeaders();
                data = formData;
            } else if (notification.webhookContentType === "custom") {
                // Initialize LiquidJS and parse the custom Body Template
                const engine = new Liquid();
                const tpl = engine.parse(notification.webhookCustomBody);

                // Insert templated values into Body
                data = await engine.render(tpl,
                    {
                        msg,
                        heartbeatJSON,
                        monitorJSON
                    });
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

            await axios.post(notification.webhookURL, data, config);
            return okMsg;

        } catch (error) {
            this.throwGeneralAxiosError(error);
        }

    }

}

module.exports = Webhook;
