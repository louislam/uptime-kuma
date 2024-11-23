const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class OneBot extends NotificationProvider {
    name = "OneBot";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let url = notification.httpAddr;
            if (!url.startsWith("http")) {
                url = "http://" + url;
            }
            if (!url.endsWith("/")) {
                url += "/";
            }
            url += "send_msg";
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
            await axios.post(url, data, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = OneBot;
