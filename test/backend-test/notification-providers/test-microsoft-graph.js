const { describe, test, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert");
const axios = require("axios");

const MicrosoftGraph = require("../../../server/notification-providers/microsoft-graph");

describe("Microsoft Graph notification provider", () => {
    let calls;

    beforeEach(() => {
        calls = [];
        mock.method(axios, "post", async (url, data, config) => {
            calls.push({ url, data, config });
            if (url.startsWith("https://login.microsoftonline.com/")) {
                return { status: 200, data: { access_token: "test-token" } };
            }
            return { status: 202, data: "" };
        });
    });

    afterEach(() => mock.restoreAll());

    const notification = (extra) => ({
        msGraphTenantId: "tenant",
        msGraphClientId: "client",
        msGraphClientSecret: "secret",
        msGraphMailbox: "alerts@example.com",
        ...extra,
    });

    test("requests a client_credentials token and sends mail", async () => {
        const result = await new MicrosoftGraph().send(
            notification({ msGraphTo: "a@example.com; b@example.com", msGraphBCC: "c@example.com" }),
            "Hello"
        );

        assert.strictEqual(result, "Sent Successfully.");
        assert.strictEqual(calls.length, 2);

        assert.strictEqual(calls[0].url, "https://login.microsoftonline.com/tenant/oauth2/v2.0/token");
        const form = new URLSearchParams(calls[0].data);
        assert.strictEqual(form.get("grant_type"), "client_credentials");
        assert.strictEqual(form.get("client_id"), "client");
        assert.strictEqual(form.get("client_secret"), "secret");
        assert.strictEqual(form.get("scope"), "https://graph.microsoft.com/.default");

        assert.strictEqual(calls[1].url, "https://graph.microsoft.com/v1.0/users/alerts%40example.com/sendMail");
        assert.strictEqual(calls[1].config.headers.Authorization, "Bearer test-token");
        assert.deepStrictEqual(calls[1].data, {
            message: {
                subject: "Hello",
                body: { contentType: "Text", content: "Hello" },
                toRecipients: [
                    { emailAddress: { address: "a@example.com" } },
                    { emailAddress: { address: "b@example.com" } },
                ],
                ccRecipients: [],
                bccRecipients: [{ emailAddress: { address: "c@example.com" } }],
            },
            saveToSentItems: false,
        });
    });

    test("renders custom subject and HTML body", async () => {
        await new MicrosoftGraph().send(
            notification({
                msGraphTo: "a@example.com",
                customSubject: "Subject {{ msg }}",
                customBody: "<b>{{ msg }}</b>",
                htmlBody: true,
            }),
            "Uptime Kuma Testing"
        );

        const message = calls[1].data.message;
        assert.strictEqual(message.subject, "Subject Uptime Kuma Testing");
        assert.deepStrictEqual(message.body, { contentType: "HTML", content: "<b>Uptime Kuma Testing</b>" });
    });

    test("requires at least one recipient", async () => {
        await assert.rejects(new MicrosoftGraph().send(notification({}), "msg"), /At least one recipient/);
        assert.strictEqual(calls.length, 0);
    });

    test("reports Graph API errors", async () => {
        mock.restoreAll();
        mock.method(axios, "post", async (url) => {
            if (url.startsWith("https://login.microsoftonline.com/")) {
                return { status: 200, data: { access_token: "test-token" } };
            }
            const error = new Error("Request failed with status code 403");
            error.response = { status: 403, data: { error: { code: "ErrorAccessDenied" } } };
            throw error;
        });

        await assert.rejects(
            new MicrosoftGraph().send(notification({ msGraphTo: "a@example.com" }), "msg"),
            /ErrorAccessDenied/
        );
    });
});
