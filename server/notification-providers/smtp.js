const nodemailer = require("nodemailer");
const NotificationProvider = require("./notification-provider");
const { DOWN } = require("../../src/util");

class SMTP extends NotificationProvider {

    name = "smtp";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {

        const config = {
            host: notification.smtpHost,
            port: notification.smtpPort,
            secure: notification.smtpSecure,
            tls: {
                rejectUnauthorized: notification.smtpIgnoreTLSError || false,
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
        // Lets start with default subject and empty string for custom one
        let subject = msg;

        // Change the subject if:
        //     - The msg ends with "Testing" or
        //     - Actual Up/Down Notification
        if ((monitorJSON && heartbeatJSON) || msg.endsWith("Testing")) {
            let customSubject = "";

            // Our subject cannot end with whitespace it's often raise spam score
            // Once I got "Cannot read property 'trim' of undefined", better be safe than sorry
            if (notification.customSubject) {
                customSubject = notification.customSubject.trim();
            }

            // If custom subject is not empty, change subject for notification
            if (customSubject !== "") {

                // Replace "MACROS" with corresponding variable
                let replaceName = new RegExp("{{NAME}}", "g");
                let replaceHostnameOrURL = new RegExp("{{HOSTNAME_OR_URL}}", "g");
                let replaceStatus = new RegExp("{{STATUS}}", "g");

                // Lets start with dummy values to simplify code
                let monitorName = "Test";
                let monitorHostnameOrURL = "testing.hostname";
                let serviceStatus = "⚠️ Test";

                if (monitorJSON !== null) {
                    monitorName = monitorJSON["name"];

                    if (monitorJSON["type"] === "http" || monitorJSON["type"] === "keyword") {
                        monitorHostnameOrURL = monitorJSON["url"];
                    } else {
                        monitorHostnameOrURL = monitorJSON["hostname"];
                    }
                }

                if (heartbeatJSON !== null) {
                    serviceStatus = (heartbeatJSON["status"] === DOWN) ? "🔴 Down" : "✅ Up";
                }

                // Break replace to one by line for better readability
                customSubject = customSubject.replace(replaceStatus, serviceStatus);
                customSubject = customSubject.replace(replaceName, monitorName);
                customSubject = customSubject.replace(replaceHostnameOrURL, monitorHostnameOrURL);

                subject = customSubject;
            }
        }

        let transporter = nodemailer.createTransport(config);

        let bodyTextContent = msg;
        if (heartbeatJSON) {
            bodyTextContent = `${msg}\nTime (UTC): ${heartbeatJSON["time"]}`;
        }

        // send mail with defined transport object
        await transporter.sendMail({
            from: notification.smtpFrom,
            cc: notification.smtpCC,
            bcc: notification.smtpBCC,
            to: notification.smtpTo,
            subject: subject,
            text: bodyTextContent,
        });

        return "Sent Successfully.";
    }
}

module.exports = SMTP;
