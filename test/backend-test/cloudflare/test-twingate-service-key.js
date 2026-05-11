/* eslint-disable jsdoc/require-jsdoc */
const { describe, test } = require("node:test");
const assert = require("node:assert");
const { resolveTwingateServiceKey } = require("../../../cloudflare/runner/twingate-service-key");

const TEST_PRIVATE_KEY = [
    "-----BEGIN PRIVATE KEY-----",
    "test-key",
    "-----END PRIVATE KEY-----",
].join("\n");

describe("Twingate service key env", () => {
    test("builds service key JSON from discrete Worker env vars", () => {
        const resolved = resolveTwingateServiceKey({
            TWINGATE_NETWORK: "wgs.twingate.com",
            TWINGATE_SERVICE_ACCOUNT_ID: "service-account-id",
            TWINGATE_PRIVATE_KEY: TEST_PRIVATE_KEY.replace(/\n/g, "\\n"),
            TWINGATE_KEY_ID: "key-id",
            TWINGATE_LOGIN_PATH: "/api/v4/headless/login",
        });

        assert.strictEqual(resolved.configured, true);
        assert.strictEqual(resolved.source, "TWINGATE_*");

        const serviceKey = JSON.parse(resolved.value.toString("utf8"));
        assert.deepStrictEqual(serviceKey, {
            version: "1",
            network: "wgs.twingate.com",
            service_account_id: "service-account-id",
            private_key: TEST_PRIVATE_KEY,
            key_id: "key-id",
            expires_at: null,
            login_path: "/api/v4/headless/login",
        });
    });

    test("supports a base64-encoded PEM private key", () => {
        const resolved = resolveTwingateServiceKey({
            TWINGATE_NETWORK: "wgs.twingate.com",
            TWINGATE_SERVICE_ACCOUNT_ID: "service-account-id",
            TWINGATE_PRIVATE_KEY_B64: Buffer.from(TEST_PRIVATE_KEY, "utf8").toString("base64"),
            TWINGATE_KEY_ID: "key-id",
        });

        assert.strictEqual(resolved.configured, true);
        const serviceKey = JSON.parse(resolved.value.toString("utf8"));
        assert.strictEqual(serviceKey.private_key, TEST_PRIVATE_KEY);
        assert.strictEqual(serviceKey.login_path, "/api/v4/headless/login");
    });

    test("reports missing fields for partial discrete service key env", () => {
        const resolved = resolveTwingateServiceKey({
            TWINGATE_NETWORK: "wgs.twingate.com",
        });

        assert.strictEqual(resolved.configured, false);
        assert.deepStrictEqual(resolved.missing, [
            "TWINGATE_SERVICE_ACCOUNT_ID",
            "TWINGATE_KEY_ID",
            "TWINGATE_PRIVATE_KEY or TWINGATE_PRIVATE_KEY_B64",
        ]);
    });
});
