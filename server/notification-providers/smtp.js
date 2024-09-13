const nodemailer = require("nodemailer");
const NotificationProvider = require("./notification-provider");
const { DOWN } = require("../../src/util");
const { Liquid } = require("liquidjs");

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
        if (heartbeatJSON) {
            body = `${msg}\nTime (${heartbeatJSON["timezone"]}): ${heartbeatJSON["localDateTime"]}`;
        }
        // subject and body are templated
        if ((monitorJSON && heartbeatJSON) || msg.endsWith("Testing")) {
            // cannot end with whitespace as this often raises spam scores
            const customSubject = notification.customSubject?.trim() || "";
            const customBody = notification.customBody?.trim() || "";

            const context = this.generateContext(msg, monitorJSON, heartbeatJSON);
            const engine = new Liquid();
            if (customSubject !== "") {
                const tpl = engine.parse(customSubject);
                subject = await engine.render(tpl, context);
            }
            if (customBody !== "") {
                const tpl = engine.parse(customBody);
                body = await engine.render(tpl, context);
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
            text: body,
        });

        return okMsg;
    }

    /**
     * Generate context for LiquidJS
     * @param {string} msg  the message that will be included in the context
     * @param {?object} monitorJSON Monitor details (For Up/Down/Cert-Expiry only)
     * @param {?object} heartbeatJSON Heartbeat details (For Up/Down only)
     * @returns {{STATUS: string, status: string, HOSTNAME_OR_URL: string, hostnameOrUrl: string, NAME: string, name: string, monitorJSON: ?object, heartbeatJSON: ?object, msg: string}} the context
     */
    generateContext(msg, monitorJSON, heartbeatJSON) {
        // Let's start with dummy values to simplify code
        let monitorName = "Monitor Name not available";
        let monitorHostnameOrURL = "testing.hostname";

        if (monitorJSON !== null) {
            monitorName = monitorJSON["name"];
            monitorHostnameOrURL = this.extractAdress(monitorJSON);
        }

        let serviceStatus = "⚠️ Test";
        if (heartbeatJSON !== null) {
            serviceStatus = (heartbeatJSON["status"] === DOWN) ? "🔴 Down" : "✅ Up";
        }
        return {
            // for v1 compatibility, to be removed in v3
            "STATUS": serviceStatus,
            "NAME": monitorName,
            "HOSTNAME_OR_URL": monitorHostnameOrURL,

            // variables which are officially supported
            "status": serviceStatus,
            "name": monitorName,
            "hostnameOrURL": monitorHostnameOrURL,
            monitorJSON,
            heartbeatJSON,
            msg,
        };
    }
}

module.exports = SMTP;
