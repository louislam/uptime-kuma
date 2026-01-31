const { describe, test } = require("node:test");
const assert = require("node:assert");
const { evaluateXmlQuery } = require("../../src/util");

describe("evaluateXmlQuery", () => {
    const sampleHtml = `<!DOCTYPE html>
<html>
<head>
    <title>Hello World</title>
    <meta name="description" content="Test page">
</head>
<body>
    <h1>Welcome</h1>
    <div class="container">
        <p id="intro">This is a test page</p>
        <ul>
            <li data-id="1">First item</li>
            <li data-id="2">Second item</li>
        </ul>
        <a href="https://example.com">Example link</a>
        <span class="empty"></span>
    </div>
</body>
</html>`;

    describe("== operator", () => {
        test("returns true when xpath finds matching value", async () => {
            const result = await evaluateXmlQuery(sampleHtml, "//h1", "==", "Welcome");
            assert.strictEqual(result.status, true);
            assert.strictEqual(result.response, "Welcome");
        });

        test("returns false when xpath value does not match", async () => {
            const result = await evaluateXmlQuery(sampleHtml, "//h1", "==", "Wrong Value");
            assert.strictEqual(result.status, false);
        });

        test("works with title element", async () => {
            const result = await evaluateXmlQuery(sampleHtml, "//title", "==", "Hello World");
            assert.strictEqual(result.status, true);
        });
    });

    describe("!= operator", () => {
        test("returns true when xpath value is different", async () => {
            const result = await evaluateXmlQuery(sampleHtml, "//h1", "!=", "Different");
            assert.strictEqual(result.status, true);
        });

        test("returns false when xpath value matches", async () => {
            const result = await evaluateXmlQuery(sampleHtml, "//h1", "!=", "Welcome");
            assert.strictEqual(result.status, false);
        });
    });

    describe("isset operator", () => {
        test("returns true when node exists", async () => {
            const result = await evaluateXmlQuery(sampleHtml, "//h1", "isset", null);
            assert.strictEqual(result.status, true);
        });

        test("returns false when node does not exist", async () => {
            const result = await evaluateXmlQuery(sampleHtml, "//h2", "isset", null);
            assert.strictEqual(result.status, false);
        });

        test("returns true for empty node", async () => {
            const result = await evaluateXmlQuery(sampleHtml, "//span[@class='empty']", "isset", null);
            assert.strictEqual(result.status, true);
        });
    });

    describe("not_isset operator", () => {
        test("returns true when node does not exist", async () => {
            const result = await evaluateXmlQuery(sampleHtml, "//h2", "not_isset", null);
            assert.strictEqual(result.status, true);
        });

        test("returns false when node exists", async () => {
            const result = await evaluateXmlQuery(sampleHtml, "//h1", "not_isset", null);
            assert.strictEqual(result.status, false);
        });
    });

    describe("contains operator", () => {
        test("returns true when value contains substring", async () => {
            const result = await evaluateXmlQuery(sampleHtml, "//p[@id='intro']", "contains", "test page");
            assert.strictEqual(result.status, true);
        });

        test("returns false when value does not contain substring", async () => {
            const result = await evaluateXmlQuery(sampleHtml, "//h1", "contains", "Goodbye");
            assert.strictEqual(result.status, false);
        });
    });

    describe("not_contains operator", () => {
        test("returns true when value does not contain substring", async () => {
            const result = await evaluateXmlQuery(sampleHtml, "//h1", "not_contains", "Goodbye");
            assert.strictEqual(result.status, true);
        });

        test("returns false when value contains substring", async () => {
            const result = await evaluateXmlQuery(sampleHtml, "//h1", "not_contains", "Welcome");
            assert.strictEqual(result.status, false);
        });
    });

    describe("multiple nodes handling", () => {
        test("takes first element when multiple nodes match", async () => {
            const result = await evaluateXmlQuery(sampleHtml, "//li", "==", "First item");
            assert.strictEqual(result.status, true);
            assert.strictEqual(result.response, "First item");
        });

        test("handles attributes in xpath", async () => {
            const result = await evaluateXmlQuery(sampleHtml, "//li[@data-id='2']", "==", "Second item");
            assert.strictEqual(result.status, true);
        });

        test("handles class selector in xpath", async () => {
            const result = await evaluateXmlQuery(sampleHtml, "//div[@class='container']//p", "contains", "test");
            assert.strictEqual(result.status, true);
        });
    });

    describe("attribute value extraction", () => {
        test("extracts href attribute value", async () => {
            const result = await evaluateXmlQuery(sampleHtml, "//a/@href", "==", "https://example.com");
            assert.strictEqual(result.status, true);
        });

        test("extracts data attribute value", async () => {
            const result = await evaluateXmlQuery(sampleHtml, "//li[1]/@data-id", "==", "1");
            assert.strictEqual(result.status, true);
        });
    });

    describe("error handling", () => {
        test("throws error when xpath matches no nodes for value operators", async () => {
            await assert.rejects(
                evaluateXmlQuery(sampleHtml, "//nonexistent", "==", "test"),
                /XPath expression did not match any nodes/
            );
        });

        test("throws error for invalid operator", async () => {
            await assert.rejects(
                evaluateXmlQuery(sampleHtml, "//h1", "invalid_op", "test"),
                /Invalid XPath operator/
            );
        });
    });
});
