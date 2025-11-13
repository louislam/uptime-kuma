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

            const formattedMobiles = notification.smsirNumber
                .split(",")
                .map(mobile => {
                    if (mobile.length === 11 && mobile.startsWith("09") && String(parseInt(mobile)) === mobile.substring(1)) {
                        // 09xxxxxxxxx Format
                        return mobile.substring(1);
                    }

                    return mobile;
                });

            // Run multiple network requests at once
            const requestPromises = formattedMobiles
                .map(mobile => {
                    axios.post(
                        url,
                        {
                            mobile: mobile,
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
                });

            await Promise.all(requestPromises);

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = SMSIR;
