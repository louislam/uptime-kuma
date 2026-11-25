const NotificationProvider = require("./notification-provider");
const axios = require("axios");

const LEGACY_DEFAULT_SUBJECT = "Notification from Your Uptime Kuma";

class Brevo extends NotificationProvider {
    name = "Brevo";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        let subject = msg;
        let body = msg;
        let useHTMLBody = false;
        if (heartbeatJSON) {
            body = `${msg}\nTime (${heartbeatJSON["timezone"]}): ${heartbeatJSON["localDateTime"]}`;
        }

        const legacySubject = notification.brevoSubject?.trim() || "";
        if (legacySubject !== "" && legacySubject !== LEGACY_DEFAULT_SUBJECT) {
            subject = legacySubject;
        }

        if ((monitorJSON && heartbeatJSON) || msg.endsWith("Testing")) {
            const customSubject = notification.customSubject?.trim() || "";
            const customBody = notification.customBody?.trim() || "";
            if (customSubject !== "") {
                subject = await this.renderTemplate(customSubject, msg, monitorJSON, heartbeatJSON);
            }
            if (customBody !== "") {
                useHTMLBody = notification.htmlBody || false;
                body = await this.renderTemplate(customBody, msg, monitorJSON, heartbeatJSON);
            }
        }

        try {
            let config = {
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                    "api-key": notification.brevoApiKey,
                },
            };
            config = this.getAxiosConfigWithProxy(config);

            let to = [{ email: notification.brevoToEmail }];

            let data = {
                sender: {
                    email: notification.brevoFromEmail.trim(),
                    name: notification.brevoFromName || "Uptime Kuma",
                },
                to: to,
                subject: subject,
                [useHTMLBody ? "htmlContent" : "textContent"]: body,
            };

            if (notification.brevoCcEmail) {
                data.cc = notification.brevoCcEmail.split(",").map((email) => ({ email: email.trim() }));
            }

            if (notification.brevoBccEmail) {
                data.bcc = notification.brevoBccEmail.split(",").map((email) => ({ email: email.trim() }));
            }

            let result = await axios.post("https://api.brevo.com/v3/smtp/email", data, config);
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
