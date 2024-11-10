const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class PostRequest extends NotificationProvider {
    name = "PostRequest";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = notification.postrequestURL;

        try {
            let config =  {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + notification.postrequestToken,
                }
            };

            let data = notification.postrequestBody;

            let resp = await axios.post(url, data, config);

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = PostRequest;
