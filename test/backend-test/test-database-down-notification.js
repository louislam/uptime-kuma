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

        // Run migrations to ensure schema is current
        // The template database already has basic tables, so we just need to run migrations
        const path = require("path");
        const hasNotificationTable = await R.hasTable("notification");
        
        if (!hasNotificationTable) {
            // If notification table doesn't exist, create all tables first
            const { createTables } = require("../../db/knex_init_db.js");
            await createTables();
        }
        
        // Run migrations to ensure schema is current
        try {
            await R.knex.migrate.latest({
                directory: path.join(__dirname, "../../db/knex_migrations")
            });
        } catch (e) {
            // For migration errors, log but continue - test might still work
            // Some migrations may fail if they reference tables that don't exist in test DB
            if (!e.message.includes("the following files are missing:")) {
                console.warn("Migration warning (may be expected):", e.message);
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
        // Config is stored as raw string, parse to verify
        const config = JSON.parse(cached.config);
        assert.strictEqual(config.type, "webhook");
    });

    test("sendDatabaseDownNotification() uses cached notifications and prevents duplicates", async () => {
        // Ensure cache is populated
        await Notification.refreshCache();
        assert.ok(Notification.notificationCache.length > 0, "Cache should be populated");

        // Reset the flag
        Notification.resetDatabaseDownFlag();
        assert.strictEqual(Notification.databaseDownNotificationSent, false);

        // Mock the send method to track calls
        let sendCallCount = 0;
        const originalSend = Notification.send;
        Notification.send = async (notification, msg) => {
            sendCallCount++;
            assert.ok(msg.includes("Database Connection Failed"), "Message should mention database failure");
            return "OK";
        };

        try {
            // First call should send
            await Notification.sendDatabaseDownNotification("Test database error: ECONNREFUSED");
            assert.ok(sendCallCount > 0, "send() should have been called");
            assert.strictEqual(Notification.databaseDownNotificationSent, true, "Flag should be set");
            
            const firstCallCount = sendCallCount;

            // Second call should not send again (duplicate prevention)
            await Notification.sendDatabaseDownNotification("Test error 2");
            assert.strictEqual(sendCallCount, firstCallCount, "Should not send again on second call");
        } finally {
            // Restore original send method
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
        // Ensure cache is populated first
        await Notification.refreshCache();
        const originalCacheLength = Notification.notificationCache.length;
        const originalCacheItems = JSON.parse(JSON.stringify(Notification.notificationCache)); // Deep copy

        // Temporarily mock R.find to throw an error
        const originalFind = R.find;
        R.find = async () => {
            throw new Error("Database connection lost");
        };

        try {
            // Should not throw
            await Notification.refreshCache();

            // Cache should remain unchanged (not cleared)
            assert.ok(Array.isArray(Notification.notificationCache), "Cache should still be an array");
            assert.strictEqual(Notification.notificationCache.length, originalCacheLength, "Cache should have same length");
            assert.deepStrictEqual(Notification.notificationCache, originalCacheItems, "Cache should contain same items");
        } finally {
            R.find = originalFind;
        }
    });
});

