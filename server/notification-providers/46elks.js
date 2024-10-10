const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Elks extends NotificationProvider {
    name = "Elks";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {

            // API credentials
            const username = notification.elksUsername;
            const password = notification.elksAuthToken;
            const authKey = Buffer.from(username + ":" + password).toString("base64");

            // Set the SMS endpoint
            const url = "https://api.46elks.com/a1/sms";

            // Request data object
            let data = {
                from: notification.elksFromNumber,
                to: notification.elksToNumber,
                message: msg
            };

            data = new URLSearchParams(data);
            data = data.toString();

            // Set the headers
            const config = {
                headers: {
                    "Authorization": "Basic " + authKey
                }
            };

            // Send request
            await axios.post(url, data, config);

            return okMsg;
          }
        catch (error) {
                this.throwGeneralAxiosError(error);
        }

    }   

}

module.exports = Elks;
