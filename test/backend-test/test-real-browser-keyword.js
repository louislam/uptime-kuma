const test = require("node:test");
const assert = require("node:assert");
const { RealBrowserTestHelper, UP, DOWN, PENDING } = require("./real-browser-test-helper");

// Initialize the test helper
const helper = new RealBrowserTestHelper();

// Test content variations with predictable keywords
const testPages = {
    withHello: helper.createTestServer("Hello World! This is a test page with sample content."),
    withoutHello: helper.createTestServer("This is a test page with sample content but no greeting."),
    withSpaces: helper.createTestServer("Hello    World!\n\n   This is a    test page."),
    withSpecialChars: helper.createTestServer("Hello World! Special chars: àáâãäå øñü"),
    withNumeric: helper.createTestServer("Status: 200 OK - Server is running with code 123"),
    longContent: helper.createTestServer("A".repeat(100) + " This is some long content for truncation testing")
};

// Predictable keywords for our test content
const availableKeywords = {
    found: "Hello", // Present in withHello pages
    notFound: "Missing", // Not present in any pages
    partial: "World", // Present in withHello pages
    numeric: "123", // Present in withNumeric page
    special: "àáâãäå" // Present in withSpecialChars page
};

test("Real Browser Monitor Integration Tests", {
    skip: process.env.CI && !process.env.UPTIME_KUMA_ENABLE_BROWSER_TESTS
}, async (t) => {
    // Initialize helper before running tests
    await helper.initialize();

    // Setup test cleanup
    helper.setupTestCleanup(t);

    await t.test("should pass when no keyword is configured", async () => {
        const monitor = helper.createMonitor(1, testPages.withHello);
        const heartbeat = await helper.runMonitorTest(monitor);

        assert.strictEqual(heartbeat.status, UP, "Monitor should be UP");
        assert.strictEqual(heartbeat.msg, "200", "Should show HTTP status");
        assert.strictEqual(typeof heartbeat.ping, "number", "Should have ping time");
    });

    await t.test("should pass when keyword found and not inverted", async () => {
        const monitor = helper.createMonitor(2, testPages.withHello, availableKeywords.found, false);
        const heartbeat = await helper.runMonitorTest(monitor);

        assert.strictEqual(heartbeat.status, UP, "Monitor should be UP when keyword found");
        assert.strictEqual(heartbeat.msg, `200, keyword "${availableKeywords.found}" found`, "Should indicate keyword found");
        assert.strictEqual(typeof heartbeat.ping, "number", "Should have ping time");
    });

    await t.test("should pass when keyword not found but inverted", async () => {
        const monitor = helper.createMonitor(3, testPages.withoutHello, availableKeywords.notFound, true);
        const heartbeat = await helper.runMonitorTest(monitor);

        assert.strictEqual(heartbeat.status, UP, "Monitor should be UP when keyword not found and inverted");
        assert.strictEqual(heartbeat.msg, `200, keyword "${availableKeywords.notFound}" not found`, "Should indicate keyword not found");
        assert.strictEqual(typeof heartbeat.ping, "number", "Should have ping time");
    });

    await t.test("should fail when keyword not found and not inverted", async () => {
        const monitor = helper.createMonitor(4, testPages.withoutHello, availableKeywords.notFound, false);

        await assert.rejects(
            async () => await helper.runMonitorTest(monitor),
            new RegExp(`Keyword check failed.*Keyword "${availableKeywords.notFound}" not found on page.*Expected: found`),
            "Should throw when keyword not found and not inverted"
        );
    });

    await t.test("should fail when keyword found but inverted", async () => {
        const monitor = helper.createMonitor(5, testPages.withHello, availableKeywords.found, true);

        await assert.rejects(
            async () => await helper.runMonitorTest(monitor),
            new RegExp(`Keyword check failed.*Keyword "${availableKeywords.found}" found on page.*Expected: not found`),
            "Should throw when keyword found but should be inverted"
        );
    });

    await t.test("should handle text preprocessing correctly", async () => {
        const monitor = helper.createMonitor(6, testPages.withSpaces, availableKeywords.found, false);
        const heartbeat = await helper.runMonitorTest(monitor);

        assert.strictEqual(heartbeat.status, UP, "Should handle normalized whitespace");
        assert.strictEqual(heartbeat.msg, `200, keyword "${availableKeywords.found}" found`, "Should find keyword in normalized text");
    });

    await t.test("should handle empty keyword as no keyword", async () => {
        const monitor = helper.createMonitor(7, testPages.withHello, "", false);
        const heartbeat = await helper.runMonitorTest(monitor);

        assert.strictEqual(heartbeat.status, UP, "Empty keyword should be ignored");
        assert.strictEqual(heartbeat.msg, "200", "Should not include keyword info for empty keyword");
    });

    await t.test("should handle whitespace-only keyword as no keyword", async () => {
        const monitor = helper.createMonitor(8, testPages.withHello, "   ", false);
        const heartbeat = await helper.runMonitorTest(monitor);

        assert.strictEqual(heartbeat.status, UP, "Whitespace-only keyword should be ignored");
        assert.strictEqual(heartbeat.msg, "200", "Should not include keyword info for whitespace keyword");
    });

    await t.test("should handle special characters correctly", async () => {
        const monitor = helper.createMonitor(9, testPages.withSpecialChars, availableKeywords.special, false);
        const heartbeat = await helper.runMonitorTest(monitor);

        assert.strictEqual(heartbeat.status, UP, "Should find special character keywords");
        assert.strictEqual(heartbeat.msg, `200, keyword "${availableKeywords.special}" found`, "Should handle special chars correctly");
    });

    await t.test("should handle case sensitivity correctly", async () => {
        const monitor = helper.createMonitor(10, testPages.withHello, availableKeywords.found.toLowerCase(), false);

        await assert.rejects(
            async () => await helper.runMonitorTest(monitor),
            new RegExp(`Keyword check failed.*Keyword "${availableKeywords.found.toLowerCase()}" not found on page.*Expected: found`),
            "Should be case sensitive by default"
        );
    });

    await t.test("should handle partial keyword matches", async () => {
        const monitor = helper.createMonitor(11, testPages.withHello, availableKeywords.partial, false);
        const heartbeat = await helper.runMonitorTest(monitor);

        assert.strictEqual(heartbeat.status, UP, "Should find partial keyword matches");
        assert.strictEqual(heartbeat.msg, `200, keyword "${availableKeywords.partial}" found`, "Should match partial strings");
    });

    await t.test("should handle numeric keywords", async () => {
        const monitor = helper.createMonitor(12, testPages.withNumeric, availableKeywords.numeric, false);
        const heartbeat = await helper.runMonitorTest(monitor);

        assert.strictEqual(heartbeat.status, UP, "Should find numeric keywords");
        assert.strictEqual(heartbeat.msg, `200, keyword "${availableKeywords.numeric}" found`, "Should match numeric strings");
    });

    await t.test("should truncate long error messages correctly", async () => {
        const monitor = helper.createMonitor(13, testPages.longContent, "NotFoundKeyword", false);

        await assert.rejects(
            async () => await helper.runMonitorTest(monitor),
            /Page content: \[A{47}...\]/,
            "Should truncate long page content in error messages"
        );
    });
});
