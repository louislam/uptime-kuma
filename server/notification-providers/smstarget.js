const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class SmsmTarget extends NotificationProvider {
    name = "Smsmtarget";

    /**
     * @param notification
     * @param msg
     * @param monitorJSON
     * @param heartbeatJSON
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        try {
            // 1. Authentification for the token as mentioned in docs
            const tokenResponse = await axios.get("https://api.mtarget.fr/gettoken?scope=sendsms", {
                headers: {
                    "X-API-KEY": notification.mTargetApiKey.trim(),
                    Accept: "application/json",
                },
            });

            const accessToken = tokenResponse.data.token?.access_token;

            const phone = (notification.mTargetNumber || "").replace(/\s+/g, "");

            // 3. sens sms
            const response = await axios.post(
                "https://api.mtarget.fr/messages",
                {
                    msg: msg,
                    msisdn: phone,
                    sender: notification.mTargetSender,
                    allowunicode: 1,
                },
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                }
            );

            if (response.data.results && response.data.results[0].code === "0") {
                return "SMS Envoyé avec succès !";
            } else {
                throw new Error("M-Target Rejection: " + response.data.results[0].reason);
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = SmsmTarget;
