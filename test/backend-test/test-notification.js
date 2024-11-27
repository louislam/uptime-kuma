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
        hostname: "test.mydomain.com",
        type: "http",
        url: "https://test.mydomain.com/status"
    };

    const msg = {
        type: "down",
        monitor,
        msg: "Connection failed"
    };

    const formatted = notification.format(msg);
    assert.ok(formatted.includes("Test Monitor"), "Should include monitor name");
    assert.ok(formatted.includes("https://test.mydomain.com"), "Should include full URL");
    assert.ok(formatted.includes("Connection failed"), "Should include error message");

    // Test with potentially malicious URLs
    const maliciousMonitor = {
        name: "Test Monitor",
        hostname: "https://malicious.mydomain.com/test.mydomain.com",
        type: "http",
        url: "https://evil.mydomain.com/redirect/https://test.mydomain.com"
    };

    const maliciousMsg = {
        type: "down",
        monitor: maliciousMonitor,
        msg: "Connection failed"
    };

    const maliciousFormatted = notification.format(maliciousMsg);
    assert.ok(!maliciousFormatted.includes("test.mydomain.com"), "Should not include test.mydomain.com as substring");
    assert.ok(maliciousFormatted.includes("https://malicious.mydomain.com"), "Should include exact malicious URL");
});

test("Notification - Status Test", async (t) => {
    const notification = new Notification();

    // Test UP status with secure URL
    const upMsg = {
        type: "up",
        monitor: {
            name: "Test1",
            url: "https://test1.mydomain.com",
            type: "http"
        },
        msg: "Service is up",
        status: UP
    };
    const upFormatted = notification.format(upMsg);
    assert.ok(upFormatted.includes("up"), "Should indicate UP status");
    assert.ok(upFormatted.includes("https://test1.mydomain.com"), "Should include complete URL");

    // Test DOWN status with secure URL
    const downMsg = {
        type: "down",
        monitor: {
            name: "Test2",
            url: "https://test2.mydomain.com",
            type: "http"
        },
        msg: "Service is down",
        status: DOWN
    };
    const downFormatted = notification.format(downMsg);
    assert.ok(downFormatted.includes("down"), "Should indicate DOWN status");
    assert.ok(downFormatted.includes("https://test2.mydomain.com"), "Should include complete URL");
});

test("Notification - Queue Management Test", async (t) => {
    const notification = new Notification();

    // Add items to queue with secure URLs
    notification.add({
        type: "down",
        monitor: {
            name: "Test1",
            url: "https://test1.mydomain.com",
            type: "http"
        },
        msg: "Error 1"
    });

    notification.add({
        type: "up",
        monitor: {
            name: "Test2",
            url: "https://test2.mydomain.com",
            type: "http"
        },
        msg: "Recovered"
    });

    assert.strictEqual(notification.queue.length, 2, "Queue should have 2 items");
});

