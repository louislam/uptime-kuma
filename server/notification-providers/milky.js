const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Milky extends NotificationProvider {
    name = "Milky";

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
                url += "/api/";
            }
            if (notification.msgType === "group") {
                url += "send_group_message";
            } else {
                url += "send_private_message";
            }
            let config = {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + notification.accessToken,
                },
            };
            config = this.getAxiosConfigWithProxy(config);
            let pushText = "UptimeKuma Alert: " + msg;
            let data = {
                message: [
                    {
                        type: "text",
                        data: {
                            text: pushText,
                        },
                    },
                ],
            };
            if (notification.msgType === "group") {
                data["group_id"] = notification.recieverId;
            } else {
                data["user_id"] = notification.recieverId;
            }
            await axios.post(url, data, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Milky;
