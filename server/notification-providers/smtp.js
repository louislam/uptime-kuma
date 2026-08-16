const nodemailer = require("nodemailer");
const NotificationProvider = require("./notification-provider");
const { log, UP } = require("../../src/util");
const dayjs = require("dayjs");

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
            headers: {},
        };

        // Handle TLS/STARTTLS options
        if (!notification.smtpSecure && notification.smtpIgnoreSTARTTLS) {
            // Disable STARTTLS completely for servers that don't support it
            // Connection will remain unencrypted
            log.warn(
                "notification",
                `SMTP notification using unencrypted connection (STARTTLS disabled) to ${notification.smtpHost}:${notification.smtpPort}`
            );
            config.ignoreTLS = true;
        } else {
            // SMTPS (implicit TLS on port 465)
            // or STARTTLS (default behavior for ports 25, 587)
            config.tls = {
                rejectUnauthorized: !notification.smtpIgnoreTLSError || false,
            };
        }

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

        // Handle additional headers
        if (notification.smtpAdditionalHeaders) {
            try {
                config.headers = {
                    ...config.headers,
                    ...JSON.parse(notification.smtpAdditionalHeaders),
                };
            } catch (err) {
                throw new Error("Additional Headers is not a valid JSON");
            }
        }

        // default values in case the user does not want to template
        let subject = msg;
        let body = msg;
        let useHTMLBody = false;
        if (heartbeatJSON) {
            body = `${msg}\nTime (${heartbeatJSON["timezone"]}): ${heartbeatJSON["localDateTime"]}`;
            // Include downtime duration for UP notifications
            if (heartbeatJSON["status"] === UP && heartbeatJSON["lastDownTime"]) {
                const backOnlineTimestamp = dayjs.utc(heartbeatJSON["time"]).unix();
                const wentOfflineTimestamp = dayjs.utc(heartbeatJSON["lastDownTime"]).unix();
                const downtimeDuration = this.formatDuration(
                    backOnlineTimestamp - wentOfflineTimestamp
                );
                body += `\nDowntime Duration: ${downtimeDuration}`;
            }
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
        const transporter = nodemailer.createTransport(config);

        await transporter.sendMail({
            from: notification.smtpFrom,
            cc: notification.smtpCC,
            bcc: notification.smtpBCC,
            to: notification.smtpTo,
            subject: subject,
            headers: config.headers,
            // If the email body is custom, and the user wants it, set the email body as HTML
            [useHTMLBody ? "html" : "text"]: body,
        });

        return okMsg;
    }

    /**
     * Format duration as human-readable string (e.g. "1h 23m", "45m 30s")
     * @param {number} timeInSeconds The time in seconds to format a duration for
     * @returns {string} The formatted duration
     */
    formatDuration(timeInSeconds) {
        const hours = Math.floor(timeInSeconds / 3600);
        const minutes = Math.floor((timeInSeconds % 3600) / 60);
        const seconds = timeInSeconds % 60;
        const durationParts = [];
        if (hours > 0) {
            durationParts.push(`${hours}h`);
        }
        if (minutes > 0) {
            durationParts.push(`${minutes}m`);
        }
        if (seconds > 0 && hours === 0) {
            // Only show seconds if less than an hour
            durationParts.push(`${seconds}s`);
        }
        return durationParts.length > 0 ? durationParts.join(" ") : "0s";
    }
}

module.exports = SMTP;
