const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const FormData = require("form-data");
const { Liquid } = require("liquidjs");

class Webhook extends NotificationProvider {
    name = "webhook";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let data = {
                heartbeat: heartbeatJSON,
                monitor: monitorJSON,
                msg,
            };
            let config = {
                headers: {}
            };
            let url = notification.webhookURL;

            if (notification.webhookContentType === "form-data") {
                const formData = new FormData();
                formData.append("data", JSON.stringify(data));
                config.headers = formData.getHeaders();
                data = formData;
            } else if (notification.webhookContentType === "custom") {

                console.log(msg);
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
            }else if(notification.webhookContentType === "CompletlyCustom"){

                if(msg.includes("Down")){
                    const tpl = JSON.parse(notification.webhookCustomBodyDown);
                    // Insert templated values into Body
                    data = tpl;
                    url = notification.webhookURLDown;

                    if (notification.webhookAdditionalHeaders) {
                        try {
                            config.headers = {
                                ...config.headers,
                                ...JSON.parse(notification.webhookAdditionalHeadersDown)
                            };
                        } catch (err) {
                            throw "Additional Headers is not a valid JSON";
                        }
                    }
                }else {
                    const tpl = JSON.parse(notification.webhookCustomBodyUp);
                    // Insert templated values into Body
                    data = tpl;
                    url = notification.webhookURLUp;

                    if (notification.webhookAdditionalHeaders) {
                        try {
                            config.headers = {
                                ...config.headers,
                                ...JSON.parse(notification.webhookAdditionalHeadersUp)
                            };
                        } catch (err) {
                            throw "Additional Headers is not a valid JSON";
                        }
                    }
                }
            }

            if (notification.webhookAdditionalHeaders && notification.webhookContentType != "CompletlyCustom") {
                try {
                    config.headers = {
                        ...config.headers,
                        ...JSON.parse(notification.webhookAdditionalHeaders)
                    };
                } catch (err) {
                    throw "Additional Headers is not a valid JSON";
                }
            }

            await axios.post(url, data, config);
            return okMsg;

        } catch (error) {
            this.throwGeneralAxiosError(error);
        }

    }

}

module.exports = Webhook;
