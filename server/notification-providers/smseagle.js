const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class SMSEagle extends NotificationProvider {
    name = "SMSEagle";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let config = {
                headers: {
                    "access-token": notification.smseagleToken,
                    "Content-Type": "application/json",
                }
            };

            let postData;
            let recipientType;

            let encoding = (notification.smseagleEncoding) ? "unicode" : "standard";
            let priority = (notification.smseaglePriority) ? notification.smseaglePriority : 0;
            let recipientList = notification.smseagleRecipient.split(",");

            if (notification.smseagleRecipientType === "smseagle-contact") {
                recipientType = "contacts";
                recipientList = recipientList.map(e => {
                    return Number(e)
                });
            }
            if (notification.smseagleRecipientType === "smseagle-group") {
                recipientType = "groups";
                recipientList = recipientList.map(e => {
                    return Number(e)
                });
            }
            if (notification.smseagleRecipientType === "smseagle-to") {
                recipientType = "to";
            }

            postData = {
                [recipientType]: recipientList,
                text: msg,
                encoding: encoding,
                priority: priority
            };

            let resp = await axios.post(notification.smseagleUrl + "/api/v2/messages/sms", postData, config);

            let countAll = resp.data.length;
            let countQueued = resp.data.filter(x => x.status == "queued").length;

            if (resp.status !== 200 || countQueued == 0) {
                let error = "";
                if (resp.data.length > 0) {
                    error = `SMSEagle API returned error: ${JSON.stringify(resp.data)}`;
                } else {
                    error = "SMSEagle API returned an unexpected response";
                }
                throw new Error(error);
            }

            if (countAll !== countQueued) {
                let okWithErrorsMsg = "Sent " + countQueued + "/" + countAll + " Messages Successfully.";
                return okWithErrorsMsg;
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = SMSEagle;
