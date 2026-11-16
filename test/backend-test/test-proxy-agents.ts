import { describe, test } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Proxy } = require("../../server/proxy");

/**
 * Build an HTTP proxy config
 * @param {object} overrides Fields to override
 * @returns {object} Proxy config
 */
function httpProxy(overrides = {}) {
    return { protocol: "http", host: "127.0.0.1", port: 8080, auth: false, ...overrides };
}

describe("Proxy.createAgents()", () => {
    test("creates separate http and https agents for an http proxy", () => {
        const { httpAgent, httpsAgent } = Proxy.createAgents(httpProxy(), {
            httpAgentOptions: {},
            httpsAgentOptions: {},
        });

        assert.ok(httpAgent);
        assert.ok(httpsAgent);
        assert.notStrictEqual(httpAgent, httpsAgent);
    });

    test("passes the proxy credentials to the agent url", () => {
        const { httpAgent } = Proxy.createAgents(httpProxy({ auth: true, username: "user", password: "pass" }), {
            httpAgentOptions: {},
            httpsAgentOptions: {},
        });

        assert.strictEqual(httpAgent.proxy.username, "user");
        assert.strictEqual(httpAgent.proxy.password, "pass");
    });

    test("uses a single agent for socks proxies", () => {
        const { httpAgent, httpsAgent } = Proxy.createAgents(httpProxy({ protocol: "socks5", port: 1080 }), {
            httpAgentOptions: {},
            httpsAgentOptions: { rejectUnauthorized: false },
        });

        assert.ok(httpAgent);
        assert.strictEqual(httpAgent, httpsAgent);
    });

    test("rejects an unsupported proxy protocol", () => {
        assert.throws(
            () => Proxy.createAgents(httpProxy({ protocol: "ftp" }), { httpAgentOptions: {}, httpsAgentOptions: {} }),
            /Unsupported proxy protocol provided/
        );
    });
});
