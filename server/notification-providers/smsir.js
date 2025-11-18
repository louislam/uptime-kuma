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

            /**
             * @type {string}
             */
            let formattedMessage = msg;
            const MAX_MESSAGE_LENGTH = 25; // This is a limitation placed by SMSIR
            const SHORTEN_EDNING_STRING = "..."; // What to add to the end of a shortened string

            if (formattedMessage.length > MAX_MESSAGE_LENGTH) {
                // Shorten By removing spaces, keeping context is better than cutting off the text
                formattedMessage = formattedMessage.replace(/\s/g, "");
            }

            if (formattedMessage.length > MAX_MESSAGE_LENGTH) {
                // Cut off the text. Still better than not receiving an SMS
                formattedMessage = formattedMessage.substring(0, MAX_MESSAGE_LENGTH - 1 - SHORTEN_EDNING_STRING.length) + SHORTEN_EDNING_STRING;
            }

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
                                    value: formattedMessage
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