test("Notification - URL Validation and Sanitization Test", async (t) => {
    const notification = new Notification();

    // Test with various URL formats and edge cases
    const testCases = [
        // Valid URLs
        {
            url: "https://test.mydomain.com",
            valid: true,
            description: "Basic HTTPS URL",
            expectedOutput: "https://test.mydomain.com"
        },
        {
            url: "http://sub.test.mydomain.com",
            valid: true,
            description: "Subdomain URL",
            expectedOutput: "http://sub.test.mydomain.com"
        },
        {
            url: "https://test.mydomain.com/path",
            valid: true,
            description: "URL with path",
            expectedOutput: "https://test.mydomain.com/path"
        },
        {
            url: "https://test.mydomain.com:8080",
            valid: true,
            description: "URL with port",
            expectedOutput: "https://test.mydomain.com:8080"
        },
        {
            url: "https://test.mydomain.com/path?query=1",
            valid: true,
            description: "URL with query parameters",
            expectedOutput: "https://test.mydomain.com/path?query=1"
        },
        {
            url: "https://test.mydomain.com/path#fragment",
            valid: true,
            description: "URL with fragment",
            expectedOutput: "https://test.mydomain.com/path#fragment"
        },
        {
            url: "https://test.mydomain.com/special%20chars",
            valid: true,
            description: "URL with encoded characters",
            expectedOutput: "https://test.mydomain.com/special%20chars"
        },

        // Potentially malicious URLs
        {
            url: "javascript:alert(1)",
            valid: false,
            description: "JavaScript protocol",
            expectedOutput: ""
        },
        {
            url: "data:text/html,<script>alert(1)</script>",
            valid: false,
            description: "Data URL",
            expectedOutput: ""
        },
        {
            url: "file:///etc/passwd",
            valid: false,
            description: "File protocol",
            expectedOutput: ""
        },
        {
            url: "https://malicious.com?redirect=https://test.mydomain.com",
            valid: true,
            description: "URL with redirect parameter",
            expectedOutput: "https://malicious.com?redirect=https://test.mydomain.com"
        },
        {
            url: "https://malicious.com/https://test.mydomain.com",
            valid: true,
            description: "URL with embedded URL in path",
            expectedOutput: "https://malicious.com/https://test.mydomain.com"
        },
        {
            url: "https://test.mydomain.com@malicious.com",
            valid: false,
            description: "URL with @ character",
            expectedOutput: ""
        },
        {
            url: "https://malicious.com\\@test.mydomain.com",
            valid: false,
            description: "URL with escaped @ character",
            expectedOutput: ""
        },
        {
            url: "https:\\\\test.mydomain.com",
            valid: false,
            description: "URL with backslashes",
            expectedOutput: ""
        },
        {
            url: "https://test.mydomain.com/path/<script>alert(1)</script>",
            valid: true,
            description: "URL with XSS in path",
            expectedOutput: "https://test.mydomain.com/path/<script>alert(1)</script>"
        },

        // Edge cases
        {
            url: "https://test.mydomain.com//double//slashes",
            valid: true,
            description: "URL with double slashes",
            expectedOutput: "https://test.mydomain.com//double//slashes"
        },
        {
            url: "https://test.mydomain.com/./path/../test",
            valid: true,
            description: "URL with dot segments",
            expectedOutput: "https://test.mydomain.com/./path/../test"
        },
        {
            url: "https://test.mydomain.com/%2e%2e%2f",
            valid: true,
            description: "URL with encoded dot segments",
            expectedOutput: "https://test.mydomain.com/%2e%2e%2f"
        },
        {
            url: "https://test.mydomain.com/\u0000",
            valid: false,
            description: "URL with null byte",
            expectedOutput: ""
        },
        {
            url: "https://test.mydomain.com/path with spaces",
            valid: true,
            description: "URL with unencoded spaces",
            expectedOutput: "https://test.mydomain.com/path%20with%20spaces"
        },
        {
            url: "https://xn--mnich-kva.example.com",
            valid: true,
            description: "Punycode URL",
            expectedOutput: "https://xn--mnich-kva.example.com"
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
            // For valid URLs, check if the URL is included exactly as expected
            if (testCase.expectedOutput) {
                assert.ok(
                    formatted.includes(testCase.expectedOutput),
                    `${testCase.description}: Should include exact URL ${testCase.expectedOutput}`
                );
            }

            // Check for potential URL substring issues
            if (testCase.url.includes("test.mydomain.com")) {
                const urlParts = testCase.url.split("test.mydomain.com");
                if (urlParts.length > 1) {
                    // Check that we don't have unintended URL substring matches
                    const occurrences = formatted.split("test.mydomain.com").length - 1;
                    assert.strictEqual(
                        occurrences,
                        1,
                        `${testCase.description}: Should only include the URL once`
                    );
                }
            }
        } else {
            // For invalid URLs, ensure they're not included at all
            assert.ok(
                !formatted.includes(testCase.url),
                `${testCase.description}: Should not include invalid URL`
            );

            // For invalid URLs with potentially dangerous parts, ensure those parts are not present
            if (testCase.url.includes("javascript:") ||
                testCase.url.includes("data:") ||
                testCase.url.includes("file:")) {
                assert.ok(
                    !formatted.includes("javascript:") &&
                    !formatted.includes("data:") &&
                    !formatted.includes("file:"),
                    `${testCase.description}: Should not include dangerous protocols`
                );
            }
        }

        // Check for proper URL encoding
        if (testCase.valid && testCase.url.includes(" ")) {
            assert.ok(
                !formatted.includes(" "),
                `${testCase.description}: Spaces should be properly encoded`
            );
            assert.ok(
                formatted.includes("%20"),
                `${testCase.description}: Should use percent encoding for spaces`
            );
        }

        // Additional security checks
        assert.ok(
            !formatted.includes("<script>"),
            `${testCase.description}: Should not include unescaped script tags`
        );
        assert.ok(
            !formatted.includes("javascript:"),
            `${testCase.description}: Should not include javascript: protocol`
        );
    }
});

test("Notification - Priority Test", async (t) => {
    const notification = new Notification();

    // Add items with different priorities
    notification.add({
        type: "down",
        monitor: {
            name: "Test1",
            url: "https://test1.mydomain.com",
            type: "http"
        },
        msg: "Critical Error",
        priority: "high"
    });

    notification.add({
        type: "down",
        monitor: {
            name: "Test2",
            url: "https://test2.mydomain.com",
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
            url: "https://test1.mydomain.com",
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
        url: "https://test.mydomain.com",
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
