const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Plivo extends NotificationProvider {
    name = "plivo";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let config = {
                headers: {
                    "Content-Type": "application/json",
                    Authorization:
                        "Basic " +
                        Buffer.from(notification.plivoAuthID + ":" + notification.plivoAuthToken).toString("base64"),
                },
                timeout: 10000,
            };
            config = this.getAxiosConfigWithProxy(config);

            const baseURL = `https://api.plivo.com/v1/Account/${notification.plivoAuthID}`;

            if (notification.plivoMessageType === "call") {
                const answerUrl = new URL(notification.plivoAnswerUrl);
                answerUrl.searchParams.set("message", msg);
                const data = {
                    from: notification.plivoFromNumber,
                    to: notification.plivoToNumber,
                    answer_url: answerUrl.toString(),
                    answer_method: "GET",
                };
                await axios.post(`${baseURL}/Call/`, data, config);
            } else {
                const data = {
                    src: notification.plivoFromNumber,
                    dst: notification.plivoToNumber,
                    text: msg,
                };
                await axios.post(`${baseURL}/Message/`, data, config);
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Plivo;
