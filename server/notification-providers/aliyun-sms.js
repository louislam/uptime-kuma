const NotificationProvider = require("./notification-provider");
const { DOWN, UP } = require("../../src/util");
const { default: axios } = require("axios");
const Crypto = require("crypto");
const qs = require("qs");

class AliyunSMS extends NotificationProvider {
    name = "AliyunSMS";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            if (heartbeatJSON != null) {
                let msgBody = JSON.stringify({
                    name: monitorJSON["name"],
                    time: heartbeatJSON["localDateTime"],
                    status: this.statusToString(heartbeatJSON["status"]),
                    ...(notification.optionalParameters && {
                        msg: this.removeIpAndDomain(heartbeatJSON["msg"]),
                    }),
                });
                if (await this.sendSms(notification, msgBody)) {
                    return okMsg;
                }
            } else {
                let msgBody = JSON.stringify({
                    name: "",
                    time: "",
                    status: "",
                    ...(notification.optionalParameters && {
                        msg: this.removeIpAndDomain(msg),
                    }),
                });
                if (await this.sendSms(notification, msgBody)) {
                    return okMsg;
                }
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * Send the SMS notification
     * @param {BeanModel} notification Notification details
     * @param {string} msgbody Message template
     * @returns {Promise<boolean>} True if successful else false
     */
    async sendSms(notification, msgbody) {
        let params = {
            PhoneNumbers: notification.phonenumber,
            TemplateCode: notification.templateCode,
            SignName: notification.signName,
            TemplateParam: msgbody,
            AccessKeyId: notification.accessKeyId,
            Format: "JSON",
            SignatureMethod: "HMAC-SHA1",
            SignatureVersion: "1.0",
            SignatureNonce: Math.random().toString(),
            Timestamp: new Date().toISOString(),
            Action: "SendSms",
            Version: "2017-05-25",
        };

        params.Signature = this.sign(params, notification.secretAccessKey);
        let config = {
            method: "POST",
            url: "http://dysmsapi.aliyuncs.com/",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data: qs.stringify(params),
        };

        config = this.getAxiosConfigWithProxy(config);

        let result = await axios(config);
        if (result.data.Message === "OK") {
            return true;
        }

        throw new Error(result.data.Message);
    }

    /**
     * Aliyun request sign
     * @param {object} param Parameters object to sign
     * @param {string} AccessKeySecret Secret key to sign parameters with
     * @returns {string} Base64 encoded request
     */
    sign(param, AccessKeySecret) {
        let param2 = {};
        let data = [];

        let oa = Object.keys(param).sort();

        for (let i = 0; i < oa.length; i++) {
            let key = oa[i];
            param2[key] = param[key];
        }

        // Escape more characters than encodeURIComponent does.
        // For generating Aliyun signature, all characters except A-Za-z0-9~-._ are encoded.
        // See https://help.aliyun.com/document_detail/315526.html
        // This encoding methods as known as RFC 3986 (https://tools.ietf.org/html/rfc3986)
        let moreEscapesTable = function (m) {
            return {
                "!": "%21",
                "*": "%2A",
                "'": "%27",
                "(": "%28",
                ")": "%29",
            }[m];
        };

        for (let key in param2) {
            let value = encodeURIComponent(param2[key]).replace(/[!*'()]/g, moreEscapesTable);
            data.push(`${encodeURIComponent(key)}=${value}`);
        }

        let StringToSign = `POST&${encodeURIComponent("/")}&${encodeURIComponent(data.join("&"))}`;
        return Crypto.createHmac("sha1", `${AccessKeySecret}&`).update(Buffer.from(StringToSign)).digest("base64");
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

    /**
     * Remove IP addresses and domains from message to comply with Aliyun SMS restrictions
     * @param {string} message Original message
     * @returns {string} Message with IP addresses and domains removed
     */
    removeIpAndDomain(message) {
        if (!message) {
            return message;
        }

        // 1. Remove URLs first to avoid domain being matched separately
        message = message.replace(/(?:https?|ftp|ws|wss):\/\/[^\s]+/gi, "[URL]");

        // 2. Remove IPv4 addresses (with or without port)
        message = message.replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, "[IP]");

        // 3. Remove IPv6 addresses (with or without port)
        message = message.replace(/\[?(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\]?(?::\d+)?/g, "[IP]");

        // 4. Remove domain names (including subdomains and ports)
        // Matches example.com, www.example.com, sub.example.com:8080, etc.
        message = message.replace(
            /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(?::\d+)?\b/g,
            "[Domain]"
        );

        // 5. Remove CIDR notation (e.g., 192.168.0.0/24)
        message = message.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\/\d{1,2}\b/g, "[CIDR]");

        return message;
    }
}

module.exports = AliyunSMS;
