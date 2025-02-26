const NotificationProvider = require("./notification-provider");
const { DOWN } = require("../../src/util");
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
            let message = notification.messageTemplate || msg;
            const emailTemplateID = notification.emailTemplateId;
            const smsTemplateID = notification.smsTemplateId;

            const notifyClient = new NotifyClient(apiKey);

            let subject = "⚠️ Test";

            if (heartbeatJSON !== null) {
                subject = (heartbeatJSON["status"] === DOWN) ? "🔴 Down" : "✅ Up";
            }

            const date = new Date();
            const day = date.getDate();
            const month = date.getMonth() + 1;
            const year = date.getFullYear();
            const hours = date.getHours();
            const minutes = date.getMinutes();

            const readableDate = `GMT ${day}/${month}/${year} ${hours}:${minutes}`;
            message += `\n${readableDate}`;

            // Send Emails
            for (const email of emailRecipients) {
                await notifyClient.sendEmail(
                    emailTemplateID,
                    email,
                    {
                        personalisation: {
                            message,
                            subject,
                        },
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
