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
        return "Notification";
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

        const facts = [];

        if (monitorName) {
            facts.push({
                name: "Monitor",
                value: monitorName,
            });
        }

        if (monitorUrl) {
            facts.push({
                name: "URL",
                value: monitorUrl,
            });
        }

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
                    facts,
                },
            ],
        };
    };

    _sendNotification = async (webhookUrl, payload) => {
        await axios.post(webhookUrl, payload);
    };

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

            if (monitorJSON["type"] === "port") {
                url = monitorJSON["hostname"];
                if (monitorJSON["port"]) {
                    url += ":" + monitorJSON["port"];
                }
            } else {
                url = monitorJSON["url"];
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
