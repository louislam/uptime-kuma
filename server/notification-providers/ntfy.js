const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class Ntfy extends NotificationProvider {
    name = "ntfy";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let headers = {};
            if (notification.ntfyAuthenticationMethod === "usernamePassword") {
                headers = {
                    Authorization:
                        "Basic " +
                        Buffer.from(notification.ntfyusername + ":" + notification.ntfypassword).toString("base64"),
                };
            } else if (notification.ntfyAuthenticationMethod === "accessToken") {
                headers = {
                    Authorization: "Bearer " + notification.ntfyaccesstoken,
                };
            }
            if (notification.ntfyCall) {
                headers["X-Call"] = notification.ntfyCall;
            }
            let config = {
                headers,
            };
            config = this.getAxiosConfigWithProxy(config);
            // If heartbeatJSON is null, assume non monitoring notification (Certificate warning) or testing.
            if (heartbeatJSON == null) {
                // Default values for test notification
                let title = (monitorJSON?.name || notification.ntfytopic) + " [Uptime-Kuma]";
                let message = msg;

                // Apply custom templates from notification settings if enabled
                if (notification.ntfyUseTemplate) {
                    const customTitle = notification.ntfyCustomTitle?.trim() || "";
                    if (customTitle !== "") {
                        title = await this.renderTemplate(customTitle, msg, monitorJSON, heartbeatJSON);
                    }

                    const customMessage = notification.ntfyCustomMessage?.trim() || "";
                    if (customMessage !== "") {
                        message = await this.renderTemplate(customMessage, msg, monitorJSON, heartbeatJSON);
                    }
                }

                let ntfyTestData = {
                    topic: notification.ntfytopic,
                    title: title,
                    message: message,
                    priority: notification.ntfyPriority,
                    tags: ["test_tube"],
                };
                await axios.post(notification.ntfyserverurl, ntfyTestData, config);
                return okMsg;
            }
            let tags = [];
            let status = "unknown";
            let priority = notification.ntfyPriority || 4;
            if ("status" in heartbeatJSON) {
                if (heartbeatJSON.status === DOWN) {
                    tags = ["red_circle"];
                    status = "Down";
                    // defaults to max(priority + 1, 5)
                    priority = notification.ntfyPriorityDown || (priority === 5 ? priority : priority + 1);
                } else if (heartbeatJSON["status"] === UP) {
                    tags = ["green_circle"];
                    status = "Up";
                }
            }

            // Include monitor's assigned tags
            if (monitorJSON && monitorJSON.tags && Array.isArray(monitorJSON.tags)) {
                const monitorTagNames = monitorJSON.tags.map((tag) => {
                    // Include value if it exists
                    if (tag.value) {
                        return `${tag.name}: ${tag.value}`;
                    }
                    return tag.name;
                });
                tags = tags.concat(monitorTagNames);
            }

            // Default values
            let title = monitorJSON.name + " " + status + " [Uptime-Kuma]";
            let message = heartbeatJSON.msg;

            // Apply custom templates from notification settings if enabled
            if (notification.ntfyUseTemplate) {
                const customTitle = notification.ntfyCustomTitle?.trim() || "";
                const customMessage = notification.ntfyCustomMessage?.trim() || "";

                if (customTitle !== "") {
                    title = await this.renderTemplate(customTitle, msg, monitorJSON, heartbeatJSON);
                }
                if (customMessage !== "") {
                    message = await this.renderTemplate(customMessage, msg, monitorJSON, heartbeatJSON);
                }
            }

            let data = {
                topic: notification.ntfytopic,
                message: message,
                priority: priority,
                title: title,
                tags: tags,
            };

            if (monitorJSON.url && monitorJSON.url !== "https://") {
                data.actions = [
                    {
                        action: "view",
                        label: "Open " + monitorJSON.name,
                        url: monitorJSON.url,
                    },
                ];
            }

            if (notification.ntfyIcon) {
                data.icon = notification.ntfyIcon;
            }

            await axios.post(notification.ntfyserverurl, data, config);

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Ntfy;
