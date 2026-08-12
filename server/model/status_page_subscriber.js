const { BeanModel } = require("redbean-node/dist/bean-model");
const { R } = require("redbean-node");
const crypto = require("crypto");
const dayjs = require("dayjs");
const validator = require("validator");
const nodemailer = require("nodemailer");
const SMTP = require("../notification-providers/smtp");
const { setting } = require("../util-server");
const config = require("../config");
const { log, UP } = require("../../src/util");

const TOKEN_RE = /^[a-f0-9]{64}$/;
const TOKEN_SEND_COOLDOWN_SECONDS = 60;

class StatusPageSubscriber extends BeanModel {
    /**
     * Generate a secure random token for confirm/unsubscribe links
     * @returns {string} 64-char hex token (256 bits of entropy)
     */
    static generateToken() {
        return crypto.randomBytes(32).toString("hex");
    }

    /**
     * Is this a plausible, storable email address?
     * @param {any} email Value to check
     * @returns {boolean} True if it looks like a valid email
     */
    static isValidEmail(email) {
        return typeof email === "string" && email.length > 0 && email.length <= 255 && validator.isEmail(email);
    }

    /**
     * Subscribe an email address to a group's notifications.
     * Always resolves (never throws to the caller in a way that would let
     * them distinguish "invalid email" from "already subscribed" from
     * "brand new subscription") - callers must not surface distinguishing
     * error info to the public HTTP response.
     * @param {number} groupId Group to subscribe to
     * @param {any} rawEmail Raw email input from the request body
     * @returns {Promise<void>}
     */
    static async subscribe(groupId, rawEmail) {
        const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

        if (!StatusPageSubscriber.isValidEmail(email)) {
            log.debug("status-page-subscriber", "Rejected subscribe: invalid email");
            return;
        }

        const group = await R.findOne("group", " id = ? AND public = 1 ", [parseInt(groupId, 10)]);
        if (!group) {
            log.debug("status-page-subscriber", "Rejected subscribe: group not found or not public");
            return;
        }

        const smtpConfig = await StatusPageSubscriber._getGroupSmtpConfig(group.status_page_id);
        if (!smtpConfig) {
            log.debug("status-page-subscriber", "Rejected subscribe: subscriptions not enabled for this status page");
            return;
        }

        const now = R.isoDateTime(dayjs.utc());
        const existing = await R.findOne("status_page_subscriber", " group_id = ? AND email = ? ", [
            group.id,
            email,
        ]);

        if (existing) {
            if (existing.confirmed) {
                // Already subscribed - nothing to do, and nothing to reveal to the caller.
                return;
            }

            if (
                existing.token_sent_date &&
                dayjs.utc().diff(dayjs.utc(existing.token_sent_date), "second") < TOKEN_SEND_COOLDOWN_SECONDS
            ) {
                // Resend requested too soon after the last one - throttle silently.
                return;
            }

            existing.token = StatusPageSubscriber.generateToken();
            existing.token_sent_date = now;
            await R.store(existing);
            await StatusPageSubscriber._sendConfirmationEmail(smtpConfig, group, existing);
            return;
        }

        const bean = R.dispense("status_page_subscriber");
        bean.group_id = group.id;
        bean.email = email;
        bean.token = StatusPageSubscriber.generateToken();
        bean.confirmed = false;
        bean.created_date = now;
        bean.token_sent_date = now;

        try {
            await R.store(bean);
        } catch (e) {
            // Most likely a unique-constraint race with a concurrent subscribe request
            // for the same (group_id, email). Treat it the same as "already exists".
            log.debug("status-page-subscriber", "Insert failed (likely a race), ignoring: " + e.message);
            return;
        }

        await StatusPageSubscriber._sendConfirmationEmail(smtpConfig, group, bean);
    }

    /**
     * Confirm a pending subscription via its token.
     * The token is rotated on success so the confirm link can't be replayed,
     * and the new token becomes the subscriber's standing unsubscribe token.
     * @param {any} token Token from the confirmation link
     * @returns {Promise<object>} The confirmed subscriber bean
     * @throws {Error} If the token is malformed or doesn't match a subscriber
     */
    static async confirm(token) {
        if (typeof token !== "string" || !TOKEN_RE.test(token)) {
            throw new Error("Invalid confirmation link");
        }

        const bean = await R.findOne("status_page_subscriber", " token = ? ", [token]);
        if (!bean) {
            throw new Error("Invalid or already-used confirmation link");
        }

        if (!bean.confirmed) {
            bean.confirmed = true;
            bean.confirmed_date = R.isoDateTime(dayjs.utc());
            bean.token = StatusPageSubscriber.generateToken();
            await R.store(bean);
        }

        return bean;
    }

    /**
     * Unsubscribe by token. Idempotent and side-channel free: behaves
     * identically whether or not a matching subscriber existed.
     * @param {any} token Token from an unsubscribe link
     * @returns {Promise<void>}
     */
    static async unsubscribe(token) {
        if (typeof token !== "string" || !TOKEN_RE.test(token)) {
            return;
        }

        const bean = await R.findOne("status_page_subscriber", " token = ? ", [token]);
        if (bean) {
            await R.trash(bean);
        }
    }

