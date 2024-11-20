const test = require("node:test");
const assert = require("node:assert");
const { Notification } = require("../../server/notification");
const { UP, DOWN } = require("../../src/util");

test("Notification - Basic Creation Test", async (t) => {
    const notification = new Notification();
    assert.ok(notification, "Should create notification instance");
    assert.ok(typeof notification.send === "function", "Should have send method");
});

test("Notification - Format Message Test", async (t) => {
    const notification = new Notification();
    
    const monitor = {
        name: "Test Monitor",
        hostname: "example.com"
    };
    
    const msg = {
        type: "down",
        monitor,
        msg: "Connection failed"
    };

    const formatted = notification.format(msg);
    assert.ok(formatted.includes("Test Monitor"), "Should include monitor name");
    assert.ok(formatted.includes("example.com"), "Should include hostname");
    assert.ok(formatted.includes("Connection failed"), "Should include error message");
});

test("Notification - Queue Management Test", async (t) => {
    const notification = new Notification();
    
    // Add items to queue
    notification.add({
        type: "down",
        monitor: { name: "Test1" },
        msg: "Error 1"
    });
    
    notification.add({
        type: "up",
        monitor: { name: "Test2" },
        msg: "Recovered"
    });
    
    assert.strictEqual(notification.queue.length, 2, "Queue should have 2 items");
});

test("Notification - Priority Test", async (t) => {
    const notification = new Notification();
    
    // Add items with different priorities
    notification.add({
        type: "down",
        monitor: { name: "Test1" },
        msg: "Critical Error",
        priority: "high"
    });
    
    notification.add({
        type: "down",
        monitor: { name: "Test2" },
        msg: "Warning",
        priority: "low"
    });
    
    const nextItem = notification.queue[0];
    assert.strictEqual(nextItem.priority, "high", "High priority item should be first");
});

test("Notification - Retry Logic Test", async (t) => {
    const notification = new Notification();
    
    const testMsg = {
        type: "down",
        monitor: { name: "Test1" },
        msg: "Error",
        retries: 0,
        maxRetries: 3
    };
    
    notification.add(testMsg);
    
    // Simulate failed send
    try {
        await notification.send(testMsg);
    } catch (error) {
        assert.ok(testMsg.retries === 1, "Should increment retry count");
        assert.ok(notification.queue.length === 1, "Should keep in queue for retry");
    }
});

test("Notification - Rate Limiting Test", async (t) => {
    const notification = new Notification();
    const monitor = { name: "Test Monitor" };
    
    // Add multiple notifications for same monitor
    for (let i = 0; i < 5; i++) {
        notification.add({
            type: "down",
            monitor,
            msg: `Error ${i}`
        });
    }
    
    // Check if rate limiting is applied
    const processedCount = notification.queue.filter(
        item => item.monitor.name === "Test Monitor"
    ).length;
    
    assert.ok(processedCount < 5, "Should apply rate limiting");
});
