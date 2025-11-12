const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { setting } = require("../util-server");
const { getMonitorRelativeURL } = require("../../src/util");

class Stackfield extends NotificationProvider {
    name = "stackfield";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            // Stackfield message formatting: https://www.stackfield.com/help/formatting-messages-2001

            let textMsg = "+Uptime Kuma Alert+";

            if (monitorJSON && monitorJSON.name) {
                textMsg += `\n*${monitorJSON.name}*`;
            }

            textMsg += `\n${msg}`;

            const baseURL = await setting("primaryBaseURL");
            if (baseURL) {
                textMsg += `\n${baseURL + getMonitorRelativeURL(monitorJSON.id)}`;
            }

            const data = {
                "Title": textMsg,
            };
            let config = this.getAxiosConfigWithProxy({});

            await axios.post(notification.stackfieldwebhookURL, data, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }

    }
}

module.exports = Stackfield;
