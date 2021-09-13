const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class Teams extends NotificationProvider {
    name = "teams";

    _statusMessageFactory = (status, monitorName) => {
        if (status === DOWN) {
            return `🔴 Application [${monitorName}] went down`;
        } else if (status === UP) {
            return `✅ Application [${monitorName}] is back online`;
        }
        return "Notification test";
    };

    _getThemeColor = (status) => {
        if (status === DOWN) {
            return "ff0000";
        }
        if (status === UP) {
            return "00e804";
        }
        return "008cff";
    };

    _notificationPayloadFactory = ({
        status,
        monitorMessage,
        monitorName,
        monitorUrl,
    }) => {
        const notificationMessage = this._statusMessageFactory(
            status,
            monitorName
        );
        return {
            "@context": "https://schema.org/extensions",
            "@type": "MessageCard",
            themeColor: this._getThemeColor(status),
            summary: notificationMessage,
            sections: [
                {
                    activityImage:
                        "https://raw.githubusercontent.com/louislam/uptime-kuma/master/public/icon.png",
                    activityTitle: "**Uptime Kuma**",
                },
                {
                    activityTitle: notificationMessage,
                },
                {
                    activityTitle: "**Description**",
                    text: monitorMessage,
                    facts: [
                        {
                            name: "Monitor",
                            value: monitorName,
                        },
                        {
                            name: "URL",
                            value: monitorUrl,
                        },
                    ],
                },
            ],
        };
    };

    _sendNotification = async (webhookUrl, payload) => {
        await axios.post(webhookUrl, payload);
    };

    _handleTestNotification = (webhookUrl) => {
        const payload = this._notificationPayloadFactory({
            monitorMessage: "Just a test",
            monitorName: "Test Notification",
            monitorUrl: "http://localhost:3000",
        });

        return this._sendNotification(webhookUrl, payload);
    };

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully. ";

        try {
            if (heartbeatJSON == null) {
                await this._handleTestNotification(notification.webhookUrl);
                return okMsg;
            }

            let url;

            if (monitorJSON["type"] === "port") {
                url = monitorJSON["hostname"];
                if (monitorJSON["port"]) {
                    url += ":" + monitorJSON["port"];
                }
            } else {
                url = monitorJSON["url"];
            }

            const payload = this._notificationPayloadFactory({
                monitorMessage: heartbeatJSON.msg || msg,
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
