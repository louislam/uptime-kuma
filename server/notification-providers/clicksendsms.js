const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class ClickSendSMS extends NotificationProvider {

    name = "clicksendsms";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";
        try {
            console.log({ notification });
            let config = {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Basic " + Buffer.from(notification.clicksendsmsLogin + ":" + notification.clicksendsmsPassword).toString('base64'),
                    "Accept": "text/json",
                }
            };
            let data = {
                messages: [
                    {
                        "body": msg.replace(/[^\x00-\x7F]/g, ""),
                        // TODO: To phone number concept to be added
                        "to": "+61411111111",
                        "source": "uptime-kuma",
                        "from": notification.clicksendsmsSenderName,
                    }
                ]
            };
            let resp = await axios.post("https://rest.clicksend.com/v3/sms/send", data, config);
            if (resp.data.http_code !== 200) {
                let error = "Something gone wrong. Api returned " + resp.data.response.status + ".";
                this.throwGeneralAxiosError(error);
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = ClickSendSMS;
