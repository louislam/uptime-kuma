const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class Trigv extends NotificationProvider {
    name = "trigv";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let config = {
                headers: {
                    Authorization: "Bearer " + notification.trigvApiKey,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
            };
            config = this.getAxiosConfigWithProxy(config);

            let title = monitorJSON?.name || "Uptime Kuma";
            let description = msg;
            let level = "info";
            if (heartbeatJSON != null) {
                if (heartbeatJSON.status === DOWN) {
                    title += " is down";
                    level = "error";
                } else if (heartbeatJSON.status === UP) {
                    title += " is up";
                    level = "success";
                }
                description = heartbeatJSON.msg + `\nTime (${heartbeatJSON.timezone}): ${heartbeatJSON.localDateTime}`;
            }

            const data = {
                channel: notification.trigvChannel || "general",
                title: title.slice(0, 255),
                description: description.slice(0, 1000),
                level,
            };
            if (monitorJSON?.url && monitorJSON.url.length <= 2048 && URL.canParse(monitorJSON.url)) {
                const url = new URL(monitorJSON.url);
                if (url.protocol === "http:" || url.protocol === "https:") {
                    data.url = monitorJSON.url;
                }
            }

            await axios.post("https://api.trigv.com/v1/events", data, {
                ...config,
                validateStatus: (status) => status === 202,
            });
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Trigv;
