const { describe, test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");

const axios = require("axios");

describe("NtlmClient", () => {
    const originalCreate = axios.create;
    let rejectHandler;

    beforeEach(() => {
        /**
         * Mocked axios instance callable.
         * @returns {Promise<object>} Empty response object
         */
        function mockClient() {
            return Promise.resolve({});
        }

        mockClient.interceptors = {
            response: {
                use: (_onFulfilled, onRejected) => {
                    rejectHandler = onRejected;
                },
            },
        };

        axios.create = () => mockClient;
        delete require.cache[require.resolve("../../../server/modules/axios-ntlm/lib/ntlmClient")];
        const { NtlmClient } = require("../../../server/modules/axios-ntlm/lib/ntlmClient");
        NtlmClient({ username: "u", password: "p", domain: "d" });
    });

    afterEach(() => {
        axios.create = originalCreate;
    });

    test("rethrows original error when response is missing", async () => {
        const err = new Error("network error");
        await assert.rejects(
            () => rejectHandler(err),
            (caught) => caught === err
        );
    });

    test("rethrows original error when 401 response has null www-authenticate header", async () => {
        const err = new Error("null auth header");
        err.response = {
            status: 401,
            headers: {
                "www-authenticate": null,
            },
            config: {
                headers: {},
            },
        };
        await assert.rejects(
            () => rejectHandler(err),
            (caught) => caught === err
        );
    });

    test("rethrows original error when response headers are missing", async () => {
        const err = new Error("missing headers");
        err.response = {
            status: 401,
            config: {
                headers: {},
            },
        };

        await assert.rejects(
            () => rejectHandler(err),
            (caught) => caught === err
        );
    });

    test("handles array-form www-authenticate header without crashing", async () => {
        const err = new Error("array header");
        err.response = {
            status: 401,
            headers: {
                "www-authenticate": ["Negotiate", 'Basic realm="example"'],
            },
            config: {
                headers: {},
            },
        };

        await assert.rejects(
            () => rejectHandler(err),
            (caught) => caught === err
        );
    });
});
