/* eslint-disable jsdoc/require-jsdoc */
const { describe, test } = require("node:test");
const assert = require("node:assert");

const {
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
});
