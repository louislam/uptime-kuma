const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Cellsynt extends NotificationProvider {
    name = "Cellsynt";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const data = {
            // docs at https://www.cellsynt.com/en/sms/api-integration
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
            let config = this.getAxiosConfigWithProxy(data);
            const resp = await axios.post("https://se-1.cellsynt.net/sms.php", null, config);
            if (resp.data == null ) {
                throw new Error("Could not connect to Cellsynt, please try again.");
            } else if (resp.data.includes("Error:")) {
                resp.data = resp.data.replaceAll("Error:", "");
                throw new Error(resp.data);
            }
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Cellsynt;
