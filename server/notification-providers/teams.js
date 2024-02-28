const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { setting } = require("../util-server");
const { DOWN, UP, getMonitorRelativeURL } = require("../../src/util");

class Teams extends NotificationProvider {
    name = "teams";

    /**
     * Generate the message to send
     * @param {const} status The status constant
     * @param {string} monitorName Name of monitor
     * @returns {string} Status message
     */
    _statusMessageFactory = (status, monitorName) => {
        if (status === DOWN) {
            return `🔴 [${monitorName}] went down`;
        } else if (status === UP) {
            return `✅ [${monitorName}] is back online`;
        }
        return "Notification";
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
     * @param {object} args Method arguments
     * @param {const} args.status The status of the monitor
     * @param {string} args.monitorMessage Message to send
     * @param {string} args.monitorName Name of the monitor affected
     * @param {string} args.monitorUrl URL of the monitor affected
     * @param {string} args.dashboardUrl URL of the dashboard affected
     * @returns {object} Notification payload
     */
    _notificationPayloadFactory = ({
        status,
        monitorMessage,
        monitorName,
        monitorUrl,
        dashboardUrl,
    }) => {
        const notificationMessage = this._statusMessageFactory(
            status,
            monitorName
        );

        const facts = [];

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
        }

        const headerMessage = `**${notificationMessage}**`;

        const payload = {
            "type": "message",
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
                                                        "text": headerMessage,
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
                                "separator": true,
                                "facts": facts
                            }
                        ],
                        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                        "version": "1.5"
                    }
                }
            ]
        };

        if (dashboardUrl) {
            payload.attachments.forEach(element => {
                element.content.push({
                    "type": "ActionSet",
                    "actions": [
                        {
                            "type": "Action.OpenUrl",
                            "title": "Visit Uptime Kuma",
                            "url": dashboardUrl
                        }
                    ]
                });
            });
        }

        return payload;
    };

    /**
     * Send the notification
     * @param {string} webhookUrl URL to send the request to
     * @param {object} payload Payload generated by _notificationPayloadFactory
     * @returns {Promise<void>}
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

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

        try {
            if (heartbeatJSON == null) {
                await this._handleGeneralNotification(notification.webhookUrl, msg);
                return okMsg;
            }

            let monitorUrl;

            switch (monitorJSON["type"]) {
                case "http":
                case "keywork":
                    monitorUrl = monitorJSON["url"];
                    break;
                case "docker":
                    monitorUrl = monitorJSON["docker_host"];
                    break;
                default:
                    monitorUrl = monitorJSON["hostname"];
                    break;
            }

            const baseURL = await setting("primaryBaseURL");
            let dashboardUrl;
            if (baseURL) {
                dashboardUrl = baseURL + getMonitorRelativeURL(monitorJSON.id);
            }

            const payload = this._notificationPayloadFactory({
                monitorMessage: heartbeatJSON.msg,
                monitorName: monitorJSON.name,
                monitorUrl: monitorUrl,
                status: heartbeatJSON.status,
                dashboardUrl: dashboardUrl,
            });

            await this._sendNotification(notification.webhookUrl, payload);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Teams;
