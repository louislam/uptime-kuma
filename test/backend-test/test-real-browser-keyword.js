const test = require("node:test");
const assert = require("node:assert");
const { RealBrowserTestHelper, UP } = require("./real-browser-test-helper");

test("Real Browser Monitor Integration Tests", async (t) => {
    const helper = new RealBrowserTestHelper();
    await helper.initialize();
    helper.setupTestCleanup(t);

    await t.test("should pass when no keyword is configured", async () => {
        // Given: A page with "Hello World! This is a test page with sample content."
        const pageUrl = "data:text/html;charset=utf-8,<!DOCTYPE html><html><head><title>Test</title></head><body>Hello World! This is a test page with sample content.</body></html>";
        const monitor = {
            id: 1,
            type: "real-browser",
            url: pageUrl,
            keyword: undefined,
            invertKeyword: false
        };

        // When: Running the monitor without a keyword
        const heartbeat = await helper.runMonitorTest(monitor);

        // Then: Monitor should be UP with just HTTP status
        assert.strictEqual(heartbeat.status, UP, "Monitor should be UP");
        assert.strictEqual(heartbeat.msg, "200", "Should show HTTP status");
        assert.strictEqual(typeof heartbeat.ping, "number", "Should have ping time");
    });

    await t.test("should pass when keyword found and not inverted", async () => {
        // Given: A page containing "Hello World"
        const pageUrl = "data:text/html;charset=utf-8,<!DOCTYPE html><html><head><title>Test</title></head><body>Hello World! This is a test page with sample content.</body></html>";
        const monitor = {
            id: 2,
            type: "real-browser",
            url: pageUrl,
            keyword: "Hello",
            invertKeyword: false
        };

        // When: Searching for "Hello" without inversion
        const heartbeat = await helper.runMonitorTest(monitor);

        // Then: Monitor should be UP and report keyword found
        assert.strictEqual(heartbeat.status, UP, "Monitor should be UP when keyword found");
        assert.strictEqual(heartbeat.msg, "200, keyword \"Hello\" found", "Should indicate keyword found");
        assert.strictEqual(typeof heartbeat.ping, "number", "Should have ping time");
    });

    await t.test("should pass when keyword not found but inverted", async () => {
        // Given: A page without the word "Missing"
        const pageUrl = "data:text/html;charset=utf-8,<!DOCTYPE html><html><head><title>Test</title></head><body>This is a test page with sample content.</body></html>";
        const monitor = {
            id: 3,
            type: "real-browser",
            url: pageUrl,
            keyword: "Missing",
            invertKeyword: true
        };

        // When: Searching for "Missing" with inversion
        const heartbeat = await helper.runMonitorTest(monitor);

        // Then: Monitor should be UP because keyword is not found (which is what we want)
        assert.strictEqual(heartbeat.status, UP, "Monitor should be UP when keyword not found and inverted");
        assert.strictEqual(heartbeat.msg, "200, keyword \"Missing\" not found", "Should indicate keyword not found");
        assert.strictEqual(typeof heartbeat.ping, "number", "Should have ping time");
    });

    await t.test("should fail when keyword not found and not inverted", async () => {
        // Given: A page without the word "Missing"
        const pageUrl = "data:text/html;charset=utf-8,<!DOCTYPE html><html><head><title>Test</title></head><body>This is a test page with sample content.</body></html>";
        const monitor = {
            id: 4,
            type: "real-browser",
            url: pageUrl,
            keyword: "Missing",
            invertKeyword: false
        };

        // When: Searching for "Missing" without inversion
        // Then: Should throw error because keyword is not found
        await assert.rejects(
            async () => await helper.runMonitorTest(monitor),
            new RegExp("Keyword check failed.*Keyword \"Missing\" not found on page.*Expected: found"),
            "Should throw when keyword not found and not inverted"
        );
    });

    await t.test("should fail when keyword found but inverted", async () => {
        // Given: A page containing "Hello"
        const pageUrl = "data:text/html;charset=utf-8,<!DOCTYPE html><html><head><title>Test</title></head><body>Hello World! This is a test page with sample content.</body></html>";
        const monitor = {
            id: 5,
            type: "real-browser",
            url: pageUrl,
            keyword: "Hello",
            invertKeyword: true
        };

        // When: Searching for "Hello" with inversion
        // Then: Should throw error because keyword is found (but we wanted it NOT found)
        await assert.rejects(
            async () => await helper.runMonitorTest(monitor),
            new RegExp("Keyword check failed.*Keyword \"Hello\" found on page.*Expected: not found"),
            "Should throw when keyword found but should be inverted"
        );
    });

    await t.test("should handle text extraction with html tags and whitespace correctly", async () => {
        // Given: A page with extra whitespace "Hello    World!\n\n   This is a    test page."
        const pageUrl = "data:text/html;charset=utf-8,<!DOCTYPE html><html><head><title>Test</title></head><body><span>Hello</span>    World!\n\n   This is a    test page.</body></html>";
        const monitor = {
            id: 6,
            type: "real-browser",
            url: pageUrl,
            keyword: "Hello World!",
            invertKeyword: false
        };

        // When: Searching for "Hello" in normalized text
        const heartbeat = await helper.runMonitorTest(monitor);

        // Then: Should find the keyword despite extra whitespace
        assert.strictEqual(heartbeat.status, UP, "Should handle html text extraction correctly");
        assert.strictEqual(heartbeat.msg, "200, keyword \"Hello World!\" found", "Should find keyword in normalized text");
    });

    await t.test("should handle empty keyword as no keyword", async () => {
        // Given: A page with content and an empty keyword
        const pageUrl = "data:text/html;charset=utf-8,<!DOCTYPE html><html><head><title>Test</title></head><body>Hello World! This is a test page with sample content.</body></html>";
        const monitor = {
            id: 7,
            type: "real-browser",
            url: pageUrl,
            keyword: "",
            invertKeyword: false
        };

        // When: Running monitor with empty keyword
        const heartbeat = await helper.runMonitorTest(monitor);

        // Then: Empty keyword should be ignored, no keyword checking
        assert.strictEqual(heartbeat.status, UP, "Empty keyword should be ignored");
        assert.strictEqual(heartbeat.msg, "200", "Should not include keyword info for empty keyword");
    });

    await t.test("should handle whitespace-only keyword as no keyword", async () => {
        // Given: A page with content and a whitespace-only keyword
        const pageUrl = "data:text/html;charset=utf-8,<!DOCTYPE html><html><head><title>Test</title></head><body>Hello World! This is a test page with sample content.</body></html>";
        const monitor = {
            id: 8,
            type: "real-browser",
            url: pageUrl,
            keyword: "   ",
            invertKeyword: false
        };

        // When: Running monitor with whitespace-only keyword
        const heartbeat = await helper.runMonitorTest(monitor);

        // Then: Whitespace-only keyword should be ignored
        assert.strictEqual(heartbeat.status, UP, "Whitespace-only keyword should be ignored");
        assert.strictEqual(heartbeat.msg, "200", "Should not include keyword info for whitespace keyword");
    });

    await t.test("should handle special characters correctly (no encoding issues)", async () => {
        // Given: A page with special characters "àáâãäå øñü"
        const pageUrl = "data:text/html;charset=utf-8,<!DOCTYPE html><html><head><title>Test</title></head><body>Hello World! Special chars: àáâãäå øñü</body></html>";
        const monitor = {
            id: 9,
            type: "real-browser",
            url: pageUrl,
            keyword: "àáâãäå",
            invertKeyword: false
        };

        // When: Searching for special characters
        const heartbeat = await helper.runMonitorTest(monitor);

        // Then: Should find special character keywords
        assert.strictEqual(heartbeat.status, UP, "Should find special character keywords");
        assert.strictEqual(heartbeat.msg, "200, keyword \"àáâãäå\" found", "Should handle special chars correctly");
    });

    await t.test("should handle case sensitivity correctly", async () => {
        // Given: A page with "Hello" (capital H)
        const pageUrl = "data:text/html;charset=utf-8,<!DOCTYPE html><html><head><title>Test</title></head><body>Hello World! This is a test page with sample content.</body></html>";
        const monitor = {
            id: 10,
            type: "real-browser",
            url: pageUrl,
            keyword: "hello", // lowercase
            invertKeyword: false
        };

        // When: Searching for lowercase "hello" when page has uppercase "Hello"
        // Then: Should fail because search is case-sensitive
        await assert.rejects(
            async () => await helper.runMonitorTest(monitor),
            new RegExp("Keyword check failed.*Keyword \"hello\" not found on page.*Expected: found"),
            "Should be case sensitive by default"
        );
    });

    await t.test("should truncate long error messages correctly", async () => {
        // Given: A page with very long content (100 A's + more text)
        const longContent = "A".repeat(100) + " This is some long content for truncation testing";
        const pageUrl = `data:text/html;charset=utf-8,<!DOCTYPE html><html><head><title>Test</title></head><body>${longContent}</body></html>`;
        const monitor = {
            id: 13,
            type: "real-browser",
            url: pageUrl,
            keyword: "NotFoundKeyword",
            invertKeyword: false
        };

        // When: Keyword not found in long content
        // Then: Error message should truncate the page content to avoid overwhelming output
        await assert.rejects(
            async () => await helper.runMonitorTest(monitor),
            /Page content: \[A{47}...\]/,
            "Should truncate long page content in error messages"
        );
    });
});
