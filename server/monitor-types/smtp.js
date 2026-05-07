const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const nodemailer = require("nodemailer");

class SMTPMonitorType extends MonitorType {
    name = "smtp";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        let options = {
            port: monitor.port || 25,
            host: monitor.hostname,
            secure: monitor.smtp_security === "secure", // use SMTPS (not STARTTLS)
            ignoreTLS: monitor.smtp_security === "nostarttls", // don't use STARTTLS even if it's available
            requireTLS: monitor.smtp_security === "starttls", // use STARTTLS or fail
        };
        let transporter = nodemailer.createTransport(options);
        try {
            await transporter.verify();

            heartbeat.status = UP;
            heartbeat.msg = "SMTP connection verifies successfully";
        } catch (e) {
            throw new Error(`SMTP connection doesn't verify: ${e}`);
        } finally {
            transporter.close();
        }
    }
}

module.exports = {
    SMTPMonitorType,
};
