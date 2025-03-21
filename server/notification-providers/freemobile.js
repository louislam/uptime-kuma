const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class FreeMobile extends NotificationProvider {
    name = "FreeMobile";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            await axios.post(`https://smsapi.free-mobile.fr/sendmsg?msg=${encodeURIComponent(msg.replace("🔴", "⛔️"))}`, {
                "user": notification.freemobileUser,
                "pass": notification.freemobilePass,
            });

            return okMsg;

        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = FreeMobile;
