const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Slack extends NotificationProvider {

    name = "slack";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";
        try {
            if (heartbeatJSON == null) {
                let data = {
                    "text": "Uptime Kuma Slack testing successful.",
                    "channel": notification.slackchannel,
                    "username": notification.slackusername,
                    "icon_emoji": notification.slackiconemo,
                }
                await axios.post(notification.slackwebhookURL, data)
                return okMsg;
            }

            const time = heartbeatJSON["time"];
            let data = {
                "text": "Uptime Kuma Alert",
                "channel": notification.slackchannel,
                "username": notification.slackusername,
                "icon_emoji": notification.slackiconemo,
                "blocks": [{
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": "Uptime Kuma Alert",
                    },
                },
                {
                    "type": "section",
                    "fields": [{
                        "type": "mrkdwn",
                        "text": "*Message*\n" + msg,
                    },
                    {
                        "type": "mrkdwn",
                        "text": "*Time (UTC)*\n" + time,
                    }],
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Visit Uptime Kuma",
                            },
                            "value": "Uptime-Kuma",
                            "url": notification.slackbutton || "https://github.com/louislam/uptime-kuma",
                        },
                    ],
                }],
            }
            await axios.post(notification.slackwebhookURL, data)
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error)
        }

    }
}

module.exports = Slack;
