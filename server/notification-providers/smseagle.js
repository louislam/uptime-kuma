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

            let encoding = (notification.smseagleEncoding) ? "unicode" : "standard";
            let priority = (notification.smseaglePriority) ? notification.smseaglePriority : 0;

            let postData = {
                text: msg,
                encoding: encoding,
                priority: priority
            };

            let to = notification.smseagleRecipientTo;
            let contacts = notification.smseagleRecipientContact;
            let groups = notification.smseagleRecipientGroup;
            console.log("b", to, contacts, groups);

            if (contacts) {
                contacts = contacts.split(",");
                contacts = contacts.map(e => {
                    return Number(e)
                });
                postData["contacts"] = contacts;
            }

            if (groups) {
                groups = groups.split(",");
                groups = groups.map(e => {
                    return Number(e)
                });
                postData["groups"] = groups;
            }

            if (to) {
                to = to.split(",");
                postData["to"] = to;
            }

            console.log(postData);

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
