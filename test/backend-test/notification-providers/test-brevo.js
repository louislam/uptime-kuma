const { describe, test, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert");
const axios = require("axios");

const Brevo = require("../../../server/notification-providers/brevo");

describe("Brevo notification provider", () => {
    let calls;

    beforeEach(() => {
        calls = [];
        mock.method(axios, "post", async (url, data, config) => {
            calls.push({ url, data, config });
            return { status: 201, data: { messageId: "id" } };
        });
    });

    afterEach(() => mock.restoreAll());

    const notification = (extra) => ({
        brevoApiKey: "api-key",
        brevoFromEmail: " alerts@example.com ",
        brevoToEmail: "to@example.com",
        ...extra,
    });

    test("uses the message as default subject and text body, like SMTP", async () => {
        const result = await new Brevo().send(
            notification({ brevoCcEmail: "a@example.com, b@example.com", brevoBccEmail: "c@example.com" }),
            "Hello"
        );

        assert.strictEqual(result, "Sent Successfully.");
        assert.strictEqual(calls.length, 1);
        assert.strictEqual(calls[0].url, "https://api.brevo.com/v3/smtp/email");
        assert.strictEqual(calls[0].config.headers["api-key"], "api-key");
        assert.deepStrictEqual(calls[0].data, {
            sender: { email: "alerts@example.com", name: "Uptime Kuma" },
            to: [{ email: "to@example.com" }],
            subject: "Hello",
            textContent: "Hello",
            cc: [{ email: "a@example.com" }, { email: "b@example.com" }],
            bcc: [{ email: "c@example.com" }],
        });
    });

    test("appends the heartbeat time to the default body", async () => {
        await new Brevo().send(
            notification(),
            "Down",
            { name: "Monitor" },
            { timezone: "Europe/Paris", localDateTime: "2026-11-25 10:00:00" }
        );

        assert.strictEqual(calls[0].data.subject, "Down");
        assert.strictEqual(calls[0].data.textContent, "Down\nTime (Europe/Paris): 2026-11-25 10:00:00");
    });

    test("renders custom subject and HTML body", async () => {
        await new Brevo().send(
            notification({
                customSubject: "Subject {{ msg }}",
                customBody: "<b>{{ msg }}</b>",
                htmlBody: true,
            }),
            "Uptime Kuma Testing"
        );

        const data = calls[0].data;
        assert.strictEqual(data.subject, "Subject Uptime Kuma Testing");
        assert.strictEqual(data.htmlContent, "<b>Uptime Kuma Testing</b>");
        assert.strictEqual(data.textContent, undefined);
    });

    test("renders custom body as text when HTML is not enabled", async () => {
        await new Brevo().send(notification({ customBody: "Body {{ msg }}" }), "Uptime Kuma Testing");

        assert.strictEqual(calls[0].data.textContent, "Body Uptime Kuma Testing");
        assert.strictEqual(calls[0].data.htmlContent, undefined);
    });

    test("keeps a customised legacy brevoSubject but ignores the legacy default", async () => {
        await new Brevo().send(notification({ brevoSubject: "My legacy subject" }), "Hello");
        await new Brevo().send(notification({ brevoSubject: "Notification from Your Uptime Kuma" }), "Hello");

        assert.strictEqual(calls[0].data.subject, "My legacy subject");
        assert.strictEqual(calls[1].data.subject, "Hello");
    });

    test("customSubject takes precedence over legacy brevoSubject", async () => {
        await new Brevo().send(
            notification({ brevoSubject: "My legacy subject", customSubject: "New {{ msg }}" }),
            "Uptime Kuma Testing"
        );

        assert.strictEqual(calls[0].data.subject, "New Uptime Kuma Testing");
    });
});
