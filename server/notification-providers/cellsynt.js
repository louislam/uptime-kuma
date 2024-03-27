const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Cellsynt extends NotificationProvider {
    name = "Cellsynt";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        let data = {
            /**
             * You can find more information about the API here: https://www.cellsynt.com/en/sms/api-integration
             */
            params: {
                "username": notification.cellsyntLogin,
                "password": notification.cellsyntPassword,
                "destination": notification.cellsyntDestination,
                "text": msg.replace(/[^\x00-\x7F]/g, ""),
                "originatortype": notification.cellsyntOriginatortype,
                "originator": notification.cellsyntOriginator,
                "allowconcat": notification.cellsyntAllowLongSMS ? 6 : 1
            }
        };
        
        try {
            if (heartbeatJSON != null) {
                data.params.text = msg.replace(/[^\x00-\x7F]/g, "");
            }
            const resp = await axios.post("https://se-1.cellsynt.net/sms.php", null, data);
            if (resp.data == null || resp.data.includes("Error")) {
                throw new Error(resp.data);
            } else {
                return okMsg;
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Cellsynt;
