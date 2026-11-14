const { describe, test, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert");
const axios = require("axios");

const Trigv = require("../../../server/notification-providers/trigv");
const { DOWN, UP } = require("../../../src/util");

describe("Trigv notification provider", () => {
    const notification = {
        trigvApiKey: "trgv_Ab123456_" + "a".repeat(32),
        trigvChannel: "monitoring",
    };
    const monitor = { name: "Website", url: "https://example.com/status" };
    const heartbeat = {
        status: DOWN,
        msg: "Connection timed out",
        timezone: "UTC",
        localDateTime: "2026-11-14 12:00:00",
    };
    let post;

    beforeEach(() => {
        post = mock.method(axios, "post", async () => ({ status: 202 }));
    });

    afterEach(() => mock.restoreAll());

    test("sends one DOWN alert with the endpoint, headers, body and proxy config", async () => {
        const provider = new Trigv();
        const proxyConfig = mock.method(provider, "getAxiosConfigWithProxy", (config) => ({ ...config, proxy: false }));
        const result = await provider.send(notification, "Alert", monitor, heartbeat);

        assert.strictEqual(provider.name, "trigv");
        assert.strictEqual(result, "Sent Successfully.");
        assert.strictEqual(post.mock.callCount(), 1);
        const [url, body, config] = post.mock.calls[0].arguments;
        assert.strictEqual(url, "https://api.trigv.com/v1/events");
        assert.deepStrictEqual(config.headers, {
            Authorization: "Bearer " + notification.trigvApiKey,
            "Content-Type": "application/json",
            Accept: "application/json",
        });
        assert.strictEqual(proxyConfig.mock.callCount(), 1);
        assert.strictEqual(config.proxy, false);
        assert.strictEqual(config.validateStatus(202), true);
        for (const status of [200, 401, 404, 422, 429]) {
            assert.strictEqual(config.validateStatus(status), false);
        }
        assert.deepStrictEqual(body, {
            channel: "monitoring",
            title: "Website is down",
            description: "Connection timed out\nTime (UTC): 2026-11-14 12:00:00",
            level: "error",
            url: monitor.url,
        });
    });

    test("sends an UP alert", async () => {
        await new Trigv().send(notification, "Alert", monitor, { ...heartbeat, status: UP, msg: "OK" });
        assert.deepStrictEqual(post.mock.calls[0].arguments[1], {
            channel: "monitoring",
            title: "Website is up",
            description: "OK\nTime (UTC): 2026-11-14 12:00:00",
            level: "success",
            url: monitor.url,
        });
    });

    test("sends test notifications when both JSON objects are null", async () => {
        await new Trigv().send(notification, "Test notification", null, null);
        assert.deepStrictEqual(post.mock.calls[0].arguments[1], {
            channel: "monitoring",
            title: "Uptime Kuma",
            description: "Test notification",
            level: "info",
        });
    });

    for (const message of ["Certificate expires soon", "Domain expires soon"]) {
        test(`sends an info alert for ${message}`, async () => {
            await new Trigv().send(notification, message, monitor, null);
            assert.deepStrictEqual(post.mock.calls[0].arguments[1], {
                channel: "monitoring",
                title: "Website",
                description: message,
                level: "info",
                url: monitor.url,
            });
        });
    }

    test("defaults missing and empty channels to general", async () => {
        for (const trigvChannel of [undefined, ""]) {
            await new Trigv().send({ ...notification, trigvChannel }, "Test");
        }
        for (const call of post.mock.calls) {
            assert.strictEqual(call.arguments[1].channel, "general");
        }
    });

    test("truncates titles and descriptions for heartbeats and info alerts", async () => {
        const name = "n".repeat(256);
        const message = "m".repeat(1001);
        for (const event of [null, { ...heartbeat, msg: message }]) {
            await new Trigv().send(notification, message, { name }, event);
        }
        for (const call of post.mock.calls) {
            assert.strictEqual(call.arguments[1].title, "n".repeat(255));
            assert.strictEqual(call.arguments[1].description, "m".repeat(1000));
        }
    });

    test("includes only usable HTTP and HTTPS URLs within the API limit", async () => {
        const urls = [
            "http://example.com/",
            "https://example.com/",
            undefined,
            "",
            "https://",
            "example.com",
            "127.0.0.1:3000",
            "ftp://example.com/",
            "docker://container",
            "https://example.com/" + "a".repeat(2048),
        ];
        for (const url of urls) {
            await new Trigv().send(notification, "Test", { name: "Monitor", url });
        }
        for (const [index, call] of post.mock.calls.entries()) {
            const body = call.arguments[1];
            if (index < 2) {
                assert.strictEqual(body.url, urls[index]);
            } else {
                assert.strictEqual(Object.hasOwn(body, "url"), false);
            }
        }
    });

    test("surfaces API errors with their status and message", async () => {
        post.mock.mockImplementation(async () => {
            throw new axios.AxiosError("Request failed with status code 401", "ERR_BAD_REQUEST", undefined, undefined, {
                status: 401,
                data: { message: "Invalid API key" },
            });
        });
        await assert.rejects(new Trigv().send(notification, "Test"), /HTTP 401.*Invalid API key/);
    });
});
