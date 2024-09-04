const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class Teams extends NotificationProvider {
    name = "teams";

    /**
     * Generate the message to send
     * @param {const} status The status constant
     * @param {string} monitorName Name of monitor
     * @returns {string}
     */
    _statusMessageFactory = (status, monitorName) => {
        if (status === DOWN) {
            return `🔴 Application [${monitorName}] went down`;
        } else if (status === UP) {
            return `✅ Application [${monitorName}] is back online`;
        }
        return "Notification";
    };

    /**
     * Select theme color to use based on status
     * @param {const} status The status constant
     * @returns {string} Selected color in hex RGB format
     */
    _getThemeColor = (status) => {
        if (status === DOWN) {
            return "ff0000";
        }
        if (status === UP) {
            return "00e804";
        }
        return "008cff";
    };

    /**
     * Select the style to use based on status
     * @param {const} status The status constant
     * @returns {string} Selected style for adaptive cards
     */
    _getStyle = (status) => {
        if (status === DOWN) {
            return "attention";
        }
        if (status === UP) {
            return "good";
        }
        return "emphasis";
    };

    /**
     * Generate payload for notification
     * @param {const} status The status of the monitor
     * @param {string} monitorMessage Message to send
     * @param {string} monitorName Name of monitor affected
     * @param {string} monitorUrl URL of monitor affected
     * @returns {Object}
     */
    _notificationPayloadFactory = ({
        status,
        monitorMessage,
        monitorName,
        monitorUrl,
    }) => {
        const facts = [];
        const actions = [];

        if (monitorMessage) {
            facts.push({
                title: "Description",
                value: monitorMessage,
            });
        }

        if (monitorName) {
            facts.push({
                title: "Monitor",
                value: monitorName,
            });
        }

        if (monitorUrl && monitorUrl !== "https://") {
            facts.push({
                title: "URL",
                // format URL as markdown syntax, to be clickable
                value: `[${monitorUrl}](${monitorUrl})`,
            });
            actions.push({
                "type": "Action.OpenUrl",
                "title": "Visit Monitor URL",
                "url": monitorUrl
            });
        }

        const payload = {
            "type": "message",
            // message with status prefix as notification text
            "summary": this._statusMessageFactory(status, monitorName),
            "attachments": [
                {
                    "contentType": "application/vnd.microsoft.card.adaptive",
                    "contentUrl": "",
                    "content": {
                        "type": "AdaptiveCard",
                        "body": [
                            {
                                "type": "Container",
                                "verticalContentAlignment": "Center",
                                "items": [
                                    {
                                        "type": "ColumnSet",
                                        "style": this._getStyle(status),
                                        "columns": [
                                            {
                                                "type": "Column",
                                                "width": "auto",
                                                "verticalContentAlignment": "Center",
                                                "items": [
                                                    {
                                                        "type": "Image",
                                                        "width": "32px",
                                                        "style": "Person",
                                                        "url": "https://raw.githubusercontent.com/louislam/uptime-kuma/master/public/icon.png",
                                                        "altText": "Uptime Kuma Logo"
                                                    }
                                                ]
                                            },
                                            {
                                                "type": "Column",
                                                "width": "stretch",
                                                "items": [
                                                    {
                                                        "type": "TextBlock",
                                                        "size": "Medium",
                                                        "weight": "Bolder",
                                                        "text": `**${this._statusMessageFactory(status, monitorName, false)}**`,
                                                    },
                                                    {
                                                        "type": "TextBlock",
                                                        "size": "Small",
                                                        "weight": "Default",
                                                        "text": "Uptime Kuma Alert",
                                                        "isSubtle": true,
                                                        "spacing": "None"
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                "type": "FactSet",
                                "separator": false,
                                "facts": facts
                            }
                        ],
                        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                        "version": "1.4"
                    }
                }
            ]
        };

        if (actions) {
            payload.attachments[0].content.body.push({
                "type": "ActionSet",
                "actions": actions,
            });
        }

        return payload;
    };

    /**
     * Send the notification
     * @param {string} webhookUrl URL to send the request to
     * @param {Object} payload Payload generated by _notificationPayloadFactory
     */
    _sendNotification = async (webhookUrl, payload) => {
        await axios.post(webhookUrl, payload);
    };

    /**
     * Send a general notification
     * @param {string} webhookUrl URL to send request to
     * @param {string} msg Message to send
     * @returns {Promise<void>}
     */
    _handleGeneralNotification = (webhookUrl, msg) => {
        const payload = this._notificationPayloadFactory({
            monitorMessage: msg
        });

        return this._sendNotification(webhookUrl, payload);
    };

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

        try {
            if (heartbeatJSON == null) {
                await this._handleGeneralNotification(notification.webhookUrl, msg);
                return okMsg;
            }

            let url;

            switch (monitorJSON["type"]) {
                case "http":
                case "keywork":
                    url = monitorJSON["url"];
                    break;
                case "docker":
                    url = monitorJSON["docker_host"];
                    break;
                default:
                    url = monitorJSON["hostname"];
                    break;
            }

            const payload = this._notificationPayloadFactory({
                monitorMessage: heartbeatJSON.msg,
                monitorName: monitorJSON.name,
                monitorUrl: url,
                status: heartbeatJSON.status,
            });

            await this._sendNotification(notification.webhookUrl, payload);

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Teams;
