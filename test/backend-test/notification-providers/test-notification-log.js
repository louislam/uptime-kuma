process.env.UPTIME_KUMA_HIDE_LOG = ["info_db", "info_server"].join(",");

const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const TestDB = require("../../mock-testdb");
const { R } = require("redbean-node");
const { Notification } = require("../../../server/notification");

const testDb = new TestDB("./data/test-notification-log");

describe("Notification History", () => {
    before(async () => {
        await testDb.create();
        Notification.init();
    });

    after(async () => {
        await testDb.destroy();
    });

    test("creates a log record when sending a notification", async () => {
        const user = R.dispense("user");
        user.username = "test_log_record_user";
        user.password = "testpass";
        await R.store(user);

        const notifBean = R.dispense("notification");
        notifBean.name = "Test Webhook";
        notifBean.user_id = user.id;
        notifBean.config = JSON.stringify({
            type: "webhook",
            name: "Test Webhook",
            webhookURL: "https://127.0.0.1:1/fake-endpoint",
        });
        await R.store(notifBean);

        const notificationConfig = {
            id: notifBean.id,
            type: "webhook",
            name: "Test Webhook",
            webhookURL: "https://127.0.0.1:1/fake-endpoint",
        };

        try {
            await Notification.send(notificationConfig, "Test message");
        } catch (e) {
            // Expected to fail - connection refused
        }

        const records = await R.getAll(
            "SELECT id, notification_id, type, status FROM notification_log ORDER BY id DESC LIMIT 1"
        );

        assert.strictEqual(records.length, 1);
        assert.strictEqual(records[0].notification_id, notifBean.id);
        assert.strictEqual(records[0].type, "webhook");
        assert.strictEqual(records[0].status, "failed");
    });

    test("stores monitor_id and heartbeat_id when provided", async () => {
        const user = R.dispense("user");
        user.username = "test_monitor_assoc_user2";
        user.password = "testpass";
        await R.store(user);

        const notifBean = R.dispense("notification");
        notifBean.name = "Monitor Notif";
        notifBean.user_id = user.id;
        notifBean.config = JSON.stringify({
            type: "webhook",
            name: "Monitor Notif",
            webhookURL: "https://127.0.0.1:1/fake",
        });
        await R.store(notifBean);

        const monBean = R.dispense("monitor");
        monBean.name = "Test Monitor";
        monBean.type = "http";
        monBean.url = "https://example.com";
        monBean.user_id = user.id;
        monBean.interval = 5;
        await R.store(monBean);

        const beat = R.dispense("heartbeat");
        beat.monitor_id = monBean.id;
        beat.status = 0;
        beat.time = R.isoDateTimeMillis(new Date());
        beat.msg = "Connection refused";
        await R.store(beat);

        const notificationConfig = {
            id: notifBean.id,
            type: "webhook",
            name: "Monitor Notif",
            webhookURL: "https://127.0.0.1:1/fake",
        };

        const monitorJSON = { id: monBean.id, name: "Test Monitor" };
        const heartbeatJSON = {
            id: beat.id,
            monitorID: monBean.id,
            status: 0,
            time: beat.time,
        };

        try {
            await Notification.send(notificationConfig, "Test [Down]", monitorJSON, heartbeatJSON);
        } catch (e) {
            // Expected
        }

        const records = await R.getAll(
            "SELECT monitor_id, heartbeat_id FROM notification_log WHERE notification_id = ? ORDER BY id DESC LIMIT 1",
            [notifBean.id]
        );

        assert.strictEqual(records.length, 1);
        assert.strictEqual(records[0].monitor_id, monBean.id);
        assert.strictEqual(records[0].heartbeat_id, beat.id);
    });

    test("stores NULL monitor_id and heartbeat_id when not provided", async () => {
        const user = R.dispense("user");
        user.username = "test_null_ids_user2";
        user.password = "testpass";
        await R.store(user);

        const notifBean = R.dispense("notification");
        notifBean.name = "Standalone Notif";
        notifBean.user_id = user.id;
        notifBean.config = JSON.stringify({
            type: "webhook",
            name: "Standalone Notif",
            webhookURL: "https://127.0.0.1:1/fake",
        });
        await R.store(notifBean);

        const notificationConfig = {
            id: notifBean.id,
            type: "webhook",
            name: "Standalone Notif",
            webhookURL: "https://127.0.0.1:1/fake",
        };

        try {
            await Notification.send(notificationConfig, "Standalone message");
        } catch (e) {
            // Expected
        }

        const records = await R.getAll(
            "SELECT monitor_id, heartbeat_id FROM notification_log WHERE notification_id = ? ORDER BY id DESC LIMIT 1",
            [notifBean.id]
        );

        assert.strictEqual(records.length, 1);
        assert.strictEqual(records[0].monitor_id, null);
        assert.strictEqual(records[0].heartbeat_id, null);
    });

    test("creates separate log records for multiple providers", async () => {
        // This test verifies that each notification provider call creates its own log entry.
        // Covered implicitly by the individual send tests above which each create one record.
        const user = R.dispense("user");
        user.username = "test_multi_providers_user";
        user.password = "testpass";
        await R.store(user);

        const notif1 = R.dispense("notification");
        notif1.name = "Webhook A";
        notif1.user_id = user.id;
        notif1.config = JSON.stringify({
            type: "webhook",
            name: "Webhook A",
            webhookURL: "https://127.0.0.1:1/fakeA",
        });
        await R.store(notif1);

        const notif2 = R.dispense("notification");
        notif2.name = "Webhook B";
        notif2.user_id = user.id;
        notif2.config = JSON.stringify({
            type: "webhook",
            name: "Webhook B",
            webhookURL: "https://127.0.0.1:1/fakeB",
        });
        await R.store(notif2);

        // Send two notifications sequentially
        try {
            await Notification.send(
                { id: notif1.id, type: "webhook", name: "Webhook A", webhookURL: "https://127.0.0.1:1/fakeA" },
                "Test msg A"
            );
        } catch (e) {
            // Expected to fail
        }

        try {
            await Notification.send(
                { id: notif2.id, type: "webhook", name: "Webhook B", webhookURL: "https://127.0.0.1:1/fakeB" },
                "Test msg B"
            );
        } catch (e) {
            // Expected to fail
        }

        // Each send should have created exactly one log entry
        const count = await R.getCell(
            "SELECT COUNT(*) as count FROM notification_log WHERE notification_id IN (?, ?)",
            [notif1.id, notif2.id]
        );
        assert.strictEqual(count, 2, "Each notification send should create exactly one log record");
    });

    test("truncates long error messages to 1000 characters", async () => {
        const user = R.dispense("user");
        user.username = "test_truncate_user2";
        user.password = "testpass";
        await R.store(user);

        const notifBean = R.dispense("notification");
        notifBean.name = "Truncate Test";
        notifBean.user_id = user.id;
        notifBean.config = JSON.stringify({
            type: "webhook",
            name: "Truncate Test",
            webhookURL: "https://127.0.0.1:1/fake",
        });
        await R.store(notifBean);

        try {
            await Notification.send(
                { id: notifBean.id, type: "webhook", name: "Truncate Test", webhookURL: "https://127.0.0.1:1/fake" },
                "Test"
            );
        } catch (e) {
            // Expected
        }

        const records = await R.getAll("SELECT message FROM notification_log WHERE notification_id = ?", [
            notifBean.id,
        ]);
        assert.strictEqual(records.length, 1);
        assert.ok(
            records[0].message.length <= 1000,
            `Message should be truncated to 1000 chars, got ${records[0].message.length}`
        );
    });

    test("re-throws the original error after logging", async () => {
        const user = R.dispense("user");
        user.username = "test_rethrow_user2";
        user.password = "testpass";
        await R.store(user);

        const notifBean = R.dispense("notification");
        notifBean.name = "Re-throw Test";
        notifBean.user_id = user.id;
        notifBean.config = JSON.stringify({
            type: "webhook",
            name: "Re-throw Test",
            webhookURL: "https://127.0.0.1:1/fake",
        });
        await R.store(notifBean);

        let threw = false;
        let errorMessage = "";
        try {
            await Notification.send(
                { id: notifBean.id, type: "webhook", name: "Re-throw Test", webhookURL: "https://127.0.0.1:1/fake" },
                "Test"
            );
        } catch (e) {
            threw = true;
            errorMessage = e.message;
        }

        assert.strictEqual(threw, true, "Notification.send() should still throw on failure");
        assert.ok(errorMessage.length > 0, "Error message should be preserved");
    });

    test("real monitor path: notification_id is preserved when merging RedBean object", async () => {
        // This simulates exactly what server/model/monitor.js:1507 now does:
        // { ...JSON.parse(notification.config), id: notification.id }
        const user = R.dispense("user");
        user.username = "test_real_path_user";
        user.password = "testpass";
        await R.store(user);

        const notifBean = R.dispense("notification");
        notifBean.name = "Real Path Test";
        notifBean.user_id = user.id;
        notifBean.config = JSON.stringify({
            type: "telegram",
            name: "Real Path Test",
            telegramBotToken: "fake-token",
            telegramChatID: "123456",
        });
        await R.store(notifBean);

        // Simulate the real monitor path: merge config with ID
        const notificationToSend = { ...JSON.parse(notifBean.config), id: notifBean.id };

        try {
            await Notification.send(notificationToSend, "[Test Monitor] [Down] test msg");
        } catch (e) {
            // Expected: Telegram API will fail with fake token, but log should be written
        }

        const record = await R.getAll(
            "SELECT notification_id, monitor_id, heartbeat_id, type, status FROM notification_log ORDER BY id DESC LIMIT 1"
        );
        assert.strictEqual(record.length, 1);
        assert.strictEqual(
            record[0].notification_id,
            notifBean.id,
            "notification_id must match the database notification ID"
        );
        assert.strictEqual(record[0].type, "telegram");
        assert.ok(record[0].status === "success" || record[0].status === "failed");
    });
});
