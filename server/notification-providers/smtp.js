const nodemailer = require("nodemailer");
const NotificationProvider = require("./notification-provider");

class SMTP extends NotificationProvider {

    name = "smtp";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {

        const config = {
            host: notification.smtpHost,
            port: notification.smtpPort,
            secure: notification.smtpSecure,
        };

        // Should fix the issue in https://github.com/louislam/uptime-kuma/issues/26#issuecomment-896373904
        if (notification.smtpUsername || notification.smtpPassword) {
            config.auth = {
                user: notification.smtpUsername,
                pass: notification.smtpPassword,
            };
        }
        // Lets start with default subject
        let subject = msg;

        // Our subject cannot end with whitespace it's often raise spam score
        let customsubject = notification.customsubject.trim()

        // If custom subject is not empty, change subject for notification
        if (customsubject !== "") {
            
             // Replace "MACROS" with coresponding variable
            let replaceName = new RegExp("{NAME}", "g");
            let replaceHostname = new RegExp("{HOSTNAME}", "g");
            let replaceStatus = new RegExp("{STATUS}", "g");

            let serviceStatus;

            if (monitorJSON !== null) {
                customsubject = customsubject.replace(replaceName,monitorJSON["name"]);
                customsubject = customsubject.replace(replaceHostname,monitorJSON["hostname"]);
            } else {
                // Insert dummy values during test
                customsubject = customsubject.replace(replaceName,"Test");
                customsubject = customsubject.replace(replaceHostname,"example.com");
            }
            if (heartbeatJSON !== null) {
                    if (heartbeatJSON["status"] === 0) {
                        serviceStatus = "🔴 Down"
                    } else {
                        serviceStatus = "✅ Up"
                    }
                customsubject = customsubject.replace(replaceStatus,serviceStatus);
            } else {
                // Insert dummy values during test
                customsubject = customsubject.replace(replaceStatus,"TEST");
            }

            subject = customsubject
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
            tls: {
                rejectUnauthorized: notification.smtpIgnoreTLSError || false,
            },
        });

        return "Sent Successfully.";
    }
}

module.exports = SMTP;
