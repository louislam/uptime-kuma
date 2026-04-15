const NotificationProvider = require("./notification-provider");
const axios = require("axios");

const { DOWN, UP } = require("../../src/util");

class Pushbullet extends NotificationProvider {
    name = "pushbullet";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = "https://api.pushbullet.com/v2/pushes";

        try {
            let config = {
                headers: {
                    "Access-Token": notification.pushbulletAccessToken,
                    "Content-Type": "application/json",
                },
            };
            config = this.getAxiosConfigWithProxy(config);

            if (heartbeatJSON == null) {
                let title = "Uptime Kuma Alert";
                let body = msg;

                if (notification.pushbulletUseTemplate) {
                    const customTitle = notification.pushbulletTitleTemplate?.trim() || "";
                    if (customTitle !== "") {
                        title = await this.renderTemplate(customTitle, msg, monitorJSON, heartbeatJSON);
                    }
                    const customMessage = notification.pushbulletMessageTemplate?.trim() || "";
                    if (customMessage !== "") {
                        body = await this.renderTemplate(customMessage, msg, monitorJSON, heartbeatJSON);
                    }
                }

                let data = {
                    type: "note",
                    title: title,
                    body: body,
                };
                await axios.post(url, data, config);
            } else if (notification.pushbulletUseTemplate) {
                let title = "UptimeKuma Alert: " + monitorJSON["name"];
                let body = msg;

                const customTitle = notification.pushbulletTitleTemplate?.trim() || "";
                if (customTitle !== "") {
                    title = await this.renderTemplate(customTitle, msg, monitorJSON, heartbeatJSON);
                }
                const customMessage = notification.pushbulletMessageTemplate?.trim() || "";
                if (customMessage !== "") {
                    body = await this.renderTemplate(customMessage, msg, monitorJSON, heartbeatJSON);
                }

                await axios.post(url, { type: "note", title: title, body: body }, config);
            } else if (heartbeatJSON["status"] === DOWN) {
                let downData = {
                    type: "note",
                    title: "UptimeKuma Alert: " + monitorJSON["name"],
                    body:
                        "[🔴 Down] " +
                        heartbeatJSON["msg"] +
                        `\nTime (${heartbeatJSON["timezone"]}): ${heartbeatJSON["localDateTime"]}`,
                };
                await axios.post(url, downData, config);
            } else if (heartbeatJSON["status"] === UP) {
                let upData = {
                    type: "note",
                    title: "UptimeKuma Alert: " + monitorJSON["name"],
                    body:
                        "[✅ Up] " +
                        heartbeatJSON["msg"] +
                        `\nTime (${heartbeatJSON["timezone"]}): ${heartbeatJSON["localDateTime"]}`,
                };
                await axios.post(url, upData, config);
            }
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Pushbullet;
