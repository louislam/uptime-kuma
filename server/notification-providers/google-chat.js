const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { setting } = require("../util-server");
const { getMonitorRelativeURL, UP } = require("../../src/util");

class GoogleChat extends NotificationProvider {
    name = "GoogleChat";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let config = this.getAxiosConfigWithProxy({});
            // Google Chat message formatting: https://developers.google.com/chat/api/guides/message-formats/basic
            if (notification.googleChatUseTemplate && notification.googleChatTemplate) {
                // Send message using template
                const renderedText = await this.renderTemplate(
                    notification.googleChatTemplate,
                    msg,
                    monitorJSON,
                    heartbeatJSON
                );
                const data = { "text": renderedText };
                await axios.post(notification.googleChatWebhookURL, data, config);
                return okMsg;
            }

            let chatHeader = {
                title: "Uptime Kuma Alert",
            };

            if (monitorJSON && heartbeatJSON) {
                chatHeader["title"] =
                    heartbeatJSON["status"] === UP
                        ? `✅ ${monitorJSON["name"]} is back online`
                        : `🔴 ${monitorJSON["name"]} went down`;
            }

            // always show msg
            let sectionWidgets = [
                {
                    textParagraph: {
                        text: `<b>Message:</b>\n${msg}`,
                    },
                },
            ];

            // add time if available
            if (heartbeatJSON) {
                sectionWidgets.push({
                    textParagraph: {
                        text: `<b>Time (${heartbeatJSON["timezone"]}):</b>\n${heartbeatJSON["localDateTime"]}`,
                    },
                });
            }

            // add button for monitor link if available
            const baseURL = await setting("primaryBaseURL");
            if (baseURL) {
                const urlPath = monitorJSON ? getMonitorRelativeURL(monitorJSON.id) : "/";
                sectionWidgets.push({
                    buttonList: {
                        buttons: [
                            {
                                text: "Visit Uptime Kuma",
                                onClick: {
                                    openLink: {
                                        url: baseURL + urlPath,
                                    },
                                },
                            },
                        ],
                    },
                });
            }

            let chatSections = [
                {
                    widgets: sectionWidgets,
                },
            ];

            // construct json data
            let data = {
                fallbackText: chatHeader["title"],
                cardsV2: [
                    {
                        card: {
                            header: chatHeader,
                            sections: chatSections,
                        },
                    },
                ],
            };

            await axios.post(notification.googleChatWebhookURL, data, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = GoogleChat;
