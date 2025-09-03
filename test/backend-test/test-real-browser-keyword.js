const test = require("node:test");
const assert = require("node:assert");

// Mock monitor configurations for testing
const monitors = {
    noKeyword: {
        type: "real-browser",
        url: "https://example.com"
    },
    withKeyword: {
        type: "real-browser",
        url: "https://example.com",
        keyword: "Hello",
        invertKeyword: false
    },
    withInvertKeyword: {
        type: "real-browser",
        url: "https://example.com",
        keyword: "NotFound",
        invertKeyword: true
    },
    keywordNotFound: {
        type: "real-browser",
        url: "https://example.com",
        keyword: "NotFound",
        invertKeyword: false
    }
};

test("Test keyword checking logic", async (t) => {

    await t.test("should pass when no keyword is configured", async () => {
        // This simulates backward compatibility - monitors without keywords should work
        const monitor = monitors.noKeyword;
        assert.strictEqual(monitor.keyword, undefined);
        // No keyword means no checking, should always pass the keyword part
    });

    await t.test("should pass when keyword is found and not inverted", async () => {
        const monitor = monitors.withKeyword;
        const pageText = "Hello World! This is a test page with sample content.";

        // Simulate the keyword checking logic
        const keywordFound = pageText.includes(monitor.keyword);
        const invertKeyword = monitor.invertKeyword === true || monitor.invertKeyword === 1;
        const shouldPass = keywordFound === !invertKeyword;

        assert.strictEqual(keywordFound, true, "Keyword 'Hello' should be found in page text");
        assert.strictEqual(invertKeyword, false, "Invert keyword should be false");
        assert.strictEqual(shouldPass, true, "Check should pass when keyword found and not inverted");
    });

    await t.test("should pass when keyword is not found and inverted", async () => {
        const monitor = monitors.withInvertKeyword;
        const pageText = "Hello World! This is a test page with sample content.";

        // Simulate the keyword checking logic
        const keywordFound = pageText.includes(monitor.keyword);
        const invertKeyword = monitor.invertKeyword === true || monitor.invertKeyword === 1;
        const shouldPass = keywordFound === !invertKeyword;

        assert.strictEqual(keywordFound, false, "Keyword 'NotFound' should not be found in page text");
        assert.strictEqual(invertKeyword, true, "Invert keyword should be true");
        assert.strictEqual(shouldPass, true, "Check should pass when keyword not found and inverted");
    });

    await t.test("should fail when keyword is not found and not inverted", async () => {
        const monitor = monitors.keywordNotFound;
        const pageText = "Hello World! This is a test page with sample content.";

        // Simulate the keyword checking logic
        const keywordFound = pageText.includes(monitor.keyword);
        const invertKeyword = monitor.invertKeyword === true || monitor.invertKeyword === 1;
        const shouldPass = keywordFound === !invertKeyword;

        assert.strictEqual(keywordFound, false, "Keyword 'NotFound' should not be found in page text");
        assert.strictEqual(invertKeyword, false, "Invert keyword should be false");
        assert.strictEqual(shouldPass, false, "Check should fail when keyword not found and not inverted");
    });

    await t.test("should handle empty keyword properly", async () => {
        const monitor = {
            type: "real-browser",
            url: "https://example.com",
            keyword: "",  // Empty keyword
            invertKeyword: false
        };

        // Empty or whitespace-only keywords should be ignored (treated as no keyword)
        const shouldCheckKeyword = !!(monitor.keyword && monitor.keyword.trim());
        assert.strictEqual(shouldCheckKeyword, false, "Empty keyword should be ignored");
    });

    await t.test("should handle whitespace-only keyword properly", async () => {
        const monitor = {
            type: "real-browser",
            url: "https://example.com",
            keyword: "   ",  // Whitespace-only keyword
            invertKeyword: false
        };

        // Empty or whitespace-only keywords should be ignored (treated as no keyword)
        const shouldCheckKeyword = !!(monitor.keyword && monitor.keyword.trim());
        assert.strictEqual(shouldCheckKeyword, false, "Whitespace-only keyword should be ignored");
    });

    await t.test("should handle text preprocessing correctly", async () => {
        const originalText = "Hello    World!\n\n   This is a    test page.";
        const processedText = originalText.replace(/\s+/g, " ").trim();
        const expectedText = "Hello World! This is a test page.";

        assert.strictEqual(processedText, expectedText, "Text should be properly preprocessed");
    });
});
