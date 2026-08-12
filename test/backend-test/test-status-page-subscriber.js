const { describe, test, mock, before, beforeEach, afterEach, after } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const testDbPath = path.join(__dirname, "../../data/test-status-page-subscriber.db");

let R;
let StatusPageSubscriber;
let sentMails;
let restoreCreateTransport;

/**
 * Fake SMTP notification config, matching the shape stored in notification.config
 * @returns {object} SMTP config
 */
function smtpConfig() {
    return {
        type: "smtp",
        smtpHost: "localhost",
        smtpPort: 1025,
        smtpSecure: false,
        smtpFrom: "status@example.com",
    };
}

/**
 * Insert a status page, a public group on it, and (optionally) an SMTP
 * notification wired up as the page's subscription notification.
 * @param {object} options Options
 * @param {boolean} options.withSmtp Whether to configure a subscription notification
 * @returns {Promise<{statusPageId: number, groupId: number}>} Ids of the created rows
 */
async function makeStatusPageWithGroup({ withSmtp = true } = {}) {
    const statusPage = R.dispense("status_page");
    statusPage.slug = "test-" + Math.random().toString(36).slice(2);
    statusPage.title = "Test Status Page";
    statusPage.icon = "";
    statusPage.theme = "auto";

    if (withSmtp) {
        const notification = R.dispense("notification");
        notification.name = "Test SMTP";
        notification.config = JSON.stringify(smtpConfig());
        await R.store(notification);
        statusPage.subscription_notification_id = notification.id;
    }

    await R.store(statusPage);

    const group = R.dispense("group");
    group.name = "Test Group";
    group.public = true;
    group.status_page_id = statusPage.id;
    await R.store(group);

    return { statusPageId: statusPage.id, groupId: group.id };
}

