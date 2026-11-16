import { describe, test } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { readTlsInfo } = require("../../server/monitor-tls");

const raw = Buffer.from("certificate");

/**
 * Certificate helper stubs
 * @param {boolean} hostnameMatches Value returned by the hostname check
 * @returns {object} Dependencies and calls
 */
function deps(hostnameMatches) {
    const calls = { certificate: 0, hostname: [] };
    return {
        calls,
        deps: {
            checkCertificate: () => {
                calls.certificate++;
                return { certInfo: { raw } };
            },
            checkCertificateHostname: (certRaw, hostname) => {
                calls.hostname.push({ certRaw, hostname });
                return hostnameMatches;
            },
        },
    };
}

describe("readTlsInfo()", () => {
    test("marks a certificate as valid when the socket is authorized", () => {
        const { deps: helpers, calls } = deps(true);

        const info = readTlsInfo({ authorized: true }, "example.com", helpers);

        assert.strictEqual(info.valid, true);
        assert.strictEqual(info.hostnameMatchMonitorUrl, true);
        assert.strictEqual(calls.certificate, 1);
        assert.deepStrictEqual(calls.hostname, [{ certRaw: raw, hostname: "example.com" }]);
    });

    test("treats a missing authorization as invalid", () => {
        const { deps: helpers } = deps(true);

        const info = readTlsInfo({}, "example.com", helpers);

        assert.strictEqual(info.valid, false);
    });

    test("keeps a hostname mismatch", () => {
        const { deps: helpers } = deps(false);

        const info = readTlsInfo({ authorized: true }, "wrong.example", helpers);

        assert.strictEqual(info.valid, true);
        assert.strictEqual(info.hostnameMatchMonitorUrl, false);
    });
});
