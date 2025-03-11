const NotificationProvider = require("./notification-provider");
const { DOWN, UP } = require("../../src/util");
const { default: axios } = require("axios");

class YZJ extends NotificationProvider {
    name = "YZJ";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

        try {

            if (heartbeatJSON != null) {
                msg = `${this.statusToString(heartbeatJSON["status"])} ${monitorJSON["name"]} \n> ${heartbeatJSON["msg"]}\n> Time (${heartbeatJSON["timezone"]}): ${heartbeatJSON["localDateTime"]}`
            }

            let params = {
                content: msg
            };

            if (await this.sendToYZJ(notification, params)) {
                return okMsg;
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * Send message to YZJ
     * @param {object} notification Notification
     * @param {object} params Parameters of message
     * @returns {boolean} True if successful else false
     */
    async sendToYZJ(notification, params) {

        let config = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            url: `${notification.yzjWebHookUrl}?yzjtype=${notification.yzjType}&yzjtoken=${notification.yzjToken}`,
            data: JSON.stringify(params),
        };

        let result = await axios(config);
        if (!result.data?.success) {
            throw new Error(result.data?.errmsg);
        }
    }

    /**
     * Convert status constant to string
     * @param {string} status The status constant
     * @returns {string} status
     */
    statusToString(status) {
        switch (status) {
            case DOWN:
                return "❌";
            case UP:
                return "✅";
            default:
                return status;
        }
    }
}

module.exports = YZJ;
