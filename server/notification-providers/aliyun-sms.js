const NotificationProvider = require("./notification-provider");
const { DOWN, UP } = require("../../src/util");
const { default: axios } = require("axios");
const Crypto = require("crypto");
const qs = require("qs");

class AliyunSMS extends NotificationProvider {
    name = "AliyunSMS";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

        try {
            if (heartbeatJSON != null) {
                let msgBody = JSON.stringify({
                    name: monitorJSON["name"],
                    time: heartbeatJSON["time"],
                    status: this.statusToString(heartbeatJSON["status"]),
                    msg: heartbeatJSON["msg"],
                });
                if (this.sendSms(notification, msgBody)) {
                    return okMsg;
                }
            } else {
                let msgBody = JSON.stringify({
                    name: "",
                    time: "",
                    status: "",
                    msg: msg,
                });
                if (this.sendSms(notification, msgBody)) {
                    return okMsg;
                }
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

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

        let result = await axios(config);
        if (result.data.Message === "OK") {
            return true;
        }
        return false;
    }

    /** Aliyun request sign */
    sign(param, AccessKeySecret) {
        let param2 = {};
        let data = [];

        let oa = Object.keys(param).sort();

        for (let i = 0; i < oa.length; i++) {
            let key = oa[i];
            param2[key] = param[key];
        }

        for (let key in param2) {
            data.push(`${encodeURIComponent(key)}=${encodeURIComponent(param2[key])}`);
        }

        let StringToSign = `POST&${encodeURIComponent("/")}&${encodeURIComponent(data.join("&"))}`;
        return Crypto
            .createHmac("sha1", `${AccessKeySecret}&`)
            .update(Buffer.from(StringToSign))
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

module.exports = AliyunSMS;
