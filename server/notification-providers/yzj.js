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
            if (heartbeatJSON !== null) {
                msg = `${this.statusToString(heartbeatJSON["status"])} ${monitorJSON["name"]} \n> ${heartbeatJSON["msg"]}\n> Time (${heartbeatJSON["timezone"]}): ${heartbeatJSON["localDateTime"]}`;
            }

            const config = {
                headers: {
                    "Content-Type": "application/json",
                },
            };
            const params = {
                content: msg
            };
            // yzjtype=0 => general robot
            const url = `${notification.yzjWebHookUrl}?yzjtype=0&yzjtoken=${notification.yzjToken}`;

            const result = await axios.post(url, params, config);
            if (!result.data?.success) {
                throw new Error(result.data?.errmsg ?? "yzj's server did not respond with the expected result");
            }
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
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
