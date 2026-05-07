const { describe, test } = require("node:test");
const assert = require("node:assert");
const { NtlmClient } = require("../../server/modules/axios-ntlm/lib/ntlmClient");

/**
 * Build a fake axios error with the supplied response shape.
 * Mirrors axios's error.response convention.
 * @param {object} response - Mock response object (status, headers, etc.)
 * @returns {Error} Axios-like error with attached response
 */
function buildAxiosError(response) {
    const err = new Error("Request failed");
    err.response = response;
    err.config = (response && response.config) || {};
    return err;
}

/**
 * Pull the rejected handler from the response interceptor of a freshly
 * created NtlmClient. The original buggy implementation exploded inside
 * this function before any of the existence guards ran.
 * @param {object} client - Axios client returned by NtlmClient(...)
 * @returns {Function} The rejected interceptor handler
 */
function getRejectedHandler(client) {
    const handlers = client.interceptors.response.handlers.filter((h) => h && h.rejected);
    assert.ok(handlers.length > 0, "NtlmClient should register a response interceptor");
    return handlers[handlers.length - 1].rejected;
}

describe("NtlmClient response interceptor", () => {
    const credentials = {
        username: "user",
        password: "pass",
        domain: "DOMAIN",
        workstation: "WORKSTATION",
    };

    test("module exports the NtlmClient factory", () => {
        assert.strictEqual(typeof NtlmClient, "function");
    });

    test("creating a client does not throw", () => {
        const client = NtlmClient(credentials, {});
        assert.ok(client);
        assert.ok(client.interceptors && client.interceptors.response);
    });

    test("propagates 5xx error without www-authenticate header (does not throw TypeError)", async () => {
        const client = NtlmClient(credentials, {});
        const rejected = getRejectedHandler(client);

        const err = buildAxiosError({
            status: 500,
            headers: {}, // no www-authenticate at all
            config: { headers: {} },
        });

        await assert.rejects(
            () => Promise.resolve().then(() => rejected(err)),
            (caught) => {
                // Must be the original error, not a TypeError from .split on null/undefined
                assert.strictEqual(caught, err, "should re-throw the original error");
                assert.ok(!(caught instanceof TypeError), "should not be a TypeError");
                return true;
            }
        );
    });

    test("propagates 401 with non-NTLM (Negotiate) www-authenticate header", async () => {
        const client = NtlmClient(credentials, {});
        const rejected = getRejectedHandler(client);

        const err = buildAxiosError({
            status: 401,
            headers: { "www-authenticate": "Negotiate" },
            config: { headers: {} },
        });

        await assert.rejects(
            () => Promise.resolve().then(() => rejected(err)),
            (caught) => {
                assert.strictEqual(caught, err);
                assert.ok(!(caught instanceof TypeError));
                return true;
            }
        );
    });

    test("propagates 401 with no www-authenticate header at all", async () => {
        const client = NtlmClient(credentials, {});
        const rejected = getRejectedHandler(client);

        const err = buildAxiosError({
            status: 401,
            headers: {},
            config: { headers: {} },
        });

        await assert.rejects(
            () => Promise.resolve().then(() => rejected(err)),
            (caught) => {
                assert.strictEqual(caught, err);
                assert.ok(!(caught instanceof TypeError));
                return true;
            }
        );
    });

    test("propagates 401 with null www-authenticate header value", async () => {
        const client = NtlmClient(credentials, {});
        const rejected = getRejectedHandler(client);

        const err = buildAxiosError({
            status: 401,
            headers: { "www-authenticate": null },
            config: { headers: {} },
        });

        await assert.rejects(
            () => Promise.resolve().then(() => rejected(err)),
            (caught) => {
                assert.strictEqual(caught, err);
                assert.ok(!(caught instanceof TypeError));
                return true;
            }
        );
    });

    test("propagates 302 redirect-style error without www-authenticate", async () => {
        const client = NtlmClient(credentials, {});
        const rejected = getRejectedHandler(client);

        const err = buildAxiosError({
            status: 302,
            headers: { location: "https://example.invalid" },
            config: { headers: {} },
        });

        await assert.rejects(
            () => Promise.resolve().then(() => rejected(err)),
            (caught) => {
                assert.strictEqual(caught, err);
                assert.ok(!(caught instanceof TypeError));
                return true;
            }
        );
    });
});