    /**
     * List subscribers of a group for the admin UI
     * @param {number} groupId Group id
     * @returns {Promise<object[]>} Subscribers (no tokens included)
     */
    static async listByGroup(groupId) {
        const rows = await R.getAll(
            "SELECT id, email, confirmed, created_date, confirmed_date FROM status_page_subscriber WHERE group_id = ? ORDER BY created_date DESC",
            [groupId]
        );

        return rows.map((row) => ({
            id: row.id,
            email: row.email,
            confirmed: !!row.confirmed,
            createdDate: row.created_date,
            confirmedDate: row.confirmed_date,
        }));
    }

    /**
     * Remove a subscriber (admin action). Scoped by group id as well as
     * subscriber id so a group's admin can't be tricked into deleting a
     * subscriber row belonging to a different group.
     * @param {number} groupId Group the subscriber must belong to
     * @param {number} subscriberId Subscriber row id to remove
     * @returns {Promise<void>}
     */
    static async removeSubscriber(groupId, subscriberId) {
        await R.exec("DELETE FROM status_page_subscriber WHERE id = ? AND group_id = ?", [subscriberId, groupId]);
    }

    /**
     * Email a group's confirmed subscribers about a monitor status change.
     * Called from Monitor.sendNotification; must never throw, since a mail
     * failure must not interrupt heartbeat processing.
     * @param {object} monitor Monitor that changed status
     * @param {object} bean Heartbeat bean
     * @param {string} msg Message describing the change
     * @returns {Promise<void>}
     */
    static async notifyMonitorStatusChange(monitor, bean, msg) {
        try {
            const groups = await R.getAll(
                `SELECT g.id AS group_id, g.status_page_id AS status_page_id
                 FROM monitor_group mg
                 JOIN \`group\` g ON mg.group_id = g.id
                 WHERE mg.monitor_id = ? AND g.public = 1`,
                [monitor.id]
            );

            const subject = `[${monitor.name}] is ${bean.status === UP ? "Up" : "Down"}`;

            for (const g of groups) {
                await StatusPageSubscriber._notifyGroup(g.group_id, g.status_page_id, subject, msg);
            }
        } catch (e) {
            log.error("status-page-subscriber", "Failed to notify group subscribers of monitor status change");
            log.error("status-page-subscriber", e);
        }
    }

    /**
     * Email a maintenance's affected groups' confirmed subscribers that a
     * new maintenance window has been scheduled. Called once, the first
     * time a maintenance is linked to monitors - must never throw, since a
     * mail failure must not interrupt the admin's save. Does nothing unless
     * the admin opted this specific maintenance into subscriber emails
     * (off by default - the maintenance is still recorded in the group's
     * log either way, see GroupLogEntry.createAutoEntriesForMaintenance).
     * @param {object} maintenanceBean The maintenance that was scheduled
     * @param {number[]} monitorIds Ids of monitors attached to the maintenance
     * @returns {Promise<void>}
     */
    static async notifyMaintenanceScheduled(maintenanceBean, monitorIds) {
        try {
            if (!maintenanceBean.notify_subscribers) {
                return;
            }

            if (!monitorIds || monitorIds.length === 0) {
                return;
            }

            const placeholders = monitorIds.map(() => "?").join(",");
            const groups = await R.getAll(
                `SELECT DISTINCT g.id AS group_id, g.name AS group_name, g.status_page_id AS status_page_id
                 FROM monitor_group mg
                 JOIN \`group\` g ON mg.group_id = g.id
                 WHERE mg.monitor_id IN (${placeholders}) AND g.public = 1`,
                monitorIds
            );

            for (const g of groups) {
                const subject = `[${g.group_name}] Maintenance scheduled: ${maintenanceBean.title}`;
                await StatusPageSubscriber._notifyGroup(
                    g.group_id,
                    g.status_page_id,
                    subject,
                    maintenanceBean.description || "Maintenance has been scheduled."
                );
            }
        } catch (e) {
            log.error("status-page-subscriber", "Failed to notify group subscribers of scheduled maintenance");
            log.error("status-page-subscriber", e);
        }
    }

    /**
     * Email all of a status page's group subscribers about an incident.
     * Incidents aren't scoped to a single group, so every public group on
     * the page is notified - sent per-group (not deduped across groups) so
     * every email's unsubscribe link stays unambiguous about which
     * subscription it removes.
     * @param {number} statusPageId Status page the incident belongs to
     * @param {object} incidentBean The incident
     * @returns {Promise<void>}
     */
    static async notifyIncidentSubscribers(statusPageId, incidentBean) {
        try {
            const statusPage = await R.findOne("status_page", " id = ? ", [statusPageId]);
            if (!statusPage) {
                return;
            }

            const groups = await R.getAll("SELECT id FROM `group` WHERE status_page_id = ? AND public = 1", [
                statusPageId,
            ]);

            const subject = `[${statusPage.title}] ${incidentBean.title}`;

            for (const g of groups) {
                await StatusPageSubscriber._notifyGroup(g.id, statusPageId, subject, incidentBean.content);
            }
        } catch (e) {
            log.error("status-page-subscriber", "Failed to notify group subscribers of incident");
            log.error("status-page-subscriber", e);
        }
    }

