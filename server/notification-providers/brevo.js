const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Brevo extends NotificationProvider {
    name = "Brevo";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let config = {
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "api-key": notification.brevoApiKey,
                },
            };
            config = this.getAxiosConfigWithProxy(config);

            let to = [{ email: notification.brevoToEmail }];

            let data = {
                sender: {
                    email: notification.brevoFromEmail.trim(),
                    name: notification.brevoFromName || "Uptime Kuma"
                },
                to: to,
                subject: notification.brevoSubject || "Notification from Your Uptime Kuma",
                htmlContent: `<html><head></head><body><p>${msg.replace(/\n/g, "<br>")}</p></body></html>`
            };

            if (notification.brevoCcEmail) {
                data.cc = notification.brevoCcEmail
                    .split(",")
                    .map((email) => ({ email: email.trim() }));
            }

            if (notification.brevoBccEmail) {
                data.bcc = notification.brevoBccEmail
                    .split(",")
                    .map((email) => ({ email: email.trim() }));
            }

            let result = await axios.post(
                "https://api.brevo.com/v3/smtp/email",
                data,
                config
            );
            if (result.status === 201) {
                return okMsg;
            } else {
                throw new Error(`Unexpected status code: ${result.status}`);
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Brevo;
