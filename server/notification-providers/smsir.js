const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class SMSIR extends NotificationProvider {
    name = "smsir";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = "https://api.sms.ir/v1/send/verify";

        try {
            let config = {
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "X-API-Key": notification.smsirApiKey
                }
            };
            config = this.getAxiosConfigWithProxy(config);

            let formattedMobile = notification.smsirNumber;
            if (formattedMobile.length === 11 && formattedMobile.startsWith("09") && String(parseInt(formattedMobile)) === formattedMobile.substring(1)) {
                // 09xxxxxxxxx Format
                formattedMobile = formattedMobile.substring(1);
            }

            await axios.post(
                url,
                {
                    mobile: formattedMobile,
                    templateId: parseInt(notification.smsirTemplate),
                    parameters: [
                        {
                            name: "uptkumaalert",
                            value: msg
                        }
                    ]
                },
                config
            );

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = SMSIR;
