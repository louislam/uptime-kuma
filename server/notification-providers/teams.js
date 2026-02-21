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
     * @param {boolean} withStatusSymbol If the status should be prepended as symbol
     * @returns {string} Status message
     */
    _statusMessageFactory = (status, monitorName, withStatusSymbol) => {
        if (status === DOWN) {
            return (withStatusSymbol ? "🔴 " : "") + `[${monitorName}] went down`;
        } else if (status === UP) {
            return (withStatusSymbol ? "✅ " : "") + `[${monitorName}] is back online`;
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
     * Format the tag for display. If the tag has a value, display as "name: value", otherwise just "name".
     * @param {object} tag The tag object to format
     * @returns {string} Formatted tag for display
     */
    _tagDisplayText = (tag) => {
        if (tag.value === "" || tag.value === undefined || tag.value === null) {
            return tag.name;
        } else {
            return `${tag.name}: ${tag.value}`;
        }
    };

    /**
     * Generate payload for notification
     * @param {object} args Method arguments
     * @param {object} args.heartbeatJSON Heartbeat details
     * @param {object} args.monitorJSON Monitor details
     * @param {string} args.dashboardUrl URL of the dashboard affected
     * @param {boolean} args.enableTags Whether to include tags in the notification
     * @returns {object} Notification payload
     */
    _notificationPayloadFactory = ({ heartbeatJSON, monitorJSON, dashboardUrl, enableTags }) => {
        const monitorUrl = this.extractAddress(monitorJSON);
        const monitorName = monitorJSON?.name;
        const status = heartbeatJSON?.status;
        const facts = [];
        const actions = [];

        if (dashboardUrl) {
            actions.push({
                type: "Action.OpenUrl",
                title: "Visit Uptime Kuma",
                url: dashboardUrl,
            });
        }

        if (heartbeatJSON?.msg) {
            facts.push({
                title: "Description",
                value: heartbeatJSON.msg,
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
                type: "Action.OpenUrl",
                title: "Visit Monitor URL",
                url: monitorUrl,
            });
        }

        if (heartbeatJSON?.localDateTime) {
            facts.push({
                title: "Time",
                value: heartbeatJSON.localDateTime + (heartbeatJSON.timezone ? ` (${heartbeatJSON.timezone})` : ""),
            });
        }

        const payloadBody = [
            {
                type: "Container",
                verticalContentAlignment: "Center",
                items: [
                    {
                        type: "ColumnSet",
                        style: this._getStyle(status),
                        columns: [
                            {
                                type: "Column",
                                width: "auto",
                                verticalContentAlignment: "Center",
                                items: [
                                    {
                                        type: "Image",
                                        width: "32px",
                                        style: "Person",
                                        url: "https://raw.githubusercontent.com/louislam/uptime-kuma/master/public/icon.png",
                                        altText: "Uptime Kuma Logo",
                                    },
                                ],
                            },
                            {
                                type: "Column",
                                width: "stretch",
                                items: [
                                    {
                                        type: "TextBlock",
                                        size: "Medium",
                                        weight: "Bolder",
                                        text: `**${this._statusMessageFactory(status, monitorName, false)}**`,
                                    },
                                    {
                                        type: "TextBlock",
                                        size: "Small",
                                        weight: "Default",
                                        text: "Uptime Kuma Alert",
                                        isSubtle: true,
                                        spacing: "None",
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
            {
                type: "FactSet",
                separator: false,
                facts: facts,
            },
        ];

        if (enableTags && monitorJSON?.tags?.length > 0) {
            payloadBody.push({
                type: "Container",
                layouts: [
                    {
                        type: "Layout.Flow",
                        columnSpacing: "Small",
                        rowSpacing: "Small",
                        horizontalItemsAlignment: "Left",
                    },
                ],
                items: monitorJSON.tags.map((tag) => {
                    return {
                        type: "Badge",
                        text: this._tagDisplayText(tag),
                        size: "Medium",
                        style: "Accent",
                    };
                }),
            });
        }

        const payload = {
            type: "message",
            // message with status prefix as notification text
            summary: this._statusMessageFactory(status, monitorName, true),
            attachments: [
                {
                    contentType: "application/vnd.microsoft.card.adaptive",
                    contentUrl: "",
                    content: {
                        type: "AdaptiveCard",
                        body: payloadBody,
                        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
                        version: "1.5",
                    },
                },
            ],
        };

        if (actions) {
            payload.attachments[0].content.body.push({
                type: "ActionSet",
                actions: actions,
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
        let config = this.getAxiosConfigWithProxy({});
        await axios.post(webhookUrl, payload, config);
    };

    /**
     * Send a general notification
     * @param {string} webhookUrl URL to send request to
     * @param {string} msg Message to send
     * @returns {Promise<void>}
     */
    _handleGeneralNotification = (webhookUrl, msg) => {
        const payload = this._notificationPayloadFactory({
            heartbeatJSON: {
                msg: msg,
            },
        });

        return this._sendNotification(webhookUrl, payload);
    };

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            if (heartbeatJSON == null) {
                await this._handleGeneralNotification(notification.webhookUrl, msg);
                return okMsg;
            }

            const baseURL = await setting("primaryBaseURL");
            let dashboardUrl;
            if (baseURL) {
                dashboardUrl = baseURL + getMonitorRelativeURL(monitorJSON.id);
            }

            const payload = this._notificationPayloadFactory({
                heartbeatJSON: heartbeatJSON,
                monitorJSON: monitorJSON,
                dashboardUrl: dashboardUrl,
                enableTags: notification.teamsEnableTags ?? false,
            });

            await this._sendNotification(notification.webhookUrl, payload);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Teams;
