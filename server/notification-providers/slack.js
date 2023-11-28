const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { setSettings, setting } = require("../util-server");
const { getMonitorRelativeURL, UP, DOWN, NOMINAL, SLOW } = require("../../src/util");

class Slack extends NotificationProvider {

    name = "slack";
    supportSlowNotifications = true;

    /**
     * Deprecated property notification.slackbutton
     * Set it as primary base url if this is not yet set.
     * @deprecated
     * @param {string} url The primary base URL to use
     * @returns {Promise<void>}
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

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

        if (notification.slackchannelnotify) {
            msg += " <!channel>";
        }

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

            const textMsg = "Uptime Kuma Alert";

            let color;
            switch(heartbeatJSON["status"]) {
                case UP:
                case NOMINAL:
                    color = "#2eb886";
                    break;
                case SLOW:
                    color = "#ffc107";
                    break;
                case DOWN:
                    color = "#e01e5a"
                    break;
                default:
                    color = "#0dcaf0";
            }

            let data = {
                "text": `${textMsg}\n${msg}`,
                "channel": notification.slackchannel,
                "username": notification.slackusername,
                "icon_emoji": notification.slackiconemo,
                "attachments": [
                    {
                        "color": color,
                        "blocks": [
                            {
                                "type": "header",
                                "text": {
                                    "type": "plain_text",
                                    "text": textMsg,
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
                                    "text": `*Time (${heartbeatJSON["timezone"]})*\n${heartbeatJSON["localDateTime"]}`,
                                }],
                            }
                        ],
                    }
                ]
            };

            if (notification.slackbutton) {
                await Slack.deprecateURL(notification.slackbutton);
            }

            const baseURL = await setting("primaryBaseURL");

            // Button
            if (baseURL) {
                data.attachments.forEach(element => {
                    element.blocks.push({
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
