const { describe, test, after } = require("node:test");
const assert = require("node:assert");
const http = require("http");
const { getOidcTokenClientCredentials, selectMonitorProxyAgent } = require("../../server/util-server");
const { Proxy } = require("../../server/proxy");

/**
 * Listen on an ephemeral localhost port
 * @param {http.Server} server Server to bind
 * @returns {Promise<number>} Bound port
 */
function listen(server) {
    return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            resolve(server.address().port);
        });
    });
}

/**
 * Close a server
 * @param {http.Server} server Server to close
 * @returns {Promise<void>}
 */
function close(server) {
    return new Promise((resolve) => {
        server.close(() => resolve());
    });
}

describe("selectMonitorProxyAgent()", () => {
    test("returns the http or https agent the monitor request uses", () => {
        const httpAgent = { name: "http" };
        const httpsAgent = { name: "https" };
        const agents = { proxied: true, httpAgent, httpsAgent };

        assert.strictEqual(selectMonitorProxyAgent("http://idp.example/token", agents), httpAgent);
        assert.strictEqual(selectMonitorProxyAgent("https://idp.example/token", agents), httpsAgent);
    });

    test("returns undefined when the monitor is not proxied", () => {
        const agents = { proxied: false, httpAgent: {}, httpsAgent: {} };

        assert.strictEqual(selectMonitorProxyAgent("https://idp.example/token", agents), undefined);
        assert.strictEqual(selectMonitorProxyAgent("https://idp.example/token", undefined), undefined);
    });
});

describe("getOidcTokenClientCredentials proxy agent", () => {
    /** @type {http.Server | undefined} */
    let tokenServer;
    /** @type {http.Server | undefined} */
    let proxyServer;

    after(async () => {
        if (tokenServer) {
            await close(tokenServer);
        }
        if (proxyServer) {
            await close(proxyServer);
        }
    });

    test("sends the token request through the monitor proxy agent", async () => {
        let tokenHits = 0;
        let proxyHits = 0;

        tokenServer = http.createServer((req, res) => {
            tokenHits += 1;
            res.writeHead(200, { "content-type": "application/json" });
            res.end(
                JSON.stringify({
                    access_token: "token-1",
                    token_type: "Bearer",
                    expires_in: 3600,
                })
            );
        });
        const tokenPort = await listen(tokenServer);

        proxyServer = http.createServer((req, res) => {
            proxyHits += 1;
            const target = new URL(req.url);
            const proxyReq = http.request(
                {
                    hostname: target.hostname,
                    port: target.port,
                    path: `${target.pathname}${target.search}`,
                    method: req.method,
                    headers: {
                        ...req.headers,
                        host: target.host,
                    },
                },
                (proxyRes) => {
                    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
                    proxyRes.pipe(res);
                }
            );
            proxyReq.on("error", (error) => {
                res.writeHead(502);
                res.end(error.message);
            });
            req.pipe(proxyReq);
        });
        const proxyPort = await listen(proxyServer);

        const { httpAgent } = Proxy.createAgents(
            { protocol: "http", host: "127.0.0.1", port: proxyPort, auth: false },
            { httpAgentOptions: {}, httpsAgentOptions: {} }
        );

        const token = await getOidcTokenClientCredentials(
            `http://127.0.0.1:${tokenPort}/token`,
            "client-id",
            "client-secret",
            "openid",
            undefined,
            "client_secret_post",
            httpAgent
        );

        assert.strictEqual(token.access_token, "token-1");
        assert.strictEqual(proxyHits, 1);
        assert.strictEqual(tokenHits, 1);
        httpAgent.destroy();
    });
});
