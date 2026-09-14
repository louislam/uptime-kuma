const { describe, test } = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const axios = require("axios");
const Monitor = require("../../server/model/monitor");

describe("Monitor: HTTP digest auth end-to-end retry flow", () => {
    test("retries a 401 challenge with a computed Authorization header, then returns the authenticated response", async (t) => {
        const monitor = Object.create(Monitor.prototype);
        monitor.auth_method = "digest";
        monitor.basic_auth_user = "alice";
        monitor.basic_auth_pass = "s3cr3t-password";

        const wwwAuthenticate = 'Digest realm="example.com", qop="auth", nonce="abc123nonce"';
        const authenticatedResponse = { status: 200, data: "ok" };

        let callCount = 0;
        const requestMock = t.mock.method(axios, "request", () => {
            callCount++;
            if (callCount === 1) {
                const error = new Error("Request failed with status code 401");
                error.response = { status: 401, headers: { "www-authenticate": wwwAuthenticate } };
                return Promise.reject(error);
            }
            return Promise.resolve(authenticatedResponse);
        });

        const originalRandomBytes = crypto.randomBytes;
        crypto.randomBytes = () => Buffer.from("11223344", "hex");

        let result;
        try {
            result = await monitor.makeAxiosRequest({
                url: "http://example.com/dir/index.html",
                method: "GET",
                headers: {},
            });
        } finally {
            crypto.randomBytes = originalRandomBytes;
        }

        assert.strictEqual(result, authenticatedResponse);
        assert.strictEqual(requestMock.mock.calls.length, 2);

        const ha1 = crypto.createHash("md5").update("alice:example.com:s3cr3t-password").digest("hex");
        const ha2 = crypto.createHash("md5").update("GET:/dir/index.html").digest("hex");
        const expectedResponse = crypto
            .createHash("md5")
            .update(`${ha1}:abc123nonce:00000001:11223344:auth:${ha2}`)
            .digest("hex");

        const retryOptions = requestMock.mock.calls[1].arguments[0];
        assert.match(retryOptions.headers.Authorization, new RegExp(`response="${expectedResponse}"`));
    });

    test("does not attempt a digest retry when the server never challenges the request", async (t) => {
        const monitor = Object.create(Monitor.prototype);
        monitor.auth_method = "digest";
        monitor.basic_auth_user = "alice";
        monitor.basic_auth_pass = "s3cr3t-password";

        const directResponse = { status: 200, data: "ok" };
        const requestMock = t.mock.method(axios, "request", () => Promise.resolve(directResponse));

        const result = await monitor.makeAxiosRequest({
            url: "http://example.com/dir/index.html",
            method: "GET",
            headers: {},
        });

        assert.strictEqual(result, directResponse);
        assert.strictEqual(requestMock.mock.calls.length, 1);
        assert.strictEqual(requestMock.mock.calls[0].arguments[0].headers.Authorization, undefined);
    });

    test("propagates the 401 when the retried request is rejected too (e.g. wrong password), without retrying again", async (t) => {
        const monitor = Object.create(Monitor.prototype);
        monitor.auth_method = "digest";
        monitor.basic_auth_user = "alice";
        monitor.basic_auth_pass = "wrong-password";

        const wwwAuthenticate = 'Digest realm="example.com", qop="auth", nonce="abc123nonce"';

        const requestMock = t.mock.method(axios, "request", () => {
            const error = new Error("Request failed with status code 401");
            error.response = { status: 401, headers: { "www-authenticate": wwwAuthenticate } };
            return Promise.reject(error);
        });

        await assert.rejects(
            () =>
                monitor.makeAxiosRequest({
                    url: "http://example.com/dir/index.html",
                    method: "GET",
                    headers: {},
                }),
            (error) => error.response?.status === 401
        );

        // Exactly one retry: finalCall is true after the first retry, so a second
        // 401 must not trigger another digest attempt (that would loop forever).
        assert.strictEqual(requestMock.mock.calls.length, 2);
        assert.match(requestMock.mock.calls[1].arguments[0].headers.Authorization, /^Digest /);
    });
});
