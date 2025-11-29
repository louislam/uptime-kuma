const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const Slack = require("./slack");
const { setting } = require("../util-server");
const { getMonitorRelativeURL, DOWN } = require("../../src/util");

class RocketChat extends NotificationProvider {
    name = "rocket.chat";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let config = this.getAxiosConfigWithProxy({});
            if (heartbeatJSON == null) {
                let data = {
                    "text": msg,
                    "channel": notification.rocketchannel,
                    "username": notification.rocketusername,
                    "icon_emoji": notification.rocketiconemo,
                };
                await axios.post(notification.rocketwebhookURL, data, config);
                return okMsg;
            }

            let data = {
                "text": "Uptime Kuma Alert",
                "channel": notification.rocketchannel,
                "username": notification.rocketusername,
                "icon_emoji": notification.rocketiconemo,
                "attachments": [
                    {
                        "title": `Uptime Kuma Alert *Time (${heartbeatJSON["timezone"]})*\n${heartbeatJSON["localDateTime"]}`,
                        "text": "*Message*\n" + msg,
                    }
                ]
            };

            // Color
            if (heartbeatJSON.status === DOWN) {
                data.attachments[0].color = "#ff0000";
            } else {
                data.attachments[0].color = "#32cd32";
            }

            if (notification.rocketbutton) {
                await Slack.deprecateURL(notification.rocketbutton);
            }

            const baseURL = await setting("primaryBaseURL");

            if (baseURL) {
                data.attachments[0].title_link = baseURL + getMonitorRelativeURL(monitorJSON.id);
            }

            await axios.post(notification.rocketwebhookURL, data, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }

    }
}

module.exports = RocketChat;
