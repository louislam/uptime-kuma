const { test } = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");
const Mattermost = require("../../../server/notification-providers/mattermost");
const { UP, DOWN } = require("../../../src/util");

test("Mattermost test notifications include the configured channel and icons", async (t) => {
    // This will intercept the webhook request so there is no message that is sent
    const post = t.mock.method(axios, "post", async () => ({ status: 200 }));

    const provider = new Mattermost();

    const notification = {
        mattermostWebhookUrl: "https://example.invalid/webhook",
        mattermostusername: "Uptime Kuma",
        mattermostchannel: "ALERTS",
        mattermosticonemo: ":white_check_mark: :red_circle:",
        mattermosticonurl: "https://example.invalid/icon.png",
    };

    const result = await provider.send(notification, "Test notification");

    assert.equal(result, "Sent Successfully.");
    assert.equal(post.mock.callCount(), 1);

    const [url, payload] = post.mock.calls[0].arguments;

    assert.equal(url, notification.mattermostWebhookUrl);
    assert.equal(payload.text, "Test notification");
    assert.equal(payload.channel, "alerts");
    assert.equal(payload.icon_emoji, ":white_check_mark:");
    assert.equal(payload.icon_url, notification.mattermosticonurl);
});

test("Mattermost certificate warnings include configured settings", async (t) => {
    const post = t.mock.method(axios, "post", async () => ({ status: 200 }));

    const provider = new Mattermost();

    const notification = {
        mattermostWebhookUrl: "https://example.invalid/webhook",
        mattermostusername: "Uptime Kuma",
        mattermostchannel: "CERT-ALERTS",
        mattermosticonemo: ":shield: :warning:",
        mattermosticonurl: "https://example.invalid/icon.png",
    };

    const result = await provider.send(notification, "Certificate expires in 3 days", { name: "Example Site" }, null);

    assert.equal(result, "Sent Successfully.");
    assert.equal(post.mock.callCount(), 1);

    const [url, payload] = post.mock.calls[0].arguments;

    assert.equal(url, notification.mattermostWebhookUrl);
    assert.equal(payload.text, "Certificate expires in 3 days");
    assert.equal(payload.channel, "cert-alerts");
    assert.equal(payload.icon_emoji, ":shield:");
    assert.equal(payload.icon_url, notification.mattermosticonurl);
});

const scenarios = [
    {
        name: "UP",
        status: UP,
        expectedEmoji: ":white_check_mark:",
        expectedColor: "#32CD32",
        expectedText: "up!",
        expectedField: "Ping",
    },
    {
        name: "DOWN",
        status: DOWN,
        expectedEmoji: ":red_circle:",
        expectedColor: "#FF0000",
        expectedText: "down.",
        expectedField: "Error",
    },
];

for (const scenario of scenarios) {
    test(`Mattermost ${scenario.name} notifications preserve configured settings`, async (t) => {
        const post = t.mock.method(axios, "post", async () => ({ status: 200 }));

        const provider = new Mattermost();

        const notification = {
            mattermostWebhookUrl: "https://example.invalid/webhook",
            mattermostusername: "Uptime Kuma",
            mattermostchannel: "ALERTS",
            mattermosticonemo: ":white_check_mark: :red_circle:",
            mattermosticonurl: "https://example.invalid/icon.png",
        };

        const monitorJSON = {
            name: "Example Site",
            pathName: "Example Site",
            url: "https://example.invalid",
        };

        const heartbeatJSON = {
            status: scenario.status,
            msg: "Connection refused",
            ping: 42,
            timezone: "America/Chicago",
            localDateTime: "2026-10-21 15:00:00",
        };

        const result = await provider.send(notification, "Monitor status changed", monitorJSON, heartbeatJSON);

        assert.equal(result, "Sent Successfully.");
        assert.equal(post.mock.callCount(), 1);

        const [url, payload] = post.mock.calls[0].arguments;

        assert.equal(url, notification.mattermostWebhookUrl);
        assert.equal(payload.channel, "alerts");
        assert.equal(payload.icon_emoji, scenario.expectedEmoji);
        assert.equal(payload.icon_url, notification.mattermosticonurl);
        assert.equal(payload.username, "Example Site Uptime Kuma");

        const attachment = payload.attachments[0];

        assert.equal(attachment.color, scenario.expectedColor);
        assert.equal(attachment.title, `Example Site service went ${scenario.expectedText}`);
        assert.equal(attachment.fields[0].title, scenario.expectedField);
    });
}
