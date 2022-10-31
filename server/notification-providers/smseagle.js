const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class SMSEagle extends NotificationProvider {

    name = "SMSEagle";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

        try {
            let config = {
                headers: {
                    "Content-Type": "application/json",
                }
            };

            let postData;
            let sendMethod;
            let recipientType;

            let encoding = (notification.smseagleEncoding) ? "1" : "0";
            let priority = (notification.smseaglePriority) ? notification.smseaglePriority : "0";

            if (notification.smseagleRecipientType === "smseagle-contact") {
                recipientType = "contactname";
                sendMethod = "sms.send_tocontact";
            }
            if (notification.smseagleRecipientType === "smseagle-group") {
                recipientType = "groupname";
                sendMethod = "sms.send_togroup";
            }
            if (notification.smseagleRecipientType === "smseagle-to") {
                recipientType = "to";
                sendMethod = "sms.send_sms";
            }

            let params = {
                access_token: notification.smseagleToken,
                [recipientType]: notification.smseagleRecipient,
                message: msg,
                responsetype: "extended",
                unicode: encoding,
                highpriority: priority
            };

            postData = {
                method: sendMethod,
                params: params
            };

            let resp = await axios.post(notification.smseagleUrl + "/jsonrpc/sms", postData, config);

            if ((JSON.stringify(resp.data)).indexOf("message_id") === -1) {
                let error = "";
                if (resp.data.result && resp.data.result.error_text) {
                    error = `SMSEagle API returned error: ${JSON.stringify(resp.data.result.error_text)}`;
                } else {
                    error = "SMSEagle API returned an unexpected response";
                }
                throw new Error(error);
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = SMSEagle;
