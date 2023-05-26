const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Twilio extends NotificationProvider {

    name = "twilio";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {

        let okMsg = "Sent Successfully.";

        let accountSID = notification.twilioAccountSID;
        let authToken = notification.twilioAuthToken;

        try {

            let config = {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
                    "Authorization": "Basic " + Buffer.from(accountSID + ":" + authToken).toString("base64"),
                }
            };

            let data = new URLSearchParams();
            data.append("To", notification.twilioToNumber);
            data.append("From", notification.twilioFromNumber);
            data.append("Body", msg);

            let url = "https://api.twilio.com/2010-04-01/Accounts/" + accountSID + "/Messages.json";

            await axios.post(url, data, config);

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

}

module.exports = Twilio;
