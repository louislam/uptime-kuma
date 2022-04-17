const NotificationProvider = require("./notification-provider");
const { DOWN, UP } = require("../../src/util");
const { default: axios } = require("axios");
const Crypto = require("crypto");

class DingDing extends NotificationProvider {
    name = "DingDing";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

        try {
            if (heartbeatJSON != null) {
                let params = {
                    msgtype: "markdown",
                    markdown: {
                        title: `[${this.statusToString(heartbeatJSON["status"])}] ${monitorJSON["name"]}`,
                        text: `## [${this.statusToString(heartbeatJSON["status"])}] ${monitorJSON["name"]} \n > ${heartbeatJSON["msg"]}  \n > Time(UTC):${heartbeatJSON["time"]}`,
                    }
                };
                if (this.sendToDingDing(notification, params)) {
                    return okMsg;
                }
            } else {
                let params = {
                    msgtype: "text",
                    text: {
                        content: msg
                    }
                };
                if (this.sendToDingDing(notification, params)) {
                    return okMsg;
                }
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

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
        return false;
    }

    /** DingDing sign */
    sign(timestamp, secretKey) {
        return Crypto
            .createHmac("sha256", Buffer.from(secretKey, "utf8"))
            .update(Buffer.from(`${timestamp}\n${secretKey}`, "utf8"))
            .digest("base64");
    }

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
