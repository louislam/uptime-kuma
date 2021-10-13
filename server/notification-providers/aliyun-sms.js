const NotificationProvider = require("./notification-provider");
const { DOWN, UP } = require("../../src/util");
const Core = require("@alicloud/pop-core");

class AliyunSMS extends NotificationProvider {
    name = "AliyunSMS";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

        try {
            var client = new Core({
                accessKeyId: notification.accessKeyId,
                accessKeySecret: notification.secretAccessKey,
                endpoint: "https://dysmsapi.aliyuncs.com",
                apiVersion: "2017-05-25",
            });

            var params = {
                PhoneNumbers: notification.phonenumber,
                TemplateCode: notification.templateCode,
                SignName: notification.signName,
                TemplateParam: JSON.stringify({
                    name: "",
                    time: "",
                    status: "",
                    msg: msg,
                }),
            };

            if (heartbeatJSON != null) {
                params.TemplateParam = JSON.stringify({
                    name: monitorJSON["name"],
                    time: heartbeatJSON["time"],
                    status: this.statusToString(heartbeatJSON["status"]),
                    msg: heartbeatJSON["msg"],
                });
            }

            var requestOption = {
                method: "POST",
            };

            await client.request("SendSms", params, requestOption).then(
                (result) => {
                    console.log(JSON.stringify(result));
                    return okMsg;
                },
                (ex) => {
                    console.log(ex);
                }
            );
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
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
