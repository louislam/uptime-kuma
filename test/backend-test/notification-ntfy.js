const { test } = require("node:test");
const assert = require("assert");
const Ntfy = require("../../server/notification-providers/ntfy");

test("isValidURL", () => {
    const ntfy = new Ntfy();

    // Valid URLs
    assert.strictEqual(ntfy.isValidURL("https://example.com"), true);
    assert.strictEqual(ntfy.isValidURL("http://example.com"), true);
    assert.strictEqual(ntfy.isValidURL("https://example.com/path"), true);
    assert.strictEqual(ntfy.isValidURL("https://1.1.1.1"), true);

    // Invalid URLs
    assert.strictEqual(ntfy.isValidURL(null), false);
    assert.strictEqual(ntfy.isValidURL(undefined), false);
    assert.strictEqual(ntfy.isValidURL(""), false);
    assert.strictEqual(ntfy.isValidURL("https://"), false);
    assert.strictEqual(ntfy.isValidURL("invalid-url"), false);

    // Local / private IP URLs
    assert.strictEqual(ntfy.isValidURL("http://localhost"), false);
    assert.strictEqual(ntfy.isValidURL("http://localhost:3000"), false);
    assert.strictEqual(ntfy.isValidURL("http://127.0.0.1"), false);
    assert.strictEqual(ntfy.isValidURL("http://127.0.0.1:8080"), false);
    assert.strictEqual(ntfy.isValidURL("http://server.local"), false);

    // Private IPs
    assert.strictEqual(ntfy.isValidURL("http://10.0.0.1"), false);
    assert.strictEqual(ntfy.isValidURL("http://172.16.0.1"), false);
    assert.strictEqual(ntfy.isValidURL("http://192.168.1.100"), false);
});
