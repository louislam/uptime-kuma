/* eslint-disable jsdoc/require-jsdoc */
const { describe, test } = require("node:test");
const assert = require("node:assert");

const {
    createServer,
    getTwingateNotReadyResult,
    isTwingateJob,
} = require("../../../cloudflare/runner/server");

describe("Cloudflare monitor runner server", () => {
    test("detects Twingate routed jobs", () => {
        assert.strictEqual(isTwingateJob({ networkProfile: { slug: "twingate" } }), true);
        assert.strictEqual(isTwingateJob({ networkProfile: { type: "twingate" } }), true);
        assert.strictEqual(isTwingateJob({ networkProfile: { slug: "direct" } }), false);
        assert.strictEqual(isTwingateJob({ networkProfile: null }), false);
    });

    test("returns starting message when Twingate proxy is still starting", () => {
        const result = getTwingateNotReadyResult({
            configured: true,
            starting: true,
            running: false,
            lastError: null,
        });

        assert.deepStrictEqual(result, {
            status: 0,
            ping: 0,
            msg: "Twingate proxy is starting",
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

        assert.strictEqual(result.msg, "failed to load key");
    });

    test("returns generic not-ready message when Twingate is stopped without an error", () => {
        const result = getTwingateNotReadyResult({
            configured: true,
            starting: false,
            running: false,
            lastError: null,
        });

        assert.strictEqual(result.msg, "Twingate proxy is not ready");
    });

    test("serves health and Twingate status before Twingate lifecycle starts", async () => {
        const twingateStatus = {
            configured: true,
            starting: false,
            running: false,
            proxyUrl: "http://127.0.0.1:9999",
            tunMode: "on",
            lastError: "not started yet",
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
            assert.deepStrictEqual(await healthResponse.json(), { ok: true });
            assert.strictEqual(statusResponse.status, 200);
            assert.deepStrictEqual(await statusResponse.json(), twingateStatus);
        } finally {
            await close(server);
        }
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
