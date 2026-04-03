const { describe, test, mock, afterEach } = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
const { Notification } = require("../../server/notification");
const { StatusPageNotification } = require("../../server/status-page-notification");

describe("StatusPageNotification", () => {

    afterEach(() => {
        mock.restoreAll();
    });

    describe("getSMTPConfig()", () => {
        test("returns default notification if it is SMTP", async () => {
            let smtpConfig = { type: "smtp", smtpHost: "mail.example.com" };
            mock.method(R, "findOne", async () => ({
                config: JSON.stringify(smtpConfig),
            }));

            let result = await StatusPageNotification.getSMTPConfig();
            assert.deepStrictEqual(result, smtpConfig);
        });

        test("falls back to first SMTP if default is not SMTP", async () => {
            let telegramConfig = { type: "telegram" };
            let smtpConfig = { type: "smtp", smtpHost: "mail.example.com" };

            mock.method(R, "findOne", async () => ({
                config: JSON.stringify(telegramConfig),
            }));
            mock.method(R, "findAll", async () => [
                { config: JSON.stringify(telegramConfig) },
                { config: JSON.stringify(smtpConfig) },
            ]);

            let result = await StatusPageNotification.getSMTPConfig();
            assert.deepStrictEqual(result, smtpConfig);
        });

        test("falls back to first SMTP if no default notification", async () => {
            let smtpConfig = { type: "smtp", smtpHost: "mail.example.com" };

            mock.method(R, "findOne", async () => null);
            mock.method(R, "findAll", async () => [
                { config: JSON.stringify(smtpConfig) },
            ]);

            let result = await StatusPageNotification.getSMTPConfig();
            assert.deepStrictEqual(result, smtpConfig);
        });

        test("returns null if no SMTP notification exists", async () => {
            mock.method(R, "findOne", async () => null);
            mock.method(R, "findAll", async () => [
                { config: JSON.stringify({ type: "telegram" }) },
                { config: JSON.stringify({ type: "discord" }) },
            ]);

            let result = await StatusPageNotification.getSMTPConfig();
            assert.strictEqual(result, null);
        });

        test("returns null if no notifications exist at all", async () => {
            mock.method(R, "findOne", async () => null);
            mock.method(R, "findAll", async () => []);

            let result = await StatusPageNotification.getSMTPConfig();
            assert.strictEqual(result, null);
        });

        test("returns null on database error", async () => {
            mock.method(R, "findOne", async () => {
                throw new Error("DB connection lost");
            });

            let result = await StatusPageNotification.getSMTPConfig();
            assert.strictEqual(result, null);
        });
    });

    describe("sendNotificationEmail()", () => {
        test("returns false if status page has no notification_email", async () => {
            mock.method(R, "load", async () => ({
                notification_email: null,
            }));

            let result = await StatusPageNotification.sendNotificationEmail(1, "Subject", "Body");
            assert.strictEqual(result, false);
        });

        test("returns false if status page has empty notification_email", async () => {
            mock.method(R, "load", async () => ({
                notification_email: "",
            }));

            let result = await StatusPageNotification.sendNotificationEmail(1, "Subject", "Body");
            assert.strictEqual(result, false);
        });

        test("returns false if status page not found", async () => {
            mock.method(R, "load", async () => null);

            let result = await StatusPageNotification.sendNotificationEmail(1, "Subject", "Body");
            assert.strictEqual(result, false);
        });

        test("returns false if no SMTP config available", async () => {
            mock.method(R, "load", async () => ({
                notification_email: "team@example.com",
            }));
            mock.method(StatusPageNotification, "getSMTPConfig", async () => null);

            let result = await StatusPageNotification.sendNotificationEmail(1, "Subject", "Body");
            assert.strictEqual(result, false);
        });

        test("sends email with overridden smtpTo and returns true", async () => {
            let smtpConfig = {
                type: "smtp",
                smtpHost: "mail.example.com",
                smtpTo: "original@example.com",
            };

            mock.method(R, "load", async () => ({
                notification_email: "team@example.com",
            }));
            mock.method(StatusPageNotification, "getSMTPConfig", async () => smtpConfig);

            let sentConfig = null;
            mock.method(Notification, "send", async (config, msg) => {
                sentConfig = config;
                return "Sent Successfully.";
            });

            let result = await StatusPageNotification.sendNotificationEmail(1, "Test Subject", "Test Body");

            assert.strictEqual(result, true);
            assert.strictEqual(sentConfig.smtpTo, "team@example.com");
            assert.strictEqual(sentConfig.smtpHost, "mail.example.com");
            assert.strictEqual(sentConfig.type, "smtp");
        });

        test("does not mutate original SMTP config", async () => {
            let smtpConfig = {
                type: "smtp",
                smtpHost: "mail.example.com",
                smtpTo: "original@example.com",
            };

            mock.method(R, "load", async () => ({
                notification_email: "team@example.com",
            }));
            mock.method(StatusPageNotification, "getSMTPConfig", async () => smtpConfig);
            mock.method(Notification, "send", async () => "Sent Successfully.");

            await StatusPageNotification.sendNotificationEmail(1, "Subject", "Body");

            assert.strictEqual(smtpConfig.smtpTo, "original@example.com");
        });

        test("returns false on send failure", async () => {
            mock.method(R, "load", async () => ({
                notification_email: "team@example.com",
            }));
            mock.method(StatusPageNotification, "getSMTPConfig", async () => ({
                type: "smtp",
                smtpHost: "mail.example.com",
            }));
            mock.method(Notification, "send", async () => {
                throw new Error("SMTP connection refused");
            });

            let result = await StatusPageNotification.sendNotificationEmail(1, "Subject", "Body");
            assert.strictEqual(result, false);
        });
    });

    describe("sendIncidentNotification()", () => {
        test("sends with correct subject and body", async () => {
            let sentSubject = null;
            let sentBody = null;

            mock.method(StatusPageNotification, "sendNotificationEmail", async (id, subject, body) => {
                sentSubject = subject;
                sentBody = body;
                return true;
            });

            let incident = {
                title: "API Outage",
                content: "The API is currently unavailable.",
                style: "danger",
            };

            let result = await StatusPageNotification.sendIncidentNotification(5, incident);

            assert.strictEqual(result, true);
            assert.strictEqual(sentSubject, "[Incident] API Outage");
            assert.ok(sentBody.includes("API Outage"));
            assert.ok(sentBody.includes("danger"));
            assert.ok(sentBody.includes("The API is currently unavailable."));
        });
    });

    describe("sendIncidentUpdateNotification()", () => {
        test("sends with correct subject", async () => {
            let sentSubject = null;

            mock.method(StatusPageNotification, "sendNotificationEmail", async (id, subject, body) => {
                sentSubject = subject;
                return true;
            });

            let incident = {
                title: "API Outage",
                content: "Investigating the issue.",
                style: "warning",
            };

            await StatusPageNotification.sendIncidentUpdateNotification(5, incident);
            assert.strictEqual(sentSubject, "[Incident Update] API Outage");
        });
    });

    describe("sendIncidentResolvedNotification()", () => {
        test("sends with correct subject and resolved message", async () => {
            let sentSubject = null;
            let sentBody = null;

            mock.method(StatusPageNotification, "sendNotificationEmail", async (id, subject, body) => {
                sentSubject = subject;
                sentBody = body;
                return true;
            });

            let incident = { title: "API Outage" };

            await StatusPageNotification.sendIncidentResolvedNotification(5, incident);
            assert.strictEqual(sentSubject, "[Resolved] API Outage");
            assert.ok(sentBody.includes("resolved"));
        });
    });

    describe("sendMaintenanceNotification()", () => {
        test("sends with correct subject and body", async () => {
            let sentSubject = null;
            let sentBody = null;

            mock.method(StatusPageNotification, "sendNotificationEmail", async (id, subject, body) => {
                sentSubject = subject;
                sentBody = body;
                return true;
            });

            let maintenance = {
                title: "Database Upgrade",
                description: "Upgrading to PostgreSQL 16.",
            };

            await StatusPageNotification.sendMaintenanceNotification(3, maintenance);
            assert.strictEqual(sentSubject, "[Maintenance] Database Upgrade");
            assert.ok(sentBody.includes("Upgrading to PostgreSQL 16."));
        });

        test("handles null description gracefully", async () => {
            let sentBody = null;

            mock.method(StatusPageNotification, "sendNotificationEmail", async (id, subject, body) => {
                sentBody = body;
                return true;
            });

            let maintenance = {
                title: "Quick Fix",
                description: null,
            };

            await StatusPageNotification.sendMaintenanceNotification(3, maintenance);
            assert.ok(sentBody.includes("Quick Fix"));
        });
    });

    describe("sendMaintenanceCompletedNotification()", () => {
        test("sends with correct subject", async () => {
            let sentSubject = null;

            mock.method(StatusPageNotification, "sendNotificationEmail", async (id, subject, body) => {
                sentSubject = subject;
                return true;
            });

            let maintenance = { title: "Database Upgrade" };

            await StatusPageNotification.sendMaintenanceCompletedNotification(3, maintenance);
            assert.strictEqual(sentSubject, "[Maintenance Complete] Database Upgrade");
        });
    });
});
