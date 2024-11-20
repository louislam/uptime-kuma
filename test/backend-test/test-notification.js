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
        hostname: "https://example.com",
        type: "http",
        url: "https://example.com/status"
    };

    const msg = {
        type: "down",
        monitor,
        msg: "Connection failed"
    };

    const formatted = notification.format(msg);
    assert.ok(formatted.includes("Test Monitor"), "Should include monitor name");
    assert.ok(formatted.includes("https://example.com"), "Should include full URL");
    assert.ok(formatted.includes("Connection failed"), "Should include error message");

    // Test with potentially malicious URLs
    const maliciousMonitor = {
        name: "Test Monitor",
        hostname: "https://malicious.com/example.com",
        type: "http",
        url: "https://evil.com/redirect/https://example.com"
    };

    const maliciousMsg = {
        type: "down",
        monitor: maliciousMonitor,
        msg: "Connection failed"
    };

    const maliciousFormatted = notification.format(maliciousMsg);
    assert.ok(!maliciousFormatted.includes("example.com"), "Should not include example.com as substring");
    assert.ok(maliciousFormatted.includes("https://malicious.com"), "Should include exact malicious URL");
});

test("Notification - Status Test", async (t) => {
    const notification = new Notification();

    // Test UP status with secure URL
    const upMsg = {
        type: "up",
        monitor: {
            name: "Test1",
            url: "https://test1.example.com",
            type: "http"
        },
        msg: "Service is up",
        status: UP
    };
    const upFormatted = notification.format(upMsg);
    assert.ok(upFormatted.includes("up"), "Should indicate UP status");
    assert.ok(upFormatted.includes("https://test1.example.com"), "Should include complete URL");

    // Test DOWN status with secure URL
    const downMsg = {
        type: "down",
        monitor: {
            name: "Test2",
            url: "https://test2.example.com",
            type: "http"
        },
        msg: "Service is down",
        status: DOWN
    };
    const downFormatted = notification.format(downMsg);
    assert.ok(downFormatted.includes("down"), "Should indicate DOWN status");
    assert.ok(downFormatted.includes("https://test2.example.com"), "Should include complete URL");
});

test("Notification - Queue Management Test", async (t) => {
    const notification = new Notification();

    // Add items to queue with secure URLs
    notification.add({
        type: "down",
        monitor: {
            name: "Test1",
            url: "https://test1.example.com",
            type: "http"
        },
        msg: "Error 1"
    });

    notification.add({
        type: "up",
        monitor: {
            name: "Test2",
            url: "https://test2.example.com",
            type: "http"
        },
        msg: "Recovered"
    });

    assert.strictEqual(notification.queue.length, 2, "Queue should have 2 items");
});

test("Notification - URL Validation Test", async (t) => {
    const notification = new Notification();

    // Test with various URL formats
    const testCases = [
        {
            url: "https://example.com",
            valid: true,
            description: "Basic HTTPS URL"
        },
        {
            url: "http://sub.example.com",
            valid: true,
            description: "Subdomain URL"
        },
        {
            url: "https://example.com/path",
            valid: true,
            description: "URL with path"
        },
        {
            url: "https://malicious.com/example.com",
            valid: true,
            description: "URL with misleading path"
        },
        {
            url: "javascript:alert(1)",
            valid: false,
            description: "JavaScript protocol"
        },
        {
            url: "data:text/html,<script>alert(1)</script>",
            valid: false,
            description: "Data URL"
        }
    ];

    for (const testCase of testCases) {
        const msg = {
            type: "down",
            monitor: {
                name: "Test",
                url: testCase.url,
                type: "http"
            },
            msg: "Test message"
        };

        const formatted = notification.format(msg);
        if (testCase.valid) {
            assert.ok(formatted.includes(testCase.url), `Should include ${testCase.description}`);
        } else {
            assert.ok(!formatted.includes(testCase.url), `Should not include ${testCase.description}`);
        }
    }
});

test("Notification - Priority Test", async (t) => {
    const notification = new Notification();

    // Add items with different priorities
    notification.add({
        type: "down",
        monitor: {
            name: "Test1",
            url: "https://test1.example.com",
            type: "http"
        },
        msg: "Critical Error",
        priority: "high"
    });

    notification.add({
        type: "down",
        monitor: {
            name: "Test2",
            url: "https://test2.example.com",
            type: "http"
        },
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
        monitor: {
            name: "Test1",
            url: "https://test1.example.com",
            type: "http"
        },
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
    const monitor = {
        name: "Test Monitor",
        url: "https://example.com",
        type: "http"
    };

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
