process.env.UPTIME_KUMA_HIDE_LOG = ["info_db", "info_server", "info"].join(",");

const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
// Load a server module before the test database helper. server/database.js and
// server/better-auth.ts import each other, so the database module must not be
// the first entry point of the process.
const { Notification } = require("../../server/notification");
const TestDB = require("../mock-testdb");
const ConfigTransfer = require("../../server/config-transfer");

const testDb = new TestDB("./data/test-config-transfer");

/**
 * Create a monitor directly in the database.
 * @param {string} name Monitor name
 * @param {string} type Monitor type
 * @param {object} extra Additional properties
 * @returns {Promise<number>} Monitor ID
 */
async function createMonitor(name, type, extra = {}) {
    const bean = R.dispense("monitor");
    bean.name = name;
    bean.type = type;
    bean.active = true;
    bean.interval = 60;
    bean.retryInterval = 60;
    bean.url = "https://example.com";
    Object.assign(bean, extra);
    return await R.store(bean);
}

/**
 * Create a notification directly in the database.
 * @param {string} name Notification name
 * @returns {Promise<number>} Notification ID
 */
async function createNotification(name) {
    const bean = R.dispense("notification");
    bean.name = name;
    bean.active = true;
    bean.is_default = false;
    bean.config = JSON.stringify({
        name,
        type: "webhook",
        isDefault: false,
        applyExisting: false,
        webhookURL: "https://example.com/hook",
        webhookContentType: "json",
    });
    return await R.store(bean);
}

/**
 * Count rows of a table.
 * @param {string} table Table name
 * @returns {Promise<number>} Row count
 */
async function count(table) {
    const rows = await R.getAll(`SELECT COUNT(*) AS count FROM \`${table}\``);
    return rows[0].count;
}

/**
 * Remove all monitors, notifications and links without stopping monitors
 * (the monitors are never started in this test file).
 * @returns {Promise<void>}
 */
async function clearAll() {
    await R.exec("DELETE FROM monitor_notification");
    await R.exec("DELETE FROM monitor");
    await R.exec("DELETE FROM notification");
}

