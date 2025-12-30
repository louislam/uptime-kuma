const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Resend extends NotificationProvider {
    name = "Resend";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let config = {
                headers: {
                    Authorization: `Bearer ${notification.resendApiKey}`,
                    "Content-Type": "application/json",
                },
            };
            config = this.getAxiosConfigWithProxy(config);
            const email = notification.resendFromEmail.trim();

            const fromName = notification.resendFromName?.trim()
                ? notification.resendFromName.trim()
                : "Uptime Kuma";
            let data = {
                from: `${fromName} <${email}>`,
                to: notification.resendToEmail,
                subject: notification.resendSubject || "Notification from Your Uptime Kuma",
                html: `<html><head></head><body><p>${msg.replace(/\n/g, "<br>")}</p></body></html>`
            };

            let result = await axios.post(
                "https://api.resend.com/emails",
                data,
                config
            );
            if (result.status === 200) {
                return okMsg;
            } else {
                throw new Error(`Unexpected status code: ${result.status}`);
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Resend;
