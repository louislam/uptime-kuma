process.env.UPTIME_KUMA_HIDE_LOG = [ "info_db", "info_server" ].join(",");

const { describe, test, mock } = require("node:test");
const assert = require("node:assert");
const jwt = require("jsonwebtoken");
const Monitor = require("../../server/model/monitor");
const { UptimeKumaServer } = require("../../server/uptime-kuma-server");

describe("Monitor screenshot path JWT caching (M-6)", () => {
    test("_signedScreenshotPath returns the same value across calls", () => {
        const monitor = Object.create(Monitor.prototype);
        monitor.id = 42;

        const fakeServer = { jwtSecret: "test-secret-xyz" };
        const getInstanceMock = mock.method(UptimeKumaServer, "getInstance", () => fakeServer);

        try {
            const first = monitor._signedScreenshotPath;
            const second = monitor._signedScreenshotPath;

            assert.strictEqual(first, second);
            assert.match(first, /^\/screenshots\/.+\.png$/);

            // Verify the cached payload decodes back to this monitor's id.
            // jsonwebtoken stringifies non-object payloads, so the decoded
            // value comes back as a string regardless of the input type.
            const token = first.replace("/screenshots/", "").replace(".png", "");
            const decoded = jwt.verify(token, fakeServer.jwtSecret);
            assert.strictEqual(String(decoded), "42");
        } finally {
            getInstanceMock.mock.restore();
        }
    });

    test("jwt.sign is invoked only once even when accessed many times", () => {
        const monitor = Object.create(Monitor.prototype);
        monitor.id = 7;

        const fakeServer = { jwtSecret: "another-secret" };
        const getInstanceMock = mock.method(UptimeKumaServer, "getInstance", () => fakeServer);
        const signMock = mock.method(jwt, "sign");

        try {
            for (let i = 0; i < 50; i++) {
                // eslint-disable-next-line no-unused-expressions
                monitor._signedScreenshotPath;
            }

            assert.strictEqual(signMock.mock.callCount(), 1, "jwt.sign must be called exactly once");
        } finally {
            signMock.mock.restore();
            getInstanceMock.mock.restore();
        }
    });

    test("each Monitor instance has an independent cache", () => {
        const a = Object.create(Monitor.prototype);
        a.id = 1;
        const b = Object.create(Monitor.prototype);
        b.id = 2;

        const fakeServer = { jwtSecret: "shared-secret" };
        const getInstanceMock = mock.method(UptimeKumaServer, "getInstance", () => fakeServer);

        try {
            const pathA = a._signedScreenshotPath;
            const pathB = b._signedScreenshotPath;

            assert.notStrictEqual(pathA, pathB, "different monitor IDs must produce different signed paths");
            assert.strictEqual(a._signedScreenshotPath, pathA);
            assert.strictEqual(b._signedScreenshotPath, pathB);
        } finally {
            getInstanceMock.mock.restore();
        }
    });
});
