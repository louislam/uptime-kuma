const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { setSettings, setting } = require("../util-server");
const { getMonitorRelativeURL, UP } = require("../../src/util");

class Slack extends NotificationProvider {

    name = "slack";

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

            const actions = [];

            const baseURL = await setting("primaryBaseURL");

            if(baseURL){
                actions.push({
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "Visit Uptime Kuma",
                    },
                    "value": "Uptime-Kuma",
                    "url": baseURL + getMonitorRelativeURL(monitorJSON.id),
                });

            }

            if(monitorJSON.url) {
                actions.push({
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "Visit site",
                    },
                    "value": "Site",
                    "url": monitorJSON.url,
                })
            }

            const textMsg = "Uptime Kuma Alert";
            let data = {
                "text": `${textMsg}\n${msg}`,
                "channel": notification.slackchannel,
                "username": notification.slackusername,
                "icon_emoji": notification.slackiconemo,
                "attachments": [
                    {
                        "color": (heartbeatJSON["status"] === UP) ? "#2eb886" : "#e01e5a",
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
                            },
                            {
                                "type": "actions",
                                "elements": actions,
                            }
                        ],
                    }
                ]
            };

            if (notification.slackbutton) {
                await Slack.deprecateURL(notification.slackbutton);
            }

            await axios.post(notification.slackwebhookURL, data);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }

    }
}

module.exports = Slack;
