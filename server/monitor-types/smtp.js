const { MonitorType } = require("./monitor-type");
const { UP, DOWN } = require("../../src/util");
const nodemailer = require("nodemailer");
const tls = require("tls");
const Monitor = require("../model/monitor");

class SMTPMonitorType extends MonitorType {
    name = "smtp";

    async check(monitor, heartbeat, _server) {
        const options = {
            port: monitor.port || 25,
            host: monitor.hostname,
            secure: monitor.smtpSecurity === "secure",
            ignoreTLS: monitor.smtpSecurity === "nostarttls",
            requireTLS: monitor.smtpSecurity === "starttls"
        };

        const transporter = nodemailer.createTransport(options);

        try {
            // Verify SMTP connection
            await transporter.verify();
            heartbeat.status = UP;
            heartbeat.msg = "SMTP connection verified successfully";

            // Certificate monitoring if enabled and allowed
            if (monitor.certExpiry && (options.secure || options.requireTLS)) {
                let certInfo = await Monitor.getCertExpiry(monitor.id);

                if (!certInfo.validCert) {
                    certInfo = await this.getCertExpiryLive(monitor.hostname, options.port);
                }

                heartbeat.certExpiryDaysRemaining = certInfo.certExpiryDaysRemaining;
                heartbeat.validCert = certInfo.validCert;

                const tlsInfoObject = {
                    certInfo: {
                        certType: "SMTP",
                        subject: { CN: monitor.hostname },
                        daysRemaining: certInfo.certExpiryDaysRemaining,
                        fingerprint256: "",
                        issuerCertificate: null
                    }
                };
                try {
                    await Monitor.prototype.handleTlsInfo.call(this, tlsInfoObject);
                } catch (e) {
                    console.error("TLS info update failed:", e.message);
                }
            } else if (monitor.certExpiry) {
                heartbeat.msg += " (Certificate monitoring skipped: only for SMTPS or STARTTLS)";
            }

        } catch (e) {
            heartbeat.status = DOWN;
            heartbeat.msg = `SMTP connection failed: ${e.message}`;
        } finally {
            transporter.close();
        }
    }

    async getCertExpiryLive(host, port = 465) {
        return new Promise((resolve, reject) => {
            const socket = tls.connect({ host, port, rejectUnauthorized: false, timeout: 5000 }, () => {
                const cert = socket.getPeerCertificate();
                if (cert && cert.valid_to) {
                    const daysRemaining = Math.ceil((new Date(cert.valid_to) - Date.now()) / (1000 * 60 * 60 * 24));
                    resolve({ certExpiryDaysRemaining: daysRemaining, validCert: daysRemaining > 0 });
                } else {
                    resolve({ certExpiryDaysRemaining: "", validCert: false });
                }
                socket.end();
            });

            socket.on("error", reject);
            socket.on("timeout", () => {
                socket.destroy();
                reject(new Error("TLS connection timed out"));
            });
        });
    }
}

module.exports = {
    SMTPMonitorType,
};