describe("StatusPageSubscriber", () => {
    before(async () => {
        const testDbDir = path.dirname(testDbPath);
        if (!fs.existsSync(testDbDir)) {
            fs.mkdirSync(testDbDir, { recursive: true });
        }
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }

        const Dialect = require("knex/lib/dialects/sqlite3/index.js");
        Dialect.prototype._driver = () => require("@louislam/sqlite3");

        const knex = require("knex");
        const db = knex({
            client: Dialect,
            connection: {
                filename: testDbPath,
            },
            useNullAsDefault: true,
        });

        ({ R } = require("redbean-node"));
        R.setup(db);

        const { createTables } = require("../../db/knex_init_db.js");
        await createTables();
        await R.knex.migrate.latest({
            directory: path.join(__dirname, "../../db/knex_migrations"),
        });

        StatusPageSubscriber = require("../../server/model/status_page_subscriber");
    });

    after(async () => {
        await R.knex.destroy();
        if (fs.existsSync(testDbPath)) {
            fs.unlinkSync(testDbPath);
        }
    });

    beforeEach(() => {
        sentMails = [];
        restoreCreateTransport = mock.method(nodemailer, "createTransport", () => ({
            sendMail: async (opts) => {
                sentMails.push(opts);
            },
        }));
    });

    afterEach(() => {
        restoreCreateTransport.mock.restore();
    });

    describe("isValidEmail()", () => {
        test("accepts a plausible email", () => {
            assert.strictEqual(StatusPageSubscriber.isValidEmail("a@b.com"), true);
        });

        test("rejects malformed input", () => {
            assert.strictEqual(StatusPageSubscriber.isValidEmail("not-an-email"), false);
            assert.strictEqual(StatusPageSubscriber.isValidEmail(""), false);
            assert.strictEqual(StatusPageSubscriber.isValidEmail(null), false);
            assert.strictEqual(StatusPageSubscriber.isValidEmail(undefined), false);
        });

        test("rejects overly long input", () => {
            const longLocal = "a".repeat(300);
            assert.strictEqual(StatusPageSubscriber.isValidEmail(`${longLocal}@example.com`), false);
        });
    });

    describe("subscribe()", () => {
        test("creates a new subscriber and sends a confirmation email", async () => {
            const { groupId } = await makeStatusPageWithGroup();

            await StatusPageSubscriber.subscribe(groupId, "new@example.com");

            const row = await R.findOne("status_page_subscriber", " group_id = ? AND email = ? ", [
                groupId,
                "new@example.com",
            ]);
            assert.ok(row);
            assert.strictEqual(!!row.confirmed, false);
            assert.strictEqual(sentMails.length, 1);
            assert.strictEqual(sentMails[0].to, "new@example.com");
            assert.match(sentMails[0].subject, /Confirm your subscription/);
            assert.match(sentMails[0].text, new RegExp(`token=${row.token}`));
        });

        test("does nothing for an invalid email", async () => {
            const { groupId } = await makeStatusPageWithGroup();

            await StatusPageSubscriber.subscribe(groupId, "not-an-email");

            const rows = await R.getAll("SELECT * FROM status_page_subscriber WHERE group_id = ?", [groupId]);
            assert.strictEqual(rows.length, 0);
            assert.strictEqual(sentMails.length, 0);
        });

        test("does nothing when the group doesn't exist or isn't public", async () => {
            await StatusPageSubscriber.subscribe(999999, "nogroup@example.com");
            assert.strictEqual(sentMails.length, 0);
        });

        test("does nothing when the status page has no subscription notification configured", async () => {
            const { groupId } = await makeStatusPageWithGroup({ withSmtp: false });

            await StatusPageSubscriber.subscribe(groupId, "nosmtp@example.com");

            const rows = await R.getAll("SELECT * FROM status_page_subscriber WHERE group_id = ?", [groupId]);
            assert.strictEqual(rows.length, 0);
            assert.strictEqual(sentMails.length, 0);
        });

        test("sends no mail when already confirmed", async () => {
            const { groupId } = await makeStatusPageWithGroup();

            const bean = R.dispense("status_page_subscriber");
            bean.group_id = groupId;
            bean.email = "confirmed@example.com";
            bean.token = "a".repeat(64);
            bean.confirmed = true;
            bean.created_date = R.isoDateTime();
            await R.store(bean);

            await StatusPageSubscriber.subscribe(groupId, "confirmed@example.com");

            assert.strictEqual(sentMails.length, 0);
        });

        test("throttles resends within the cooldown window", async () => {
            const { groupId } = await makeStatusPageWithGroup();

            const bean = R.dispense("status_page_subscriber");
            bean.group_id = groupId;
            bean.email = "pending@example.com";
            bean.token = "b".repeat(64);
            bean.confirmed = false;
            bean.created_date = R.isoDateTime();
            bean.token_sent_date = R.isoDateTime();
            await R.store(bean);

            await StatusPageSubscriber.subscribe(groupId, "pending@example.com");

            assert.strictEqual(sentMails.length, 0);

            const row = await R.findOne("status_page_subscriber", " id = ? ", [bean.id]);
            assert.strictEqual(row.token, "b".repeat(64));
        });

        test("resends and rotates the token once the cooldown has passed", async () => {
            const { groupId } = await makeStatusPageWithGroup();

            const bean = R.dispense("status_page_subscriber");
            bean.group_id = groupId;
            bean.email = "stale@example.com";
            bean.token = "c".repeat(64);
            bean.confirmed = false;
            bean.created_date = R.isoDateTime();
            bean.token_sent_date = "2000-01-01 00:00:00";
            await R.store(bean);

            await StatusPageSubscriber.subscribe(groupId, "stale@example.com");

            assert.strictEqual(sentMails.length, 1);
            const row = await R.findOne("status_page_subscriber", " id = ? ", [bean.id]);
            assert.notStrictEqual(row.token, "c".repeat(64));
        });
    });

    describe("confirm()", () => {
        test("confirms a pending subscriber and rotates the token", async () => {
            const { groupId } = await makeStatusPageWithGroup();
            const bean = R.dispense("status_page_subscriber");
            bean.group_id = groupId;
            bean.email = "toconfirm@example.com";
            bean.token = "d".repeat(64);
            bean.confirmed = false;
            bean.created_date = R.isoDateTime();
            await R.store(bean);

            await StatusPageSubscriber.confirm("d".repeat(64));

            const row = await R.findOne("status_page_subscriber", " id = ? ", [bean.id]);
            assert.strictEqual(!!row.confirmed, true);
            assert.ok(row.confirmed_date);
            assert.notStrictEqual(row.token, "d".repeat(64));
        });

        test("throws for a malformed token", async () => {
            await assert.rejects(() => StatusPageSubscriber.confirm("not-a-token"));
        });

        test("throws for a well-formed but unknown token", async () => {
            await assert.rejects(() => StatusPageSubscriber.confirm("e".repeat(64)));
        });
    });

    describe("unsubscribe()", () => {
        test("removes a subscriber by token", async () => {
            const { groupId } = await makeStatusPageWithGroup();
            const bean = R.dispense("status_page_subscriber");
            bean.group_id = groupId;
            bean.email = "byebye@example.com";
            bean.token = "f".repeat(64);
            bean.confirmed = true;
            bean.created_date = R.isoDateTime();
            await R.store(bean);

            await StatusPageSubscriber.unsubscribe("f".repeat(64));

            const row = await R.findOne("status_page_subscriber", " id = ? ", [bean.id]);
            assert.strictEqual(row, null);
        });

        test("does not throw for an unknown or malformed token", async () => {
            await assert.doesNotReject(() => StatusPageSubscriber.unsubscribe("g".repeat(64)));
            await assert.doesNotReject(() => StatusPageSubscriber.unsubscribe("garbage"));
            await assert.doesNotReject(() => StatusPageSubscriber.unsubscribe(null));
        });
    });

    describe("listByGroup() / removeSubscriber()", () => {
        test("lists subscribers without exposing tokens", async () => {
            const { groupId } = await makeStatusPageWithGroup();
            const bean = R.dispense("status_page_subscriber");
            bean.group_id = groupId;
            bean.email = "listed@example.com";
            bean.token = "h".repeat(64);
            bean.confirmed = true;
            bean.created_date = R.isoDateTime();
            await R.store(bean);

            const list = await StatusPageSubscriber.listByGroup(groupId);
            assert.strictEqual(list.length, 1);
            assert.strictEqual(list[0].email, "listed@example.com");
            assert.strictEqual(list[0].confirmed, true);
            assert.strictEqual(list[0].token, undefined);
        });

        test("removeSubscriber only deletes within the given group", async () => {
            const { groupId: groupA } = await makeStatusPageWithGroup();
            const { groupId: groupB } = await makeStatusPageWithGroup();

            const bean = R.dispense("status_page_subscriber");
            bean.group_id = groupA;
            bean.email = "cross-group@example.com";
            bean.token = "i".repeat(64);
            bean.confirmed = true;
            bean.created_date = R.isoDateTime();
            await R.store(bean);

            // Attempting to remove it via the wrong group id must not delete it.
            await StatusPageSubscriber.removeSubscriber(groupB, bean.id);
            assert.ok(await R.findOne("status_page_subscriber", " id = ? ", [bean.id]));

            await StatusPageSubscriber.removeSubscriber(groupA, bean.id);
            assert.strictEqual(await R.findOne("status_page_subscriber", " id = ? ", [bean.id]), null);
        });
    });

    describe("notifyMonitorStatusChange()", () => {
        test("emails confirmed subscribers of the monitor's public groups only", async () => {
            const { statusPageId, groupId: publicGroupId } = await makeStatusPageWithGroup();

            // A second, non-public group on the same page - should never be emailed.
            const privateGroup = R.dispense("group");
            privateGroup.name = "Private Group";
            privateGroup.public = false;
            privateGroup.status_page_id = statusPageId;
            await R.store(privateGroup);

            const monitor = R.dispense("monitor");
            monitor.name = "Test Monitor";
            monitor.type = "http";
            await R.store(monitor);

            for (const groupId of [publicGroupId, privateGroup.id]) {
                const rel = R.dispense("monitor_group");
                rel.monitor_id = monitor.id;
                rel.group_id = groupId;
                await R.store(rel);
            }

            const confirmed = R.dispense("status_page_subscriber");
            confirmed.group_id = publicGroupId;
            confirmed.email = "confirmed-sub@example.com";
            confirmed.token = "j".repeat(64);
            confirmed.confirmed = true;
            confirmed.created_date = R.isoDateTime();
            await R.store(confirmed);

            const pending = R.dispense("status_page_subscriber");
            pending.group_id = publicGroupId;
            pending.email = "pending-sub@example.com";
            pending.token = "k".repeat(64);
            pending.confirmed = false;
            pending.created_date = R.isoDateTime();
            await R.store(pending);

            await StatusPageSubscriber.notifyMonitorStatusChange(monitor, { status: 0 }, "[Test Monitor] [Down] oops");

            assert.strictEqual(sentMails.length, 1);
            assert.strictEqual(sentMails[0].to, "confirmed-sub@example.com");
            assert.match(sentMails[0].subject, /is Down/);
            assert.match(sentMails[0].headers["List-Unsubscribe"], /token=j{64}/);
        });

        test("never throws even if a status page has no subscription notification", async () => {
            const { groupId } = await makeStatusPageWithGroup({ withSmtp: false });
            const monitor = R.dispense("monitor");
            monitor.name = "No SMTP Monitor";
            monitor.type = "http";
            await R.store(monitor);
            const rel = R.dispense("monitor_group");
            rel.monitor_id = monitor.id;
            rel.group_id = groupId;
            await R.store(rel);

            await assert.doesNotReject(() =>
                StatusPageSubscriber.notifyMonitorStatusChange(monitor, { status: 1 }, "msg")
            );
            assert.strictEqual(sentMails.length, 0);
        });
    });

    describe("notifyMaintenanceScheduled()", () => {
        test("emails confirmed subscribers of every public group the maintenance's monitors belong to", async () => {
            const { statusPageId, groupId: publicGroupId } = await makeStatusPageWithGroup();

            const privateGroup = R.dispense("group");
            privateGroup.name = "Private Group";
            privateGroup.public = false;
            privateGroup.status_page_id = statusPageId;
            await R.store(privateGroup);

            const monitor = R.dispense("monitor");
            monitor.name = "Maintained Monitor";
            monitor.type = "http";
            await R.store(monitor);

            for (const groupId of [publicGroupId, privateGroup.id]) {
                const rel = R.dispense("monitor_group");
                rel.monitor_id = monitor.id;
                rel.group_id = groupId;
                await R.store(rel);
            }

            const confirmed = R.dispense("status_page_subscriber");
            confirmed.group_id = publicGroupId;
            confirmed.email = "maint-sub@example.com";
            confirmed.token = "n".repeat(64);
            confirmed.confirmed = true;
            confirmed.created_date = R.isoDateTime();
            await R.store(confirmed);

            await StatusPageSubscriber.notifyMaintenanceScheduled(
                { id: 1, title: "Router upgrade", description: "Brief network blip expected." },
                [ monitor.id ]
            );

            assert.strictEqual(sentMails.length, 1);
            assert.strictEqual(sentMails[0].to, "maint-sub@example.com");
            assert.match(sentMails[0].subject, /Maintenance scheduled: Router upgrade/);
            assert.match(sentMails[0].text, /Brief network blip expected/);
        });

        test("never throws and sends nothing for an empty monitor list", async () => {
            await assert.doesNotReject(() =>
                StatusPageSubscriber.notifyMaintenanceScheduled({ id: 1, title: "No monitors" }, [])
            );
            assert.strictEqual(sentMails.length, 0);
        });
    });

    describe("notifyIncidentSubscribers()", () => {
        test("emails confirmed subscribers of every public group on the page, per group", async () => {
            const { statusPageId, groupId: groupA } = await makeStatusPageWithGroup();

            const groupB = R.dispense("group");
            groupB.name = "Group B";
            groupB.public = true;
            groupB.status_page_id = statusPageId;
            await R.store(groupB);

            const subA = R.dispense("status_page_subscriber");
            subA.group_id = groupA;
            subA.email = "subA@example.com";
            subA.token = "l".repeat(64);
            subA.confirmed = true;
            subA.created_date = R.isoDateTime();
            await R.store(subA);

            const subB = R.dispense("status_page_subscriber");
            subB.group_id = groupB.id;
            subB.email = "subB@example.com";
            subB.token = "m".repeat(64);
            subB.confirmed = true;
            subB.created_date = R.isoDateTime();
            await R.store(subB);

            await StatusPageSubscriber.notifyIncidentSubscribers(statusPageId, {
                title: "Outage",
                content: "Something broke.",
            });

            assert.strictEqual(sentMails.length, 2);
            const recipients = sentMails.map((m) => m.to).sort();
            assert.deepStrictEqual(recipients, ["subA@example.com", "subB@example.com"]);
            for (const mail of sentMails) {
                assert.match(mail.subject, /Outage/);
            }
        });
    });
});
