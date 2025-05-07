const nodemailer = require("nodemailer");
const NotificationProvider = require("./notification-provider");

class SMTP extends NotificationProvider {
    name = "smtp";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        const config = {
            host: notification.smtpHost,
            port: notification.smtpPort,
            secure: notification.smtpSecure,
            tls: {
                rejectUnauthorized: !notification.smtpIgnoreTLSError || false,
            }
        };

        // Fix #1129
        if (notification.smtpDkimDomain) {
            config.dkim = {
                domainName: notification.smtpDkimDomain,
                keySelector: notification.smtpDkimKeySelector,
                privateKey: notification.smtpDkimPrivateKey,
                hashAlgo: notification.smtpDkimHashAlgo,
                headerFieldNames: notification.smtpDkimheaderFieldNames,
                skipFields: notification.smtpDkimskipFields,
            };
        }

        // Should fix the issue in https://github.com/louislam/uptime-kuma/issues/26#issuecomment-896373904
        if (notification.smtpUsername || notification.smtpPassword) {
            config.auth = {
                user: notification.smtpUsername,
                pass: notification.smtpPassword,
            };
        }

        // default values in case the user does not want to template
        let subject = msg;
        let body = msg;
        let useHTMLBody = false;
        if (heartbeatJSON) {
            body = `${msg}\nTime (${heartbeatJSON["timezone"]}): ${heartbeatJSON["localDateTime"]}`;
        }
        // subject and body are templated
        if ((monitorJSON && heartbeatJSON) || msg.endsWith("Testing")) {
            // cannot end with whitespace as this often raises spam scores
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

        // send mail with defined transport object
        let transporter = nodemailer.createTransport(config);
        await transporter.sendMail({
            from: notification.smtpFrom,
            cc: notification.smtpCC,
            bcc: notification.smtpBCC,
            to: notification.smtpTo,
            subject: subject,
            // If the email body is custom, and the user wants it, set the email body as HTML
            [useHTMLBody ? "html" : "text"]: body
        });

        return okMsg;
    }
}

module.exports = SMTP;
