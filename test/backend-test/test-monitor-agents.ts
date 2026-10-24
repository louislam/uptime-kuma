import { describe, test } from "node:test";
import assert from "node:assert";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { attachKeylogListener, clearMonitorAgents, getMonitorAgents } = require("../../server/monitor-agents");

/**
 * Build the agent options passed by Monitor.beat()
 * @returns {object} Agent options
 */
function agentOptions() {
    return { httpAgentOptions: {}, httpsAgentOptions: {} };
}

describe("getMonitorAgents()", () => {
    test("reuses the same agents for one monitor", async () => {
        const monitor = { proxy_id: null };

        const first = await getMonitorAgents(monitor, agentOptions());
        const second = await getMonitorAgents(monitor, agentOptions());

        assert.strictEqual(second.httpAgent, first.httpAgent);
        assert.strictEqual(second.httpsAgent, first.httpsAgent);
    });

    test("creates keep-alive agents for a direct connection", async () => {
        const agents = await getMonitorAgents({ proxy_id: null }, agentOptions());

        assert.strictEqual(agents.httpAgent.keepAlive, true);
        assert.strictEqual(agents.httpsAgent.keepAlive, true);
        assert.strictEqual(agents.proxied, false);
    });

    test("does not share agents between monitors", async () => {
        const first = await getMonitorAgents({ proxy_id: null }, agentOptions());
        const second = await getMonitorAgents({ proxy_id: null }, agentOptions());

        assert.notStrictEqual(second.httpAgent, first.httpAgent);
        assert.notStrictEqual(second.httpsAgent, first.httpsAgent);
    });

    test("clearMonitorAgents() drops the cached agents", async () => {
        const monitor = { proxy_id: null };

        const first = await getMonitorAgents(monitor, agentOptions());
        clearMonitorAgents(monitor);
        const second = await getMonitorAgents(monitor, agentOptions());

        assert.notStrictEqual(second.httpAgent, first.httpAgent);
        assert.notStrictEqual(second.httpsAgent, first.httpsAgent);
    });
});

describe("attachKeylogListener()", () => {
    test("replaces the listener of the previous beat", () => {
        const agents = {};
        const httpsAgent = new EventEmitter();

        const first = attachKeylogListener(agents, httpsAgent, () => {});
        const second = attachKeylogListener(agents, httpsAgent, () => {});

        assert.notStrictEqual(first, second);
        assert.strictEqual(httpsAgent.listenerCount("keylog"), 1);
    });

    test("calls back after the TLS handshake", () => {
        const agents = {};
        const httpsAgent = new EventEmitter();
        let certificates = 0;
        attachKeylogListener(agents, httpsAgent, () => certificates++);

        const tlsSocket = new EventEmitter();
        httpsAgent.emit("keylog", Buffer.from(""), tlsSocket);
        assert.strictEqual(certificates, 0);

        tlsSocket.emit("secureConnect");
        assert.strictEqual(certificates, 1);
    });
});
