const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { UP, DOWN } = require("../../src/util");

class HostedSMS extends NotificationProvider {

    name = "hostedsms";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

        try {
            let config = {
                headers: {
                    "Content-Type": "application/json",
                }
            };

            let textMsg = "";
            if (heartbeatJSON && heartbeatJSON.status === UP) {
                textMsg = `✅ [${monitorJSON.name}] is back online`;
            } else {
                textMsg = `🔴 [${monitorJSON.name}] went down`;
            }

            let data = {
                "UserEmail": notification.hostedsmsUsername,
                "Password": notification.hostedsmsPassword,
                "Phone": notification.hostedsmsPhoneNumber,
                "Message": textMsg,
                "Sender": notification.hostedsmsSenderName,
            };

            let resp = await axios.post("https://api.hostedsms.pl/SimpleApi", data, config);

            if (!resp.data.MessageId) {
                const errorMessage = resp.data.ErrorMessage ? `error message: ${resp.data.ErrorMessage}` : "an unexpected response";
                this.throwGeneralAxiosError(`HostedSMS.pl API returned ${errorMessage}`);
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = HostedSMS;
