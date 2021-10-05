const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class RocketChat extends NotificationProvider {

    name = "rocket.chat";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";
        try {
            if (heartbeatJSON == null) {
                let data = {
                    "text": "Uptime Kuma Rocket.chat testing successful.",
                    "channel": notification.rocketchannel,
                    "username": notification.rocketusername,
                    "icon_emoji": notification.rocketiconemo,
                }
                await axios.post(notification.rocketwebhookURL, data)
                return okMsg;
            }

            const time = heartbeatJSON["time"];
            let data = {
                "text": "Uptime Kuma Alert",
                "channel": notification.rocketchannel,
                "username": notification.rocketusername,
                "icon_emoji": notification.rocketiconemo,
                "attachments": [
                    {
                        "title": "Uptime Kuma Alert *Time (UTC)*\n" + time,
                        "title_link": notification.rocketbutton,
                        "text": "*Message*\n" + msg,
                        "color": "#32cd32"
                    }
                ]
            }
            await axios.post(notification.rocketwebhookURL, data)
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error)
        }

    }
}

module.exports = RocketChat;
