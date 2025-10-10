const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class ClickSendSMS extends NotificationProvider {
    name = "clicksendsms";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = "https://rest.clicksend.com/v3/sms/send";

        try {
            let config = {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Basic " + Buffer.from(notification.clicksendsmsLogin + ":" + notification.clicksendsmsPassword).toString("base64"),
                    "Accept": "text/json",
                }
            };
            let data = {
                messages: [
                    {
                        "body": msg.replace(/[^\x00-\x7F]/g, ""),
                        "to": notification.clicksendsmsToNumber,
                        "source": "uptime-kuma",
                        "from": notification.clicksendsmsSenderName,
                    }
                ]
            };
            config = this.getAxiosConfigWithProxy(config);
            let resp = await axios.post(url, data, config);
            if (resp.data.data.messages[0].status !== "SUCCESS") {
                let error = "Something gone wrong. Api returned " + resp.data.data.messages[0].status + ".";
                this.throwGeneralAxiosError(error);
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = ClickSendSMS;
