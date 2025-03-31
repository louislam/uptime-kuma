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
            if (notification.smseagleApiType === "smseagle-apiv1") {
                let config = {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    }
                };

                let sendMethod;
                let recipientType;
                let duration, voice_id;

                if (notification.smseagleRecipientType === "smseagle-contact") {
                    recipientType = "contactname";
                    sendMethod = "/send_tocontact";
                } else if (notification.smseagleRecipientType === "smseagle-group") {
                    recipientType = "groupname";
                    sendMethod = "/send_togroup";
                } else if (notification.smseagleRecipientType === "smseagle-to") {
                    recipientType = "to";
                    sendMethod = "/send_sms";
                    if (notification.smseagleMsgType != "smseagle-sms") {
                        if (notification.smseagleDuration)
                            duration = notification.smseagleDuration;
                        else
                            duration = 10;

                        if (notification.smseagleMsgType == "smseagle-ring") {
                            sendMethod = "/ring_call";
                        } else if (notification.smseagleMsgType == "smseagle-tts") {
                            sendMethod = "/tts_call";
                        } else if (notification.smseagleMsgType == "smseagle-tts-advanced") {
                            sendMethod = "/tts_adv_call";
                            voice_id = notification.smseagleTtsModel ? notification.smseagleTtsModel : 1;
                        }
                    }
                }

                const url = new URL(notification.smseagleUrl + "/http_api" + sendMethod);

                url.searchParams.append('access_token', notification.smseagleToken);
                url.searchParams.append(recipientType, notification.smseagleRecipient);
                if (!["smseagle-ring", "smseagle-tts", "smseagle-tts-advanced"].includes(notification.smseagleRecipientType)) {
                    url.searchParams.append('unicode', (notification.smseagleEncoding) ? "1" : "0");
                    url.searchParams.append('highpriority', (notification.smseaglePriority) ? notification.smseaglePriority : "0");
                } else {
                    url.searchParams.append('duration', duration);
                }
                if (notification.smseagleRecipientType != "smseagle-ring") {
                    url.searchParams.append('message', msg);
                }
                if (voice_id) {
                    url.searchParams.append('voice_id', voice_id);
                }

                let resp = await axios.get(url.toString(), config);

                if (resp.data.indexOf("OK") === -1) {
                    let error = `SMSEagle API returned error: ${resp.data}`;
                    throw new Error(error);
                }

                return okMsg;
            } else if (notification.smseagleApiType === "smseagle-apiv2") {
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

                let endpoint = "/messages/sms";

                if (notification.smseagleMsgType != "smseagle-sms") {

                    let duration;
                    if (notification.smseagleDuration)
                        duration = notification.smseagleDuration
                    else
                        duration = 10;

                    postData["duration"] = duration;

                    if (notification.smseagleMsgType == "smseagle-ring") {
                        endpoint = "/calls/ring";
                    } else if (notification.smseagleMsgType == "smseagle-tts") {
                        endpoint = "/calls/tts";
                    } else if (notification.smseagleMsgType == "smseagle-tts-advanced") {
                        endpoint = "/calls/tts_advanced";
                        postData["voice_id"] = notification.smseagleTtsModel ? notification.smseagleTtsModel : "1";
                    }
                }

                let resp = await axios.post(notification.smseagleUrl + "/api/v2" + endpoint, postData, config);

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
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = SMSEagle;
