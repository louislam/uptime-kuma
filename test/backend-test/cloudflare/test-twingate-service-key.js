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
    test("prefers full service key JSON over malformed discrete private key inputs", () => {
        const serviceKeyJson = JSON.stringify({
            network: "json.example",
            service_account_id: "json-service-account",
            private_key: TEST_PRIVATE_KEY,
            key_id: "json-key-id",
        });
        const resolved = resolveTwingateServiceKey({
            TWINGATE_SERVICE_KEY_JSON: serviceKeyJson,
            TWINGATE_NETWORK: "wgs.twingate.com",
            TWINGATE_SERVICE_ACCOUNT_ID: "service-account-id",
            TWINGATE_PRIVATE_KEY: JSON.stringify({ private_key: "bad-key" }),
            TWINGATE_KEY_ID: "current-key-id",
        });

        assert.strictEqual(resolved.configured, true);
        assert.strictEqual(resolved.source, "TWINGATE_SERVICE_KEY_JSON");
        assert.strictEqual(resolved.value.toString("utf8"), serviceKeyJson);
    });

    test("builds service key JSON from discrete Worker env vars", () => {
        const resolved = resolveTwingateServiceKey({
            TWINGATE_SERVICE_KEY_VERSION: "1",
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

    test("preserves legacy base64 full service key support", () => {
        const serviceKeyJson = JSON.stringify({ network: "legacy.example", private_key: TEST_PRIVATE_KEY });
        const resolved = resolveTwingateServiceKey({
            TWINGATE_SERVICE_KEY_B64: Buffer.from(serviceKeyJson, "utf8").toString("base64"),
        });

        assert.strictEqual(resolved.configured, true);
        assert.strictEqual(resolved.source, "TWINGATE_SERVICE_KEY_B64");
        assert.strictEqual(resolved.value.toString("utf8"), serviceKeyJson);
    });

    test("supports dashboard JSON full service key value in TWINGATE_SERVICE_KEY_B64", () => {
        const serviceKeyJson = JSON.stringify({ network: "dashboard.example", private_key: TEST_PRIVATE_KEY });
        const resolved = resolveTwingateServiceKey({
            TWINGATE_SERVICE_KEY_B64: serviceKeyJson,
        });

        assert.strictEqual(resolved.configured, true);
        assert.strictEqual(resolved.source, "TWINGATE_SERVICE_KEY_B64");
        assert.strictEqual(resolved.value.toString("utf8"), serviceKeyJson);
    });

    test("prefers current discrete service key env over legacy base64 service key", () => {
        const legacyServiceKeyJson = JSON.stringify({ network: "legacy.example", private_key: "old-key" });
        const resolved = resolveTwingateServiceKey({
            TWINGATE_SERVICE_KEY_B64: Buffer.from(legacyServiceKeyJson, "utf8").toString("base64"),
            TWINGATE_NETWORK: "wgs.twingate.com",
            TWINGATE_SERVICE_ACCOUNT_ID: "service-account-id",
            TWINGATE_PRIVATE_KEY: TEST_PRIVATE_KEY.replace(/\n/g, "\\n"),
            TWINGATE_KEY_ID: "current-key-id",
        });

        assert.strictEqual(resolved.configured, true);
        assert.strictEqual(resolved.source, "TWINGATE_*");
        assert.strictEqual(JSON.parse(resolved.value.toString("utf8")).key_id, "current-key-id");
    });

    test("rejects full service key JSON pasted into TWINGATE_PRIVATE_KEY", () => {
        const resolved = resolveTwingateServiceKey({
            TWINGATE_NETWORK: "wgs.twingate.com",
            TWINGATE_SERVICE_ACCOUNT_ID: "service-account-id",
            TWINGATE_PRIVATE_KEY: JSON.stringify({ private_key: TEST_PRIVATE_KEY }),
            TWINGATE_KEY_ID: "key-id",
        });

        assert.strictEqual(resolved.configured, false);
        assert.match(
            resolved.missing.join(" "),
            /TWINGATE_PRIVATE_KEY must contain only the PEM private_key value, not the full service key JSON/
        );
    });

    test("rejects full service key JSON pasted into TWINGATE_PRIVATE_KEY_B64", () => {
        const resolved = resolveTwingateServiceKey({
            TWINGATE_NETWORK: "wgs.twingate.com",
            TWINGATE_SERVICE_ACCOUNT_ID: "service-account-id",
            TWINGATE_PRIVATE_KEY_B64: Buffer.from(
                JSON.stringify({ private_key: TEST_PRIVATE_KEY }),
                "utf8"
            ).toString("base64"),
            TWINGATE_KEY_ID: "key-id",
        });

        assert.strictEqual(resolved.configured, false);
        assert.match(
            resolved.missing.join(" "),
            /TWINGATE_PRIVATE_KEY_B64 must decode to only the PEM private_key value, not the full service key JSON/
        );
    });

    test("rejects private key input missing PEM boundaries", () => {
        const resolved = resolveTwingateServiceKey({
            TWINGATE_NETWORK: "wgs.twingate.com",
            TWINGATE_SERVICE_ACCOUNT_ID: "service-account-id",
            TWINGATE_PRIVATE_KEY: "not a pem key",
            TWINGATE_KEY_ID: "key-id",
        });

        assert.strictEqual(resolved.configured, false);
        assert.match(
            resolved.missing.join(" "),
            /TWINGATE_PRIVATE_KEY must be a PEM private key with BEGIN and END private key boundaries/
        );
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
