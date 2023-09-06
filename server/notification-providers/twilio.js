const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Twilio extends NotificationProvider {
    name = "twilio";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        let apiKey = notification.twilioApiKey ? notification.twilioApiKey : notification.twilioAccountSID;

        try {
            let config = {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
                    "Authorization": "Basic " + Buffer.from(apiKey + ":" + notification.twilioAuthToken).toString("base64"),
                }
            };

            let data = new URLSearchParams();
            data.append("To", notification.twilioToNumber);
            data.append("From", notification.twilioFromNumber);
            data.append("Body", msg);

            await axios.post(`https://api.twilio.com/2010-04-01/Accounts/${(notification.twilioAccountSID)}/Messages.json`, data, config);

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

}

module.exports = Twilio;
