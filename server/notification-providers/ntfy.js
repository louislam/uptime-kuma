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
                    "Authorization": "Basic " + Buffer.from(notification.ntfyusername + ":" + notification.ntfypassword).toString("base64"),
                };
            } else if (notification.ntfyAuthenticationMethod === "accessToken") {
                headers = {
                    "Authorization": "Bearer " + notification.ntfyaccesstoken,
                };
            }
            // If heartbeatJSON is null, assume non monitoring notification (Certificate warning) or testing.
            if (heartbeatJSON == null) {
                let ntfyTestData = {
                    "topic": notification.ntfytopic,
                    "title": (monitorJSON?.name || notification.ntfytopic) + " [Uptime-Kuma]",
                    "message": msg,
                    "priority": notification.ntfyPriority,
                    "tags": [ "test_tube" ],
                };
                await axios.post(notification.ntfyserverurl, ntfyTestData, { headers: headers });
                return okMsg;
            }
            let tags = [];
            let status = "unknown";
            let priority = notification.ntfyPriority || 4;
            if ("status" in heartbeatJSON) {
                if (heartbeatJSON.status === DOWN) {
                    tags = [ "red_circle" ];
                    status = "Down";
                    // defaults to max(priority + 1, 5)
                    priority = notification.ntfyPriorityDown || (priority === 5 ? priority : priority + 1);
                } else if (heartbeatJSON["status"] === UP) {
                    tags = [ "green_circle" ];
                    status = "Up";
                }
            }
            let data = {
                "topic": notification.ntfytopic,
                "message": heartbeatJSON.msg,
                "priority": priority,
                "title": monitorJSON.name + " " + status + " [Uptime-Kuma]",
                "tags": tags,
            };

            if (monitorJSON.url && monitorJSON.url !== "https://") {
                data.actions = [
                    {
                        "action": "view",
                        "label": "Open " + monitorJSON.name,
                        "url": monitorJSON.url,
                    },
                ];
            }

            if (notification.ntfyIcon) {
                data.icon = notification.ntfyIcon;
            }

            await axios.post(notification.ntfyserverurl, data, { headers: headers });

            return okMsg;

        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Ntfy;
