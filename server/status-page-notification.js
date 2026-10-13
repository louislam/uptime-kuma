const { R } = require("redbean-node");
const { log } = require("../src/util");
const { Notification } = require("./notification");

/**
 * Send a status page notification email to a configured address.
 * Uses the admin's default or first SMTP notification provider.
 */
class StatusPageNotification {
    /**
     * Find an SMTP notification config to use for sending.
     * Prefers the default notification if it is SMTP, otherwise
     * falls back to the first SMTP notification found.
     * @returns {Promise<object|null>} Parsed SMTP config or null
     */
    static async getSMTPConfig() {
        try {
            let bean = await R.findOne("notification", " is_default = ? ", [true]);

            if (bean) {
                let config = JSON.parse(bean.config);
                if (config.type === "smtp") {
                    return config;
                }
            }

            let allBeans = await R.findAll("notification");
            for (let b of allBeans) {
                let config = JSON.parse(b.config);
                if (config.type === "smtp") {
                    return config;
                }
            }

            return null;
        } catch (error) {
            log.error("status-page-notification", `Failed to get SMTP config: ${error.message}`);
            return null;
        }
    }

    /**
     * Send a notification email to the status page's configured address.
     * Does nothing if no notification_email is set or no SMTP config exists.
     * @param {number} statusPageId Status page ID
     * @param {string} subject Email subject line
     * @param {string} body Plain text email body
     * @returns {Promise<boolean>} true if sent, false otherwise
     */
    static async sendNotificationEmail(statusPageId, subject, body) {
        try {
            let statusPage = await R.load("status_page", statusPageId);
            if (!statusPage || !statusPage.notification_email) {
                return false;
            }

            let smtpConfig = await this.getSMTPConfig();
            if (!smtpConfig) {
                log.warn("status-page-notification", "No SMTP notification configured. Cannot send status page email.");
                return false;
            }

            let sendConfig = Object.assign({}, smtpConfig, {
                smtpTo: statusPage.notification_email,
            });

            await Notification.send(sendConfig, body);

            log.info("status-page-notification", `Sent notification to ${statusPage.notification_email}: ${subject}`);
            return true;
        } catch (error) {
            log.error("status-page-notification", `Failed to send notification: ${error.message}`);
            return false;
        }
    }

    /**
     * @param {number} statusPageId Status page ID
     * @param {object} incident Incident bean
     * @returns {Promise<boolean>} true if sent
     */
    static async sendIncidentNotification(statusPageId, incident) {
        let subject = `[Incident] ${incident.title}`;
        let body = `Incident: ${incident.title}\nSeverity: ${incident.style}\n\n${incident.content}`;
        return await this.sendNotificationEmail(statusPageId, subject, body);
    }

    /**
     * @param {number} statusPageId Status page ID
     * @param {object} incident Incident bean
     * @returns {Promise<boolean>} true if sent
     */
    static async sendIncidentUpdateNotification(statusPageId, incident) {
        let subject = `[Incident Update] ${incident.title}`;
        let body = `Incident Updated: ${incident.title}\nSeverity: ${incident.style}\n\n${incident.content}`;
        return await this.sendNotificationEmail(statusPageId, subject, body);
    }

    /**
     * @param {number} statusPageId Status page ID
     * @param {object} incident Incident bean
     * @returns {Promise<boolean>} true if sent
     */
    static async sendIncidentResolvedNotification(statusPageId, incident) {
        let subject = `[Resolved] ${incident.title}`;
        let body = `Incident Resolved: ${incident.title}\n\nThis incident has been resolved.`;
        return await this.sendNotificationEmail(statusPageId, subject, body);
    }

    /**
     * @param {number} statusPageId Status page ID
     * @param {object} maintenance Maintenance bean
     * @returns {Promise<boolean>} true if sent
     */
    static async sendMaintenanceNotification(statusPageId, maintenance) {
        let subject = `[Maintenance] ${maintenance.title}`;
        let body = `Scheduled Maintenance: ${maintenance.title}\n\n${maintenance.description || ""}`;
        return await this.sendNotificationEmail(statusPageId, subject, body);
    }

    /**
     * @param {number} statusPageId Status page ID
     * @param {object} maintenance Maintenance bean
     * @returns {Promise<boolean>} true if sent
     */
    static async sendMaintenanceCompletedNotification(statusPageId, maintenance) {
        let subject = `[Maintenance Complete] ${maintenance.title}`;
        let body = `Maintenance Complete: ${maintenance.title}\n\nThe scheduled maintenance has ended.`;
        return await this.sendNotificationEmail(statusPageId, subject, body);
    }
}

module.exports = { StatusPageNotification };
