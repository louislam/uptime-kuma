const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const nodemailer = require("nodemailer");

class SMTPMonitorType extends MonitorType {
    name = "smtp";

    /**
     * @param {*} smtpSecurity the user's SMTP security setting
     * @returns {boolean} True if this should test SMTPS
     */
    isSMTPS(smtpSecurity) {
        return smtpSecurity === "secure";
    }

    /**
     * @param {*} smtpSecurity the user's SMTP security setting
     * @returns {boolean} True if this should not attempt STARTTLS, even if it is available
     */
    isIgnoreTLS(smtpSecurity) {
        return smtpSecurity === "nostarttls";
    }

    /**
     * @param {*} smtpSecurity the user's SMTP security setting
     * @returns {boolean} True if this should always test STARTTLS
     */
    isRequireTLS(smtpSecurity) {
        return smtpSecurity === "starttls";
    }

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        let options = {
            port: monitor.port || 25,
            host: monitor.hostname,
            secure: this.isSMTPS(monitor.smtpSecurity), // use SMTPS (not STARTTLS)
            ignoreTLS: this.isIgnoreTLS(monitor.smtpSecurity), // don't use STARTTLS even if it's available
            requireTLS: this.isRequireTLS(monitor.smtpSecurity), // use STARTTLS or fail
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
