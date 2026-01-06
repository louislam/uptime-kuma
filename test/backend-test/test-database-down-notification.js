const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
const { Notification } = require("../../server/notification");
const Database = require("../../server/database");

describe("Database Down Notification", () => {
    let testNotification;

    before(async () => {
        // Initialize data directory first (required before connecting)
        Database.initDataDir({});
        
        // Ensure database is connected (this copies template DB which has basic tables)
        await Database.connect(true); // testMode = true
        
        // Ensure notification table exists with required columns
        const hasNotificationTable = await R.hasTable("notification");
        if (!hasNotificationTable) {
            // Create notification table manually for testing
            await R.exec(`
                CREATE TABLE IF NOT EXISTS notification (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(255),
                    active BOOLEAN NOT NULL DEFAULT 1,
                    user_id INTEGER,
                    is_default BOOLEAN NOT NULL DEFAULT 0,
                    config TEXT
                )
            `);
        } else {
            // Ensure is_default column exists
            try {
                await R.exec("ALTER TABLE notification ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT 0");
            } catch (e) {
                // Column might already exist, ignore
            }
        }

        // Create a test notification
        const notificationBean = R.dispense("notification");
        notificationBean.name = "Test Notification";
        notificationBean.user_id = 1;
        notificationBean.config = JSON.stringify({
            type: "webhook",
            webhookURL: "https://example.com/webhook",
        });
        notificationBean.active = 1;
        notificationBean.is_default = 0;
        await R.store(notificationBean);
        testNotification = notificationBean;
    });

    after(async () => {
        // Clean up test notification
        if (testNotification) {
            try {
                await R.trash(testNotification);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
        await Database.close();
    });

    test("refreshCache() loads notifications into cache", async () => {
        await Notification.refreshCache();
        
        assert.ok(Notification.notificationCache.length > 0, "Cache should contain notifications");
        assert.ok(Notification.cacheLastRefresh > 0, "Cache refresh time should be set");
        
        // Verify test notification is in cache
        const cached = Notification.notificationCache.find(n => n.id === testNotification.id);
        assert.ok(cached, "Test notification should be in cache");
        assert.strictEqual(cached.name, "Test Notification");
        assert.strictEqual(cached.config.type, "webhook");
    });

    test("sendDatabaseDownNotification() uses cached notifications", async () => {
        // Ensure cache is populated
        await Notification.refreshCache();
        assert.ok(Notification.notificationCache.length > 0, "Cache should be populated");

        // Reset the flag
        Notification.resetDatabaseDownFlag();
        assert.strictEqual(Notification.databaseDownNotificationSent, false);

        // Mock the send method to track calls
        let sendCallCount = 0;
        const originalSend = Notification.send;
        Notification.send = async (notification, msg, monitorJSON, heartbeatJSON) => {
            sendCallCount++;
            assert.ok(msg.includes("Database Connection Failed"), "Message should mention database failure");
            assert.ok(monitorJSON.name === "Uptime Kuma System", "Monitor JSON should be system monitor");
            return "OK";
        };

        try {
            await Notification.sendDatabaseDownNotification("Test database error: ECONNREFUSED");
            
            // Should have been called for each notification in cache
            assert.ok(sendCallCount > 0, "send() should have been called");
            assert.strictEqual(Notification.databaseDownNotificationSent, true, "Flag should be set");
        } finally {
            // Restore original send method
            Notification.send = originalSend;
        }
    });

    test("sendDatabaseDownNotification() only sends once per database down event", async () => {
        Notification.resetDatabaseDownFlag();
        
        // Mock the send method
        let sendCallCount = 0;
        const originalSend = Notification.send;
        Notification.send = async () => {
            sendCallCount++;
            return "OK";
        };

        try {
            // First call
            await Notification.sendDatabaseDownNotification("Test error 1");
            const firstCallCount = sendCallCount;
            
            // Second call should not send again
            await Notification.sendDatabaseDownNotification("Test error 2");
            assert.strictEqual(sendCallCount, firstCallCount, "Should not send again");
        } finally {
            Notification.send = originalSend;
        }
    });

    test("sendDatabaseDownNotification() handles empty cache gracefully", async () => {
        // Clear cache
        Notification.notificationCache = [];
        Notification.cacheLastRefresh = 0;
        Notification.resetDatabaseDownFlag();

        // Should not throw
        await Notification.sendDatabaseDownNotification("Test error");
        
        // Flag should remain false since cache is empty
        assert.strictEqual(Notification.databaseDownNotificationSent, false);
    });

    test("resetDatabaseDownFlag() resets the notification flag", () => {
        Notification.databaseDownNotificationSent = true;
        Notification.resetDatabaseDownFlag();
        assert.strictEqual(Notification.databaseDownNotificationSent, false);
    });

    test("refreshCache() handles database errors gracefully", async () => {
        // Temporarily close database connection
        const originalGetAll = R.getAll;
        R.getAll = async () => {
            throw new Error("Database connection lost");
        };

        try {
            // Should not throw
            await Notification.refreshCache();
            
            // Cache should remain unchanged (not cleared)
            assert.ok(Array.isArray(Notification.notificationCache), "Cache should still be an array");
        } finally {
            R.getAll = originalGetAll;
        }
    });
});

