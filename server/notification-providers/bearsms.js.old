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
            // BearSMS rejects messages containing emoji (astral characters) with error 200
            const cleanMsg = msg.replaceAll("🔴 ", "").replaceAll("✅ ", "");
            const params = new URLSearchParams({
                app: "ws",
                u: notification.bearsmsUsername,
                h: notification.bearsmsHashKey,
                op: "pv",
                to: notification.bearsmsPhoneNumber,
                msg: cleanMsg,
            });

            if (notification.bearsmsSenderId) {
                params.append("from", notification.bearsmsSenderId);
            }

            // Non-GSM text (e.g. Hebrew) must be flagged as unicode
            if (/[^\x00-\x7F]/.test(cleanMsg)) {
                params.append("unicode", "1");
            }

            const url = `https://app.bearsms.com/index.php?${params.toString()}`;
            let config = this.getAxiosConfigWithProxy({});
            const response = await axios.get(url, config);

            // BearSMS responds with HTTP 200 even on failure.
            // Failure: {"status":"ERR","error":"100","error_string":"authentication failed"}
            // Success: {"data":[{"status":"OK","error":"0","smslog_id":"..."}],"error_string":null}
            const data = response.data;
            const results = Array.isArray(data?.data) ? data.data : [];
            if (data?.status === "ERR" || data?.error_string || !results.some((r) => r.status === "OK")) {
                throw new Error(data?.error_string || JSON.stringify(data));
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = BearSMS;
