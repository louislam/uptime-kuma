const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { setSettings, setting } = require("../util-server");
const { getMonitorRelativeURL } = require("../../src/util");

class Slack extends NotificationProvider {

    name = "slack";

    /**
     * Deprecated property notification.slackbutton
     * Set it as primary base url if this is not yet set.
     * @param {string} url The primary base URL to use
     */
    static async deprecateURL(url) {
        let currentPrimaryBaseURL = await setting("primaryBaseURL");

        if (!currentPrimaryBaseURL) {
            console.log("Move the url to be the primary base URL");
            await setSettings("general", {
                primaryBaseURL: url,
            });
        } else {
            console.log("Already there, no need to move the primary base URL");
        }
    }

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";
        try {
            if (heartbeatJSON == null) {
                let data = {
                    "text": msg,
                    "channel": notification.slackchannel,
                    "username": notification.slackusername,
                    "icon_emoji": notification.slackiconemo,
                };
                await axios.post(notification.slackwebhookURL, data);
                return okMsg;
            }

            const time = heartbeatJSON["time"];
            const textMsg = "Uptime Kuma Alert";
            let data = {
                "text": monitorJSON ? textMsg + `: ${monitorJSON.name}` : textMsg,
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
                }],
            };

            if (notification.slackbutton) {
                await Slack.deprecateURL(notification.slackbutton);
            }

            const baseURL = await setting("primaryBaseURL");

            // Button
            if (baseURL) {
                data.blocks.push({
                    "type": "actions",
                    "elements": [{
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "Visit Uptime Kuma",
                        },
                        "value": "Uptime-Kuma",
                        "url": baseURL + getMonitorRelativeURL(monitorJSON.id),
                    }],
                });
            }

            await axios.post(notification.slackwebhookURL, data);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }

    }
}

module.exports = Slack;
