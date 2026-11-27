const { describe, it } = require("node:test");
const assert = require("node:assert");
const NotificationProvider = require("../../server/notification-providers/notification-provider");

class TestProvider extends NotificationProvider {}

describe("Notification Provider renderTemplate", () => {
    const provider = new TestProvider();

    it("escapes multiline messages in msgJSON so custom JSON bodies stay valid", async () => {
        const msg = "[Test Monitor] [🔴 Down] PING 10.0.3.202 (10.0.3.202) 56(84) bytes of data.\n\n--- statistics ---\n10 packets transmitted, 0 received";
        const template = '{ "text": {{ msgJSON }} }';

        const result = await provider.renderTemplate(template, msg, null, null);

        const parsed = JSON.parse(result);
        assert.strictEqual(parsed.text, msg);
    });

    it("keeps the raw msg variable available for non-JSON templates", async () => {
        const msg = "line one\nline two";

        const result = await provider.renderTemplate("{{ msg }}", msg, null, null);

        assert.strictEqual(result, msg);
    });

    it("escapes quotes and newlines in msgJSON", async () => {
        const msg = 'He said "up"\nthen "down"';

        const result = await provider.renderTemplate('{ "text": {{ msgJSON }} }', msg, null, null);

        const parsed = JSON.parse(result);
        assert.strictEqual(parsed.text, msg);
    });
});
