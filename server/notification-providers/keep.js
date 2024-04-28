const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const FormData = require("form-data");

class Keep extends NotificationProvider {
    name = "Keep";

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
                headers: {
                    "x-api-key": notification.webhookAPIKey,
                },
            };

            const formData = new FormData();
            formData.append("data", JSON.stringify(data));
            config.headers = formData.getHeaders();
            data = formData;

            let url = notification.webhookURL

            if (url.endsWith("/")) {
                url = url.slice(0, -1);
            }

            let webhookURL = url + "/alert/events/uptimekuma";

            await axios.post(webhookURL, data, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Keep;
