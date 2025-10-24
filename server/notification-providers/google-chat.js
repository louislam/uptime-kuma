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

        // If Google Chat Webhook rate limit is reached, retry to configured max retries defaults to 3, delay between 60-180 seconds
        const post = async (url, data, config) => {
            let retries = notification.googleChatMaxRetries || 1; // Default to 1 retries
            retries = (retries > 10) ? 10 : retries; // Enforce maximum retries in backend
            while (retries > 0) {
                try {
                    await axios.post(url, data, config);
                    return;
                } catch (error) {
                    if (error.response && error.response.status === 429) {
                        retries--;
                        if (retries === 0) {
                            throw error;
                        }
                        const delay = 60000 + Math.random() * 120000;
                        await new Promise(resolve => setTimeout(resolve, delay));
                    } else {
                        throw error;
                    }
                }
            }
        };

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
                await post(notification.googleChatWebhookURL, data, config);
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

            await post(notification.googleChatWebhookURL, data, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = GoogleChat;
