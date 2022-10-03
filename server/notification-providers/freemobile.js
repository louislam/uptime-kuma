const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class FreeMobile extends NotificationProvider {

    name = "FreeMobile";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";
        try {
            await axios.post(`https://smsapi.free-mobile.fr/sendmsg?msg=${encodeURI(msg.replace("🔴", "⛔️"))}`, {
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