describe("Config transfer", () => {
    before(async () => {
        await testDb.create();
        Notification.init();
    });

    after(async () => {
        await testDb.destroy();
    });

    test("exports monitors, groups, notifications and links", async () => {
        await clearAll();

        const groupID = await createMonitor("Group", "group");
        const childID = await createMonitor("Child", "http", {
            parent: groupID,
            accepted_statuscodes_json: '["200-299"]',
            headers: JSON.stringify({ Authorization: "secret" }),
        });
        const notificationID = await createNotification("Webhook");

        await R.exec("INSERT INTO monitor_notification (monitor_id, notification_id) VALUES (?, ?)", [
            childID,
            notificationID,
        ]);

        const data = await ConfigTransfer.exportConfig();

        assert.strictEqual(data.format, "uptime-kuma-config");
        assert.strictEqual(data.version, 1);
        assert.strictEqual(typeof data.appVersion, "string");
        assert.strictEqual(data.monitors.length, 2);
        assert.strictEqual(data.notifications.length, 1);

        const group = data.monitors.find((m) => m.config.name === "Group");
        const child = data.monitors.find((m) => m.config.name === "Child");
        const notification = data.notifications[0];

        assert.ok(group);
        assert.ok(child);
        assert.strictEqual(group.parentRef, null);
        assert.strictEqual(child.parentRef, group.ref);
        assert.deepStrictEqual(child.notificationRefs, [notification.ref]);

        // Instance specific and runtime columns must not be exported
        for (const key of ["id", "user_id", "created_date", "last_check", "dns_last_result", "parent"]) {
            assert.strictEqual(key in child.config, false, `${key} should not be exported`);
        }

        // Secrets are part of the export on purpose
        assert.strictEqual(child.config.headers, JSON.stringify({ Authorization: "secret" }));

        assert.strictEqual(notification.name, "Webhook");
        assert.strictEqual(notification.type, "webhook");
        assert.strictEqual(notification.isDefault, false);
        assert.strictEqual(notification.config.webhookURL, "https://example.com/hook");
        assert.strictEqual("type" in notification.config, false);
        assert.strictEqual("name" in notification.config, false);
    });

    test("round-trips the export into an empty instance", async () => {
        const exported = await ConfigTransfer.exportConfig();
        await clearAll();

        const result = await ConfigTransfer.importConfig(exported, { mode: "merge" });

        assert.strictEqual(result.monitors.imported, 2);
        assert.strictEqual(result.monitors.skipped, 0);
        assert.strictEqual(result.notifications.imported, 1);
        assert.strictEqual(result.warnings.length, 0);

        const group = await R.findOne("monitor", " name = ? ", ["Group"]);
        const child = await R.findOne("monitor", " name = ? ", ["Child"]);
        const notification = await R.findOne("notification", " name = ? ", ["Webhook"]);

        assert.ok(group);
        assert.ok(child);
        assert.ok(notification);
        assert.strictEqual(child.parent, group.id);
        assert.strictEqual(child.headers, JSON.stringify({ Authorization: "secret" }));

        const notificationConfig = JSON.parse(notification.config);
        assert.strictEqual(notificationConfig.type, "webhook");
        assert.strictEqual(notificationConfig.name, "Webhook");
        assert.strictEqual(notificationConfig.isDefault, false);
        assert.strictEqual(notificationConfig.applyExisting, false);

        const links = await R.getAll("SELECT * FROM monitor_notification");
        assert.strictEqual(links.length, 1);
        assert.strictEqual(links[0].monitor_id, child.id);
        assert.strictEqual(links[0].notification_id, notification.id);
    });

    test("merge mode keeps existing data", async () => {
        await createMonitor("Existing", "http");

        const exported = await ConfigTransfer.exportConfig();
        const result = await ConfigTransfer.importConfig(exported, { mode: "merge" });

        assert.strictEqual(result.monitors.imported, 3);
        assert.strictEqual(await count("monitor"), 6);
        assert.strictEqual(await count("notification"), 2);
    });

    test("replace mode removes existing monitors and notifications", async () => {
        const exported = await ConfigTransfer.exportConfig();
        const group = exported.monitors.find((m) => m.config.name === "Group");
        const child = exported.monitors.find((m) => m.config.name === "Child");
        const usedNotificationRefs = new Set(child.notificationRefs);

        // Only keep the group, the child and the notification they use.
        const data = {
            ...exported,
            monitors: [group, child],
            notifications: exported.notifications.filter((n) => usedNotificationRefs.has(n.ref)),
        };

        const result = await ConfigTransfer.importConfig(data, { mode: "replace" });

        assert.strictEqual(result.monitors.imported, 2);
        assert.strictEqual(await count("monitor"), 2);
        assert.strictEqual(await count("notification"), 1);
        assert.strictEqual(await count("monitor_notification"), 1);
        assert.strictEqual(await R.findOne("monitor", " name = ? ", ["Existing"]), null);
    });

    test("rejects invalid files without touching the database", async () => {
        const monitorsBefore = await count("monitor");
        const notificationsBefore = await count("notification");

        await assert.rejects(
            () => ConfigTransfer.importConfig({ format: "something-else", version: 1, monitors: [] }),
            /Invalid configuration file/
        );
        await assert.rejects(() => ConfigTransfer.importConfig("not json"), /not valid JSON/);
        await assert.rejects(
            () => ConfigTransfer.importConfig({ format: "uptime-kuma-config", version: 99, monitors: [] }),
            /Invalid configuration file/
        );
        await assert.rejects(
            () =>
                ConfigTransfer.importConfig({
                    format: "uptime-kuma-config",
                    version: 1,
                    notifications: [],
                    monitors: [
                        { ref: "m1", parentRef: "missing", notificationRefs: [], config: { name: "A", type: "http" } },
                    ],
                }),
            /unknown parent/
        );
        await assert.rejects(
            () =>
                ConfigTransfer.importConfig({
                    format: "uptime-kuma-config",
                    version: 1,
                    notifications: [],
                    monitors: [
                        { ref: "m1", parentRef: "m2", notificationRefs: [], config: { name: "A", type: "group" } },
                        { ref: "m2", parentRef: "m1", notificationRefs: [], config: { name: "B", type: "group" } },
                    ],
                }),
            /parent cycle/
        );

        assert.strictEqual(await count("monitor"), monitorsBefore);
        assert.strictEqual(await count("notification"), notificationsBefore);
    });

    test("clears instance references and ignores unknown columns", async () => {
        const result = await ConfigTransfer.importConfig(
            {
                format: "uptime-kuma-config",
                version: 1,
                notifications: [],
                monitors: [
                    {
                        ref: "m1",
                        parentRef: null,
                        notificationRefs: ["missing-notification"],
                        config: {
                            id: 999,
                            user_id: 1,
                            name: "References",
                            type: "http",
                            url: "https://example.com",
                            proxy_id: 42,
                            docker_host: 43,
                            non_existing_column: "should be ignored",
                        },
                    },
                ],
            },
            { mode: "merge" }
        );

        assert.strictEqual(result.monitors.imported, 1);
        assert.strictEqual(result.monitors.skipped, 0);
        assert.strictEqual(result.importedMonitorIDs.length, 1);
        assert.ok(result.warnings.some((w) => w.includes("proxy_id")));
        assert.ok(result.warnings.some((w) => w.includes("notification")));

        const monitor = await R.findOne("monitor", " id = ? ", [result.importedMonitorIDs[0]]);
        assert.strictEqual(monitor.name, "References");
        assert.strictEqual(monitor.proxy_id, null);
        assert.strictEqual(monitor.docker_host, null);
        assert.notStrictEqual(monitor.id, 999);
        assert.strictEqual("non_existing_column" in monitor, false);
    });

    test("skips notifications without a supported type but keeps unknown monitor types", async () => {
        const result = await ConfigTransfer.importConfig(
            {
                format: "uptime-kuma-config",
                version: 1,
                notifications: [
                    { ref: "n1", name: "Unknown", type: "does-not-exist", isDefault: false, config: {} },
                    { ref: "n2", name: "No type", type: "", isDefault: false, config: {} },
                ],
                monitors: [
                    { ref: "m1", parentRef: null, notificationRefs: [], config: { name: "Unknown", type: "nope" } },
                ],
            },
            { mode: "merge" }
        );

        assert.strictEqual(result.notifications.imported, 0);
        assert.strictEqual(result.notifications.skipped, 2);
        // Monitor types are not validated, the frontend and the add handler do not validate them either.
        assert.strictEqual(result.monitors.imported, 1);
        assert.strictEqual(result.monitors.skipped, 0);
        assert.strictEqual(result.warnings.length, 2);
    });
});