    /**
     * Send a subject/body email to every confirmed subscriber of a group,
     * using that group's status page's configured SMTP notification.
     * @param {number} groupId Group whose subscribers should be emailed
     * @param {number} statusPageId Status page the group belongs to
     * @param {string} subject Email subject
     * @param {string} body Email body
     * @returns {Promise<void>}
     */
    static async _notifyGroup(groupId, statusPageId, subject, body) {
        const smtpConfig = await StatusPageSubscriber._getGroupSmtpConfig(statusPageId);
        if (!smtpConfig) {
            return;
        }

        const subscribers = await R.getAll(
            "SELECT email, token FROM status_page_subscriber WHERE group_id = ? AND confirmed = 1",
            [groupId]
        );

        for (const s of subscribers) {
            try {
                await StatusPageSubscriber._sendViaSmtpNotification(smtpConfig, s.email, s.token, subject, body);
            } catch (e) {
                log.error("status-page-subscriber", `Failed to send mail to ${s.email}: ${e.message}`);
            }
        }
    }

    /**
     * Look up the SMTP notification config a status page uses to email its
     * group subscribers.
     * @param {number} statusPageId Status page id
     * @returns {Promise<object|null>} Parsed SMTP notification config, or null if subscriptions aren't enabled/configured correctly
     */
    static async _getGroupSmtpConfig(statusPageId) {
        const statusPage = await R.findOne("status_page", " id = ? ", [statusPageId]);
        if (!statusPage || !statusPage.subscription_notification_id) {
            return null;
        }

        const notification = await R.findOne("notification", " id = ? ", [statusPage.subscription_notification_id]);
        if (!notification) {
            return null;
        }

        let parsed;
        try {
            parsed = JSON.parse(notification.config);
        } catch (e) {
            return null;
        }

        if (parsed.type !== "smtp") {
            return null;
        }

        return parsed;
    }

    /**
     * Send the initial confirmation email for a new/re-requested subscription.
     * @param {object} smtpConfig SMTP notification config
     * @param {object} group Group being subscribed to
     * @param {object} subscriberBean The subscriber bean (unconfirmed)
     * @returns {Promise<void>}
     */
    static async _sendConfirmationEmail(smtpConfig, group, subscriberBean) {
        const baseUrl = await StatusPageSubscriber._getBaseUrl();
        const confirmUrl = `${baseUrl}/api/status-page/subscription/confirm?token=${subscriberBean.token}`;

        const transporter = nodemailer.createTransport(SMTP.buildTransportConfig(smtpConfig));
        await transporter.sendMail({
            from: smtpConfig.smtpFrom,
            to: subscriberBean.email,
            subject: `Confirm your subscription to "${group.name}"`,
            text:
                `You requested to subscribe to status updates for "${group.name}".\n\n` +
                `Confirm your subscription: ${confirmUrl}\n\n` +
                "If you didn't request this, you can safely ignore this email.",
        });
    }

    /**
     * Send an alert/incident email to a single subscriber, with a working
     * one-click unsubscribe link and RFC 8058 headers.
     * @param {object} smtpConfig SMTP notification config
     * @param {string} to Subscriber's email address
     * @param {string} unsubscribeToken Subscriber's current token
     * @param {string} subject Email subject
     * @param {string} textBody Email body
     * @returns {Promise<void>}
     */
    static async _sendViaSmtpNotification(smtpConfig, to, unsubscribeToken, subject, textBody) {
        const transportConfig = SMTP.buildTransportConfig(smtpConfig);
        const transporter = nodemailer.createTransport(transportConfig);
        const baseUrl = await StatusPageSubscriber._getBaseUrl();
        const unsubscribeUrl = `${baseUrl}/api/status-page/subscription/unsubscribe?token=${unsubscribeToken}`;

        await transporter.sendMail({
            from: smtpConfig.smtpFrom,
            to,
            subject,
            text: `${textBody}\n\n---\nUnsubscribe: ${unsubscribeUrl}`,
            headers: {
                ...transportConfig.headers,
                "List-Unsubscribe": `<${unsubscribeUrl}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
        });
    }

    /**
     * Base URL to use for confirm/unsubscribe links when there's no HTTP
     * request in scope (e.g. triggered from a heartbeat check).
     * @returns {Promise<string>} Base URL with no trailing slash
     */
    static async _getBaseUrl() {
        const primary = await setting("primaryBaseURL");
        if (primary) {
            return primary.replace(/\/$/, "");
        }

        const proto = config.isSSL ? "https" : "http";
        const host = config.hostname || "localhost";
        return `${proto}://${host}:${config.port}`;
    }
}

module.exports = StatusPageSubscriber;
