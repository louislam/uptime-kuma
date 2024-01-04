const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Whapi extends NotificationProvider {

    name = "whapi";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {

        let okMsg = "Sent Successfully.";

        let apiUrl = notification.whapiApiUrl;
        let apiToken = notification.whapiAuthToken;
        let toNumber = notification.whapiToNumber;

        try {

            let config = {
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + apiToken,
                }
            };

            let data = {
                "to": toNumber + "@s.whatsapp.net",
                "body": msg,
            };

            let url = apiUrl + "/messages/text";

            await axios.post(url, data, config);

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

}

module.exports = Whapi;
