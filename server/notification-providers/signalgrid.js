const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class Signalgrid extends NotificationProvider {
    name = "signalgrid";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        let type = "INFO";
        let title = "Uptime Kuma";

        if (heartbeatJSON) {
            if (heartbeatJSON.status === DOWN) {
                type = "CRIT";
                title = `${monitorJSON.name} Down`;
            } else if (heartbeatJSON.status === UP) {
                type = "SUCCESS";
                title = `${monitorJSON.name} Up`;
            }
        }

        try {
            const config = this.getAxiosConfigWithProxy({});
            const data = new URLSearchParams();

            data.append("client_key", notification.signalgridClientKey);
            data.append("channel", notification.signalgridChannel);
            data.append("title", title);
            data.append("body", msg);
            data.append("type", type);
            data.append("critical", "false");

            const response = await axios.post("https://api.signalgrid.co/v1/push", data, config);

            if (response.data?.code && String(response.data.code) !== "200") {
                throw new Error(response.data.text || "Signalgrid API request failed");
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Signalgrid;
