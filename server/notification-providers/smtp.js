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
        const config = {
            host: notification.smtpHost,
            port: notification.smtpPort,
            secure: notification.smtpSecure,
            tls: {
                rejectUnauthorized: !notification.smtpIgnoreTLSError || false,
            },
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
        let body = "";
        let htmlContent = "";
        if (heartbeatJSON) {
            body = `${msg}\nTime (${heartbeatJSON["timezone"]}): ${heartbeatJSON["localDateTime"]}`;
        }
        // subject and body are templated
        if ((monitorJSON && heartbeatJSON) || msg.endsWith("Testing")) {
            // cannot end with whitespace as this often raises spam scores
            const customSubject = notification.customSubject?.trim() || "";
            const customBody = notification.customBody?.trim() || "";

            const context = this.generateContext(
                msg,
                monitorJSON,
                heartbeatJSON
            );

            const engine = new Liquid();
            if (customSubject !== "") {
                const tpl = engine.parse(customSubject);
                subject = await engine.render(tpl, context);
            }
            if (customBody !== "") {
                const tpl = engine.parse(customBody);
                body = await engine.render(tpl, context);
            }
            //html template
            htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="display: flex; align-items: center; justify-content: center; margin: 0;max-width:500px">
              <div style=" height: auto; background-color: #203040; padding: 0 40px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                <div style="background-color: white; padding: 30px 30px; height: auto; margin-top: 40px; margin-bottom: 40px;">
                  <div style="padding: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; text-align: center; background-color: ${
                      context.STATUS === "🔴 Down" ? "#eb3434" : "#34eb71"
                  };">
                 <h3 style="text-align: center;">${context.STATUS.toUpperCase()}</h3>
                  </div>
                ${
                    context.STATUS === "🔴 Down"
                        ? "<h3>Your following monitor has failed</h3>"
                        : "<h3>Your following monitor has been brought up</h3>"
                }
    
                  <p>HostName: ${context.NAME}</p>
                  <p>URL : ${context.HOSTNAME_OR_URL}
                  
                  ${
                      context.STATUS === "⚠️ Test"
                          ? "<p>Date & Time: Test Date & Time</p><p>StatusCode: Test Status code</p>"
                          : `<p>Date & Time: ${heartbeatJSON["timezone"]}: ${heartbeatJSON["localDateTime"]}</p><p>StatusCode: ${heartbeatJSON["msg"]}</p>`
                  }
                  ${body !== "" ? `<p>${body}</p>` : ""}
                </div>
                 </div>  
            </body>
            </html>
            `;
        }

        // send mail with defined transport object
        let transporter = nodemailer.createTransport(config);
        await transporter.sendMail({
            from: notification.smtpFrom,
            cc: notification.smtpCC,
            bcc: notification.smtpBCC,
            to: notification.smtpTo,
            subject: subject,
            html: htmlContent,
        });

        return "Sent Successfully.";
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

            if (
                monitorJSON["type"] === "http" ||
                monitorJSON["type"] === "keyword" ||
                monitorJSON["type"] === "json-query"
            ) {
                monitorHostnameOrURL = monitorJSON["url"];
            } else {
                monitorHostnameOrURL = monitorJSON["hostname"];
            }
        }

        let serviceStatus = "⚠️ Test";
        if (heartbeatJSON !== null) {
            serviceStatus =
                heartbeatJSON["status"] === DOWN ? "🔴 Down" : "✅ Up";
        }
        return {
            // for v1 compatibility, to be removed in v3
            STATUS: serviceStatus,
            NAME: monitorName,
            HOSTNAME_OR_URL: monitorHostnameOrURL,

            // variables which are officially supported
            status: serviceStatus,
            name: monitorName,
            hostnameOrURL: monitorHostnameOrURL,
            monitorJSON,
            heartbeatJSON,
            msg,
        };
    }
}

module.exports = SMTP;
