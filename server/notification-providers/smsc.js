const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class SMSC extends NotificationProvider {
    name = "smsc";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = "https://smsc.kz/sys/send.php?";

        try {
            let config = {
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "text/json",
                }
            };

            let getArray = [
                "fmt=3",
                "translit=" + notification.smscTranslit,
                "login=" + notification.smscLogin,
                "psw=" + notification.smscPassword,
                "phones=" + notification.smscToNumber,
                "mes=" + encodeURIComponent(msg.replace(/[^\x00-\x7F]/g, "")),
            ];
            if (notification.smscSenderName !== "") {
                getArray.push("sender=" + notification.smscSenderName);
            }

            let resp = await axios.get(url + getArray.join("&"), config);
            if (resp.data.id === undefined) {
                let error = `Something gone wrong. Api returned code ${resp.data.error_code}: ${resp.data.error}`;
                this.throwGeneralAxiosError(error);
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = SMSC;
