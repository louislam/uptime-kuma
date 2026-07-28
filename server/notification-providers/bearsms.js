const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class BearSMS extends NotificationProvider {
    name = "bearsms";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            const params = new URLSearchParams({
                app: "ws",
                u: notification.bearsmsUsername,
                h: notification.bearsmsHashKey,
                op: "pv",
                to: notification.bearsmsPhoneNumber,
                msg: msg,
            });

            const url = `https://app.bearsms.com/index.php?${params.toString()}`;
            let config = this.getAxiosConfigWithProxy({});
            const response = await axios.get(url, config);

            return response.data || okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = BearSMS;
