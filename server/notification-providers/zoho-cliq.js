const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class ZohoCliq extends NotificationProvider {
    name = "ZohoCliq";

    /**
     * Generate the message to send
     * @param {const} status The status constant
     * @param {string} monitorName Name of monitor
     * @returns {string} Status message
     */
    _statusMessageFactory = (status, monitorName) => {
        if (status === DOWN) {
            return `🔴 Application [${monitorName}] went down\n`;
        } else if (status === UP) {
            return `✅ Application [${monitorName}] is back online\n`;
        }
        return "Notification\n";
    };

    /**
     * Send the notification
     * @param {string} webhookUrl URL to send the request to
     * @param {Array} payload Payload generated by _notificationPayloadFactory
     * @returns {Promise<void>}
     */
    _sendNotification = async (webhookUrl, payload) => {
        await axios.post(webhookUrl, { text: payload.join("\n") });
    };

    /**
     * Generate payload for notification
     * @param {object} args Method arguments
     * @param {const} args.status The status of the monitor
     * @param {string} args.monitorMessage Message to send
     * @param {string} args.monitorName Name of monitor affected
     * @param {string} args.monitorUrl URL of monitor affected
     * @returns {Array} Notification payload
     */
    _notificationPayloadFactory = ({
        status,
        monitorMessage,
        monitorName,
        monitorUrl,
    }) => {
        const payload = [];
        payload.push("### Up_Or_Down\n");
        payload.push(this._statusMessageFactory(status, monitorName));
        payload.push(`*Description:* ${monitorMessage}`);

        if (monitorName) {
            payload.push(`*Monitor:* ${monitorName}`);
        }

        if (monitorUrl && monitorUrl !== "https://") {
            payload.push(`*URL:* [${monitorUrl}](${monitorUrl})`);
        }

        return payload;
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
        const okMsg = "Sent Successfully.";

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
                status: heartbeatJSON.status
            });

            await this._sendNotification(notification.webhookUrl, payload);
            return okMsg;

        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = ZohoCliq;
