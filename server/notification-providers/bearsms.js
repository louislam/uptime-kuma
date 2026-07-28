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

            if (notification.bearsmsSenderId) {
                params.append("from", notification.bearsmsSenderId);
            }

            // Non-GSM text (e.g. Hebrew) must be flagged as unicode
            if (/[^\x00-\x7F]/.test(msg)) {
                params.append("unicode", "1");
            }

            const url = `https://app.bearsms.com/index.php?${params.toString()}`;
            let config = this.getAxiosConfigWithProxy({});
            const response = await axios.get(url, config);

            // BearSMS responds with HTTP 200 even on failure, e.g.
            // {"status":"ERR","error":"100","error_string":"authentication failed"}
            if (response.data?.status !== "OK") {
                throw new Error(response.data?.error_string || JSON.stringify(response.data));
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = BearSMS;
