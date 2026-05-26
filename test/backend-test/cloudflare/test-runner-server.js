/* eslint-disable jsdoc/require-jsdoc */
const { describe, test } = require("node:test");
const assert = require("node:assert");

const {
    createServer,
    getTwingateNotReadyResult,
    isTwingateJob,
    sanitizeTwingateStatus,
} = require("../../../cloudflare/runner/server");

describe("Cloudflare monitor runner server", () => {
    test("detects Twingate routed jobs", () => {
        assert.strictEqual(isTwingateJob({ networkProfile: { slug: "twingate" } }), true);
        assert.strictEqual(isTwingateJob({ networkProfile: { type: "twingate" } }), true);
        assert.strictEqual(isTwingateJob({ networkProfile: { slug: "direct" } }), false);
        assert.strictEqual(isTwingateJob({ networkProfile: null }), false);
    });

    test("returns pending notice when Twingate proxy is still starting", () => {
        const result = getTwingateNotReadyResult({
            configured: true,
            starting: true,
            running: false,
            lastError: null,
        });

        assert.deepStrictEqual(result, {
            status: 2,
            ping: 0,
            msg: "Twingate service isn't running",
            response: null,
        });
    });

    test("returns last Twingate startup error when present", () => {
        const result = getTwingateNotReadyResult({
            configured: true,
            starting: false,
            running: false,
            lastError: "failed to load key",
        });

        assert.strictEqual(result.status, 2);
        assert.strictEqual(result.msg, "Twingate service isn't running: failed to load key");
    });

    test("returns generic pending notice when Twingate is stopped without an error", () => {
        const result = getTwingateNotReadyResult({
            configured: true,
            starting: false,
            running: false,
            lastError: null,
        });

        assert.strictEqual(result.status, 2);
        assert.strictEqual(result.msg, "Twingate service isn't running");
    });

    test("serves health and Twingate status before Twingate lifecycle starts", async () => {
        const twingateStatus = {
            configured: true,
            starting: false,
            running: false,
            proxyUrl: "http://127.0.0.1:9999",
            tunMode: "on",
            lastError: "not started yet",
            serviceKeyInspection: {
                privateKeyShape: {
                    sha256Prefix: "123456789abc",
                },
            },
        };
        const server = createServer({
            twingateStatus,
        });
        await listen(server);

        try {
            const baseUrl = `http://127.0.0.1:${server.address().port}`;
            const healthResponse = await fetch(`${baseUrl}/health`);
            const statusResponse = await fetch(`${baseUrl}/twingate/status`);

            assert.strictEqual(healthResponse.status, 200);
            assert.deepStrictEqual(await healthResponse.json(), { ok: true, version: "1.0.0" });
            assert.strictEqual(statusResponse.status, 200);
            assert.deepStrictEqual(await statusResponse.json(), sanitizeTwingateStatus(twingateStatus));
        } finally {
            await close(server);
        }
    });

    test("sanitizes Twingate service-key inspection from direct runner status", () => {
        assert.deepStrictEqual(
            sanitizeTwingateStatus({
                configured: true,
                starting: true,
                running: false,
                proxyUrl: "http://127.0.0.1:9999",
                tunMode: "on",
                lastError: null,
                serviceKeyInspection: {
                    validJson: true,
                    privateKeyShape: {
                        sha256Prefix: "123456789abc",
                    },
                },
            }),
            {
                configured: true,
                starting: true,
                running: false,
                proxyUrl: "http://127.0.0.1:9999",
                tunMode: "on",
                lastError: null,
            }
        );
    });
});

function listen(server) {
    return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            server.off("error", reject);
            resolve();
        });
    });
}

function close(server) {
    return new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}
