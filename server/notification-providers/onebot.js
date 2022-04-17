const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class OneBot extends NotificationProvider {

    name = "OneBot";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";
        try {
            let httpAddr = notification.httpAddr;
            if (!httpAddr.startsWith("http")) {
                httpAddr = "http://" + httpAddr;
            }
            if (!httpAddr.endsWith("/")) {
                httpAddr += "/";
            }
            let onebotAPIUrl = httpAddr + "send_msg";
            let config = {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + notification.accessToken,
                }
            };
            let pushText = "UptimeKuma Alert: " + msg;
            let data = {
                "auto_escape": true,
                "message": pushText,
            };
            if (notification.msgType === "group") {
                data["message_type"] = "group";
                data["group_id"] = notification.recieverId;
            } else {
                data["message_type"] = "private";
                data["user_id"] = notification.recieverId;
            }
            await axios.post(onebotAPIUrl, data, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = OneBot;
