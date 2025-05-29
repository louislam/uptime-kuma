const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class SendGrid extends NotificationProvider {
    name = "SendGrid";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            let config = {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${notification.sendgridApiKey}`,
                },
            };

            let personalizations = {
                to: [{ email: notification.sendgridToEmail }],
            };

            // Add CC recipients if provided
            if (notification.sendgridCcEmail) {
                personalizations.cc = notification.sendgridCcEmail
                    .split(",")
                    .map((email) => ({ email: email.trim() }));
            }

            // Add BCC recipients if provided
            if (notification.sendgridBccEmail) {
                personalizations.bcc = notification.sendgridBccEmail
                    .split(",")
                    .map((email) => ({ email: email.trim() }));
            }

            let data = {
                personalizations: [ personalizations ],
                from: { email: notification.sendgridFromEmail.trim() },
                subject:
          notification.sendgridSubject ||
          "Notification from Your Uptime Kuma",
                content: [
                    {
                        type: "text/plain",
                        value: msg,
                    },
                ],
            };

            await axios.post(
                "https://api.sendgrid.com/v3/mail/send",
                data,
                config
            );
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = SendGrid;
