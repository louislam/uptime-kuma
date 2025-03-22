const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class PushPlusPlus extends NotificationProvider {
    name = "PushPlusPlus";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = `https://pushplus.plus/send`;
        try {
            await axios.post(notification.pushPlusPlusToken, {
                "title": this.checkStatus(heartbeatJSON, monitorJSON),
                "content": msg,
            });

            return okMsg;

        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * Get the formatted title for message
     * @param {?object} heartbeatJSON Heartbeat details (For Up/Down only)
     * @param {?object} monitorJSON Monitor details (For Up/Down only)
     * @returns {string} Formatted title
     */
    checkStatus(heartbeatJSON, monitorJSON) {
        let title = "UptimeKuma Message";
        if (heartbeatJSON != null && heartbeatJSON["status"] === UP) {
            title = "UptimeKuma Monitor Up " + monitorJSON["name"];
        }
        if (heartbeatJSON != null && heartbeatJSON["status"] === DOWN) {
            title = "UptimeKuma Monitor Down " + monitorJSON["name"];
        }
        return title;
    }
}

module.exports = PushPlusPlus;