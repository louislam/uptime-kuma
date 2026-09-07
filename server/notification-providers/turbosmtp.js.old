const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class TurboSMTP extends NotificationProvider {
    name = "TurboSMTP";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let config = {
                headers: {
                    "Content-Type": "application/json",
                    consumerKey: notification.turbosmtpConsumerKey,
                    consumerSecret: notification.turbosmtpConsumerSecret,
                },
            };
            config = this.getAxiosConfigWithProxy(config);

            const host = notification.turbosmtpRegion === "eu" ? "api.eu.turbo-smtp.com" : "api.turbo-smtp.com";

            let data = {
                from: notification.turbosmtpFromEmail.trim(),
                to: notification.turbosmtpToEmail,
                subject: notification.turbosmtpSubject || "Notification from Your Uptime Kuma",
                content: msg,
            };

            // Comma-separated lists, same format as "to"
            if (notification.turbosmtpCcEmail) {
                data.cc = notification.turbosmtpCcEmail
                    .split(",")
                    .map((email) => email.trim())
                    .join(",");
            }

            if (notification.turbosmtpBccEmail) {
                data.bcc = notification.turbosmtpBccEmail
                    .split(",")
                    .map((email) => email.trim())
                    .join(",");
            }

            await axios.post(`https://${host}/api/v2/mail/send`, data, config);
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = TurboSMTP;
