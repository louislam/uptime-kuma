const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const { SMTPServer } = require("smtp-server");

const SMTP = require("../../../server/notification-providers/smtp");

describe("SMTP notification provider", () => {
    let server;
    let received;
    let port;

    before(async () => {
        received = [];
        server = new SMTPServer({
            authOptional: true,
            disabledCommands: ["AUTH", "STARTTLS"],
            logger: false,
            onData(stream, session, callback) {
                let raw = "";
                stream.setEncoding("utf8");
                stream.on("data", (chunk) => (raw += chunk));
                stream.on("end", () => {
                    received.push(raw);
                    callback();
                });
            },
        });
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        port = server.server.address().port;
    });

    after(async () => {
        await new Promise((resolve) => server.close(resolve));
    });

    /**
     * Build a notification pointing at the test server
     * @param {object} extra Overrides
     * @returns {object} Notification
     */
    function notification(extra) {
        return {
            smtpHost: "127.0.0.1",
            smtpPort: port,
            smtpSecure: false,
            smtpIgnoreSTARTTLS: true,
            smtpFrom: "uptime-kuma@example.com",
            smtpTo: "user@example.com",
            smtpUsername: "",
            smtpPassword: "",
            ...extra,
        };
    }

    test("send() delivers the message through the SMTP transport", async () => {
        const provider = new SMTP();

        const result = await provider.send(notification(), "Test Message");

        assert.strictEqual(result, "Sent Successfully.");
        assert.strictEqual(received.length, 1);
        assert.match(received[0], /^Subject: Test Message$/m);
        assert.match(received[0], /^To: user@example\.com$/m);
        assert.match(received[0], /^From: uptime-kuma@example\.com$/m);
    });

    test("send() rejects invalid additional headers", async () => {
        const provider = new SMTP();

        await assert.rejects(provider.send(notification({ smtpAdditionalHeaders: "{not json" }), "Test Message"), {
            message: "Additional Headers is not a valid JSON",
        });
    });
});
