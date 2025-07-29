const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { setSettings, setting } = require("../util-server");
const { getMonitorRelativeURL, UP, log } = require("../../src/util");
const isUrl = require("is-url");

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
     * Builds the actions available in the slack message
     * @param {string} baseURL Uptime Kuma base URL
     * @param {object} monitorJSON The monitor config
     * @returns {Array} The relevant action objects
     */
    buildActions(baseURL, monitorJSON) {
        const actions = [];

        if (baseURL) {
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

        const address = this.extractAddress(monitorJSON);
        if (isUrl(address)) {
            try {
                actions.push({
                    "type": "button",
                    "text": {
                        "type": "plain_text",
                        "text": "Visit site",
                    },
                    "value": "Site",
                    "url": new URL(address),
                });

            } catch (e) {
                log.debug("slack", `Failed to parse address ${address} as URL`);
            }
        }

        return actions;
    }

    /**
     * Builds the different blocks the Slack message consists of.
     * @param {string} baseURL Uptime Kuma base URL
     * @param {object} monitorJSON The monitor object
     * @param {object} heartbeatJSON The heartbeat object
     * @param {string} title The message title
     * @param {string} msg The message body
     * @returns {Array<object>} The rich content blocks for the Slack message
     */
    buildBlocks(baseURL, monitorJSON, heartbeatJSON, title, msg) {

        //create an array to dynamically add blocks
        const blocks = [];

        // the header block
        blocks.push({
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": title,
            },
        });

        // the body block, containing the details
        blocks.push({
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": "*Message*\n" + msg,
                },
                {
                    "type": "mrkdwn",
                    "text": `*Time (${heartbeatJSON["timezone"]})*\n${heartbeatJSON["localDateTime"]}`,
                }
            ],
        });

        const actions = this.buildActions(baseURL, monitorJSON);
        if (actions.length > 0) {
            //the actions block, containing buttons
            blocks.push({
                "type": "actions",
                "elements": actions,
            });
        }

        return blocks;
    }

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

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

            const baseURL = await setting("primaryBaseURL");

            const title = "Uptime Kuma Alert";
            let data = {
                "text": msg,
                "channel": notification.slackchannel,
                "username": notification.slackusername,
                "icon_emoji": notification.slackiconemo,
                "attachments": [],
            };

            if (notification.slackrichmessage) {
                data.attachments.push(
                    {
                        "color": (heartbeatJSON["status"] === UP) ? "#2eb886" : "#e01e5a",
                        "blocks": this.buildBlocks(baseURL, monitorJSON, heartbeatJSON, title, msg),
                    }
                );
            } else {
                data.text = `${title}\n${msg}`;
            }

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
