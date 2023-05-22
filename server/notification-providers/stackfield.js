const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { setting } = require("../util-server");
const { getMonitorRelativeURL } = require("../../src/util");

class Stackfield extends NotificationProvider {

    name = "stackfield";

    async send(notification, msg, monitorJSON = null) {
        let okMsg = "Sent Successfully.";
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

            await axios.post(notification.stackfieldwebhookURL, data);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }

    }
}

module.exports = Stackfield;
