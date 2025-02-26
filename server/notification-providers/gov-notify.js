const NotificationProvider = require("./notification-provider");
const NotifyClient = require("notifications-node-client").NotifyClient;

class GovNotify extends NotificationProvider {
    name = "GovNotify";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        try {
            const apiKey = notification.apiKey;
            const emailRecipients = (typeof notification.emailRecipients === "string" && notification.emailRecipients.trim())
                ? notification.emailRecipients.split(",").map(e => e.trim()).filter(e => e)
                : [];
            const smsRecipients = (typeof notification.smsRecipients === "string" && notification.smsRecipients.trim())
                ? notification.smsRecipients.split(",").map(n => n.trim()).filter(n => n)
                : [];
            const message = notification.messageTemplate || msg;
            const emailTemplateID = notification.emailTemplateId;
            const smsTemplateID = notification.smsTemplateId;

            const notifyClient = new NotifyClient(apiKey);

            // Send Emails
            for (const email of emailRecipients) {
                await notifyClient.sendEmail(
                    emailTemplateID,
                    email,
                    {
                        personalisation: { message },
                        reference: "Uptime-Kuma"
                    });
            }

            // Send SMS
            for (const number of smsRecipients) {
                await notifyClient.sendSms(
                    smsTemplateID,
                    number,
                    {
                        personalisation: { message },
                        reference: "Uptime-Kuma"
                    });
            }

            return "Notification sent successfully";
        } catch (error) {
            console.error("GovNotify Error:", error.response ? error.response.data : error.message);
            throw new Error("Failed to send notification via GOV Notify");
        }
    }
}

module.exports = GovNotify;
