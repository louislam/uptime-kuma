const { describe, test, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert");
const axios = require("axios");

const Pumble = require("../../../server/notification-providers/pumble");

describe("Pumble notification provider", () => {
    const notification = { webhookURL: "https://example.com/pumble-webhook" };
    const monitor = { name: "Website", type: "http", url: "https://example.com" };
    let post;

    beforeEach(() => {
        post = mock.method(axios, "post", async () => ({ status: 200 }));
    });

    afterEach(() => mock.restoreAll());

    for (const message of [
        "[Website][https://example.com] server certificate example.com will expire in 7 days",
        "Domain name example.com will expire in 7 days",
    ]) {
        test(`sends a general alert for ${message}`, async () => {
            await new Pumble().send(notification, message, monitor, null);
            assert.deepStrictEqual(post.mock.calls[0].arguments[1], {
                attachments: [{ title: "Uptime Kuma Alert", text: message, color: "#5BDD8B" }],
            });
        });
    }
});
