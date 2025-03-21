const NotificationProvider = require("./notification-provider");
const { DOWN, UP } = require("../../src/util");
const { default: axios } = require("axios");
const Crypto = require("crypto");

class DingDing extends NotificationProvider {
    name = "DingDing";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            if (heartbeatJSON != null) {
                let params = {
                    msgtype: "markdown",
                    markdown: {
                        title: `[${this.statusToString(heartbeatJSON["status"])}] ${monitorJSON["name"]}`,
                        text: `## [${this.statusToString(heartbeatJSON["status"])}] ${monitorJSON["name"]} \n> ${heartbeatJSON["msg"]}\n> Time (${heartbeatJSON["timezone"]}): ${heartbeatJSON["localDateTime"]}`,
                    },
                    "at": {
                        "isAtAll": notification.mentioning === "everyone"
                    }
                };
                if (await this.sendToDingDing(notification, params)) {
                    return okMsg;
                }
            } else {
                let params = {
                    msgtype: "text",
                    text: {
                        content: msg
                    }
                };
                if (await this.sendToDingDing(notification, params)) {
                    return okMsg;
                }
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * Send message to DingDing
     * @param {BeanModel} notification Notification to send
     * @param {object} params Parameters of message
     * @returns {Promise<boolean>} True if successful else false
     */
    async sendToDingDing(notification, params) {
        let timestamp = Date.now();

        let config = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            url: `${notification.webHookUrl}&timestamp=${timestamp}&sign=${encodeURIComponent(this.sign(timestamp, notification.secretKey))}`,
            data: JSON.stringify(params),
        };

        let result = await axios(config);
        if (result.data.errmsg === "ok") {
            return true;
        }
        throw new Error(result.data.errmsg);
    }

    /**
     * DingDing sign
     * @param {Date} timestamp Timestamp of message
     * @param {string} secretKey Secret key to sign data with
     * @returns {string} Base64 encoded signature
     */
    sign(timestamp, secretKey) {
        return Crypto
            .createHmac("sha256", Buffer.from(secretKey, "utf8"))
            .update(Buffer.from(`${timestamp}\n${secretKey}`, "utf8"))
            .digest("base64");
    }

    /**
     * Convert status constant to string
     * @param {const} status The status constant
     * @returns {string} Status
     */
    statusToString(status) {
        switch (status) {
            case DOWN:
                return "DOWN";
            case UP:
                return "UP";
            default:
                return status;
        }
    }
}

module.exports = DingDing;
