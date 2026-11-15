const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class OpsiMate extends NotificationProvider {
    name = "OpsiMate";

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
                    "x-api-token": notification.opsimateAPIToken,
                    "content-type": "application/json",
                },
            };

            let url = notification.opsimateURL;

            if (url.endsWith("/")) {
                url = url.slice(0, -1);
            }

            let webhookURL = url + "/api/v1/alerts/custom/uptimekuma";

            config = this.getAxiosConfigWithProxy(config);

            await axios.post(webhookURL, data, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = OpsiMate;
