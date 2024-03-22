const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { setSettings, setting } = require("../util-server");
const { getMonitorRelativeURL, UP, flipStatus, DOWN, log } = require("../../src/util");
const { R } = require("redbean-node");
const dayjs = require("dayjs");

const duration = require("dayjs/plugin/duration");
const relativeTime = require("dayjs/plugin/relativeTime");

dayjs.extend(duration);
dayjs.extend(relativeTime);

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
        const okMsg = "Sent Successfully.";

        if (notification.slackchannelnotify) {
            msg += " <!channel>";
        }

        try {

            const title = "Uptime Kuma Alert";

            const message = await Slack.buildMessage(heartbeatJSON, monitorJSON, notification, title, msg);

            //not sure what this does, I think it can be safely removed
            if (notification.slackbutton) {
                await Slack.deprecateURL(notification.slackbutton);
            }

            await Slack.deliverMessage(notification, heartbeatJSON, message);

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }

    }

    /**
     * Function to calculate the duration of the downtime
     * @param {object} heartbeatJSON The heartbeat bean
     * @returns {Promise<null|number>} The duration since the current state started
     */
    static async calculateDuration(heartbeatJSON) {

        const previousDifferentBeat = await R.findOne("heartbeat", " monitor_id = ? AND status = ? ORDER BY time DESC", [
            heartbeatJSON.monitorID,
            flipStatus(heartbeatJSON.status)
        ]);

        let durationInMs = null;

        if (previousDifferentBeat) {
            durationInMs = new Date(heartbeatJSON.time) - new Date(previousDifferentBeat._time);
        }

        return durationInMs;
    }

    /**
     * Builds the message object to send to Slack
     * @param {object} heartbeatJSON The heartbeat bean
     * @param {object} monitorJSON The monitor bean
     * @param {object} notification The notification config
     * @param {string} title The message title
     * @param {string} msg The textual message
     * @returns {Promise<object>} The message object
     */
    static async buildMessage(heartbeatJSON, monitorJSON, notification, title, msg) {

        // check if the notification provider is being tested
        if (heartbeatJSON == null) {
            return {
                "text": msg,
                "channel": notification.slackchannel,
                "username": notification.slackusername,
                "icon_emoji": notification.slackiconemo,
            };

        }

        const duration = await Slack.calculateDuration(heartbeatJSON);

        const baseURL = await setting("primaryBaseURL");
        const monitorUrl = baseURL + getMonitorRelativeURL(heartbeatJSON.monitorID);

        const actions = this.buildActions(monitorUrl, monitorJSON);

        return {
            "text": `${title}\n${msg}`,
            "channel": notification.slackchannel,
            "username": notification.slackusername,
            "icon_emoji": notification.slackiconemo,
            "attachments": [
                {
                    "color": (heartbeatJSON["status"] === UP) ? "#2eb886" : "#e01e5a",
                    "blocks": Slack.buildBlocks(actions, heartbeatJSON, title, msg, duration),
                }
            ]
        };

    }

    /**
     * Builds the actions available in the Slack message
     * @param {string} monitorUrl Uptime Kuma base URL
     * @param {object} monitorJSON The monitor config
     * @returns {Array} The relevant action objects
     */
    static buildActions(monitorUrl, monitorJSON) {
        const actions = [];

        if (monitorUrl) {
            actions.push({
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "Visit Uptime Kuma",
                },
                "value": "Uptime-Kuma",
                "url": monitorUrl,
            });

        }

        if (monitorJSON.url) {
            actions.push({
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "Visit site",
                },
                "value": "Site",
                "url": monitorJSON.url,
            });
        }

        return actions;
    }

    /**
     * Builds the different blocks the Slack message consists of.
     * @param {Array} actions The action objects for the message
     * @param {object} heartbeatJSON The heartbeat object
     * @param {string} title The message title
     * @param {string} msg The message body
     * @param {null|number} duration Number of milliseconds since previous state
     * @returns {Array<object>} The rich content blocks for the Slack message
     */
    static buildBlocks(actions, heartbeatJSON, title, msg, duration) {

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

        const body = [
            {
                "type": "mrkdwn",
                "text": "*Message*\n" + msg,
            },
            {
                "type": "mrkdwn",
                "text": `*Time (${heartbeatJSON["timezone"]})*\n${heartbeatJSON["localDateTime"]}`,
            },
        ];

        if (duration) {
            body.push({
                "type": "mrkdwn",
                "text": `*After*\n${dayjs.duration(duration / 1000).humanize()}`,
            });
        }

        // the body block, containing the details
        blocks.push({
            "type": "section",
            "fields": body,
        });

        if (actions.length > 0) {
            //the actions block, containing buttons
            blocks.push({
                "type": "actions",
                "elements": actions,
            });
        }

        return blocks;
    }

    static ENDPOINTS = {
        postMessage: "https://slack.com/api/chat.postMessage",
        getPermalink: "https://slack.com/api/chat.getPermalink",
        update: "https://slack.com/api/chat.update",
    };

    // Keeps track of open alerts in order to update/close them
    static openAlerts = {};

    /**
     * Delivers the message object to slack, through the chosen method
     * @param {object} options The slack configuration
     * @param {object} heartbeatJSON The heartbeat bean
     * @param {object} message The message object to send to Slack
     * @returns {Promise<T|AxiosResponse<any>>} The response from axios
     */
    static async deliverMessage(options, heartbeatJSON, message) {

        let response = null;
        switch (options.mode) {
            case "app":
                response = Slack.deliverMessageViaAppApi(options, heartbeatJSON, message);
                break;

            case "webhook":
            default:
                response = axios.post(options.slackwebhookURL, message);

        }

        return response;
    }

    /**
     * Track an open alert for a specific monitor
     * @param {string} monitorId The monitor id
     * @param {object} data The object representing the message
     */
    static trackAlert(monitorId, data) {
        Slack.openAlerts[monitorId] = Slack.openAlerts[monitorId] || [];

        Slack.openAlerts[monitorId].push(data);

        log.debug("notification.slack", `Monitor ${monitorId} now has ${Slack.openAlerts[monitorId].length} open alerts`);

    }

    /**
     * Clears the open alerts for a specific monitor
     * @param {string} monitorId The monitor id
     */
    static clearAlerts(monitorId) {
        Slack.openAlerts[monitorId] = [];
    }

    /**
     * Returns the alert(s) for the ongoing incident for a specific monitor
     * @param {string} monitorId The monitor id
     * @returns {Array<object>} all open alerts
     */
    static getAlerts(monitorId) {
        return Slack.openAlerts[monitorId] || [];
    }

    /**
     * Delivers the message through the Slack App API
     * @param {object} options Slack configuration
     * @param {object} heartbeatJSON The heartbeat bean
     * @param {object} message The message object to send
     * @returns {Promise<object>} The axios response
     */
    static async deliverMessageViaAppApi(options, heartbeatJSON, message) {

        let response = null;
        const token = options.botToken;
        const monitorId = heartbeatJSON.monitorId;

        const axiosConfig = {
            headers: {
                "Authorization": "Bearer " + token,
            }
        };

        const existingAlerts = Slack.getAlerts(monitorId);
        if (existingAlerts.length > 0 && heartbeatJSON.status === UP) {

            log.info("slack", `Updating ${existingAlerts.length} message(s)`);

            //Update the messages in parallel
            const responses = await Promise.all(existingAlerts.map(( { channel, ts } ) => {
                message.channel = channel;
                message.ts = ts;
                return axios.post(Slack.ENDPOINTS.update, message, axiosConfig);
            }));

            //get the last response
            response = responses.pop();

        } else {
            response = await axios.post(Slack.ENDPOINTS.postMessage, message, axiosConfig);
        }

        if (response.data.ok) {

            if (heartbeatJSON.status === DOWN) {
                Slack.trackAlert(monitorId, response.data);
            } else if (heartbeatJSON.status === UP) {
                Slack.clearAlerts(monitorId);
            }

        }

        return response;
    }
}

module.exports = Slack;
