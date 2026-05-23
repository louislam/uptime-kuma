import { describe, test } from "node:test";
import assert from "node:assert";

import {
    buildStartingTwingateStatus,
    buildUnavailableTwingateStatus,
    isTransientContainerStartupError,
    resolveTwingateStatusTimeoutMs,
    sanitizeRunnerStatus,
} from "../../../cloudflare/worker/twingate-status.mjs";

describe("Twingate Worker status helpers", () => {
    test("classifies Cloudflare container not-running bootstrap errors as transient startup", () => {
        assert.strictEqual(
            isTransientContainerStartupError(
                "Failed to start container: The container is not running, consider calling start()"
            ),
            true
        );
        assert.strictEqual(
            isTransientContainerStartupError(
                "Failed to start runner container: Failed to start container: The operation was aborted"
            ),
            true
        );
        assert.strictEqual(
            isTransientContainerStartupError("container crashed before status endpoint"),
            false
        );
    });

    test("builds a sanitized starting status for transient container bootstrap failures", () => {
        const status = buildStartingTwingateStatus({
            TWINGATE_PRIVATE_KEY_B64: "configured-secret",
        });

        assert.deepStrictEqual(status, {
            configured: true,
            starting: true,
            running: false,
            proxyUrl: "http://127.0.0.1:9999",
            tunMode: "off",
            lastError: "Twingate runner container is starting or provisioning. Refresh in a few seconds.",
        });
    });

    test("builds unavailable status for non-transient runner failures", () => {
        const status = buildUnavailableTwingateStatus(
            {
                TWINGATE_PRIVATE_KEY_B64: "configured-secret",
                TWINGATE_TUN: "on",
            },
            "container crashed before status endpoint"
        );

        assert.deepStrictEqual(status, {
            configured: true,
            starting: false,
            running: false,
            proxyUrl: "http://127.0.0.1:9999",
            tunMode: "on",
            lastError: "container crashed before status endpoint",
        });
    });

    test("sanitizes runner status without exposing inspection details", () => {
        const status = sanitizeRunnerStatus({
            configured: true,
            starting: true,
            running: false,
            proxyUrl: "http://127.0.0.1:9999",
            tunMode: "on",
            lastError: null,
            serviceKeyInspection: {
                privateKeyShape: {
                    sha256Prefix: "123456789abc",
                },
            },
        });

        assert.deepStrictEqual(status, {
            configured: true,
            starting: true,
            running: false,
            proxyUrl: "http://127.0.0.1:9999",
            tunMode: "on",
            lastError: null,
        });
    });

    test("resolves Twingate status timeout with defaults and clamped env overrides", () => {
        assert.strictEqual(resolveTwingateStatusTimeoutMs(), 10000);
        assert.strictEqual(resolveTwingateStatusTimeoutMs({ TWINGATE_STATUS_REQUEST_TIMEOUT_MS: "2500" }), 2500);
        assert.strictEqual(resolveTwingateStatusTimeoutMs({ TWINGATE_STATUS_REQUEST_TIMEOUT_MS: "10" }), 1000);
        assert.strictEqual(resolveTwingateStatusTimeoutMs({ TWINGATE_STATUS_REQUEST_TIMEOUT_MS: "90000" }), 30000);
        assert.strictEqual(resolveTwingateStatusTimeoutMs({ TWINGATE_STATUS_REQUEST_TIMEOUT_MS: "invalid" }), 10000);
    });
});
