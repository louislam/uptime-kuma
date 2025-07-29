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
            if (notification.smseagleApiType === "smseagle-apiv1") { // according to https://www.smseagle.eu/apiv1/
                let config = {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    }
                };

                let sendMethod;
                let recipientType;
                let duration;
                let voiceId;

                if (notification.smseagleRecipientType === "smseagle-contact") {
                    recipientType = "contactname";
                    sendMethod = "/send_tocontact";
                } else if (notification.smseagleRecipientType === "smseagle-group") {
                    recipientType = "groupname";
                    sendMethod = "/send_togroup";
                } else if (notification.smseagleRecipientType === "smseagle-to") {
                    recipientType = "to";
                    sendMethod = "/send_sms";
                    if (notification.smseagleMsgType !== "smseagle-sms") {
                        duration = notification.smseagleDuration ?? 10;

                        if (notification.smseagleMsgType === "smseagle-ring") {
                            sendMethod = "/ring_call";
                        } else if (notification.smseagleMsgType === "smseagle-tts") {
                            sendMethod = "/tts_call";
                        } else if (notification.smseagleMsgType === "smseagle-tts-advanced") {
                            sendMethod = "/tts_adv_call";
                            voiceId = notification.smseagleTtsModel ? notification.smseagleTtsModel : 1;
                        }
                    }
                }

                const url = new URL(notification.smseagleUrl + "/http_api" + sendMethod);

                url.searchParams.append("access_token", notification.smseagleToken);
                url.searchParams.append(recipientType, notification.smseagleRecipient);
                if (!notification.smseagleRecipientType || notification.smseagleRecipientType === "smseagle-sms") {
                    url.searchParams.append("unicode", (notification.smseagleEncoding) ? "1" : "0");
                    url.searchParams.append("highpriority", notification.smseaglePriority ?? "0");
                } else {
                    url.searchParams.append("duration", duration);
                }
                if (notification.smseagleRecipientType !== "smseagle-ring") {
                    url.searchParams.append("message", msg);
                }
                if (voiceId) {
                    url.searchParams.append("voice_id", voiceId);
                }

                let resp = await axios.get(url.toString(), config);

                if (resp.data.indexOf("OK") === -1) {
                    let error = `SMSEagle API returned error: ${resp.data}`;
                    throw new Error(error);
                }

                return okMsg;
            } else if (notification.smseagleApiType === "smseagle-apiv2") { // according to https://www.smseagle.eu/docs/apiv2/
                let config = {
                    headers: {
                        "access-token": notification.smseagleToken,
                        "Content-Type": "application/json",
                    }
                };

                let encoding = (notification.smseagleEncoding) ? "unicode" : "standard";
                let priority = (notification.smseaglePriority) ?? 0;

                let postData = {
                    text: msg,
                    encoding: encoding,
                    priority: priority
                };

                if (notification.smseagleRecipientContact) {
                    postData["contacts"] = notification.smseagleRecipientContact.split(",").map(Number);
                }
                if (notification.smseagleRecipientGroup) {
                    postData["groups"] = notification.smseagleRecipientGroup.split(",").map(Number);
                }
                if (notification.smseagleRecipientTo) {
                    postData["to"] = notification.smseagleRecipientTo.split(",");
                }

                let endpoint = "/messages/sms";

                if (notification.smseagleMsgType !== "smseagle-sms") {

                    postData["duration"] = notification.smseagleDuration ?? 10;

                    if (notification.smseagleMsgType === "smseagle-ring") {
                        endpoint = "/calls/ring";
                    } else if (notification.smseagleMsgType === "smseagle-tts") {
                        endpoint = "/calls/tts";
                    } else if (notification.smseagleMsgType === "smseagle-tts-advanced") {
                        endpoint = "/calls/tts_advanced";
                        postData["voice_id"] = notification.smseagleTtsModel ?? 1;
                    }
                }

                let resp = await axios.post(notification.smseagleUrl + "/api/v2" + endpoint, postData, config);

                const queuedCount = resp.data.filter(x => x.status === "queued").length;
                const unqueuedCount = resp.data.length - queuedCount;

                if (resp.status !== 200 || queuedCount === 0) {
                    if (!resp.data.length) {
                        throw new Error("SMSEagle API returned an empty response");
                    }
                    throw new Error(`SMSEagle API returned error: ${JSON.stringify(resp.data)}`);
                }

                if (unqueuedCount) {
                    return `Sent ${queuedCount}/${resp.data.length} Messages Successfully.`;
                }

                return okMsg;
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = SMSEagle;
