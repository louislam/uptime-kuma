const { after, before, beforeEach, describe, test } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const { middleware, clear } = require("../../server/utils/response-cache");

/**
 * Build a server whose body is derived from the request host, like StatusPage.buildRSSUrl
 * @param {string|number} duration Cache duration
 * @param {object} options Middleware options
 * @returns {Promise<import("node:http").Server>} Listening server
 */
async function startServer(duration, options) {
    const handler = middleware(duration, options);
    const server = http.createServer((req, res) => {
        handler(req, res, () => {
            const host = req.headers["x-forwarded-host"] || req.headers.host;
            const body = `<link>http://${host}/status/demo</link>`;
            res.setHeader("Content-Type", "application/rss+xml");
            res.setHeader("Content-Length", Buffer.byteLength(body));
            res.setHeader("ETag", '"cached"');
            res.end(body);
        });
    });
    await new Promise((resolve) => server.listen(0, resolve));
    return server;
}

/**
 * Request the test server
 * @param {number} port Server port
 * @param {object} headers Request headers
 * @returns {Promise<{status: number, headers: object, body: string}>} Parsed response
 */
function request(port, headers = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request({ port, path: "/status/demo/rss", headers }, (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
        });
        req.on("error", reject);
        req.end();
    });
}

describe("Response cache", () => {
    let server;
    let port;

    before(async () => {
        server = await startServer("5 minutes");
        port = server.address().port;
    });

    beforeEach(() => {
        clear();
    });

    after(async () => {
        clear();
        await new Promise((resolve) => server.close(resolve));
    });

    test("never reuses an entry stored under another Host", async () => {
        const primed = await request(port, { Host: "canonical-evil.example" });
        assert.match(primed.body, /canonical-evil\.example/);

        const victim = await request(port, { Host: "kuma.local" });
        assert.strictEqual(victim.headers["x-cache"], "miss");
        assert.match(victim.body, /kuma\.local/);
    });

    test("serves repeats from cache and always tells clients not to store", async () => {
        const first = await request(port, { Host: "kuma.local" });
        const second = await request(port, { Host: "kuma.local" });

        assert.strictEqual(first.headers["x-cache"], "miss");
        assert.strictEqual(second.headers["x-cache"], "hit");
        assert.strictEqual(second.body, first.body);
        assert.strictEqual(first.headers["cache-control"], "no-store");
        assert.strictEqual(second.headers["cache-control"], "no-store");
    });

    test("keys proxy headers by default, so a poached header cannot leak", async () => {
        const poached = await request(port, { Host: "kuma.local", "X-Forwarded-Host": "evil.example" });
        assert.match(poached.body, /evil\.example/);

        const clean = await request(port, { Host: "kuma.local" });
        assert.strictEqual(clean.headers["x-cache"], "miss");
        assert.match(clean.body, /kuma\.local/);
    });

    test("keeps an explicit vary list apart", async () => {
        const varyServer = await startServer("5 minutes", { vary: ["x-forwarded-host"] });
        const varyPort = varyServer.address().port;

        const poisoned = await request(varyPort, { Host: "kuma-vary.local", "X-Forwarded-Host": "evil.example" });
        const clean = await request(varyPort, { Host: "kuma-vary.local" });

        assert.strictEqual(clean.headers["x-cache"], "miss");
        assert.match(poisoned.body, /evil\.example/);
        assert.match(clean.body, /kuma-vary\.local/);

        await new Promise((resolve) => varyServer.close(resolve));
    });

    test("keys X-Forwarded-Proto as well", async () => {
        await request(port, { Host: "kuma-proto.local", "X-Forwarded-Proto": "https" });
        const plain = await request(port, { Host: "kuma-proto.local" });

        assert.strictEqual(plain.headers["x-cache"], "miss");
    });

    test("does not cache non-200 responses", async () => {
        const handler = middleware("5 minutes");
        const notFoundServer = http.createServer((req, res) => {
            handler(req, res, () => {
                res.statusCode = 404;
                res.end("missing");
            });
        });
        await new Promise((resolve) => notFoundServer.listen(0, resolve));
        const notFoundPort = notFoundServer.address().port;

        const first = await request(notFoundPort, { Host: "kuma-404.local" });
        const second = await request(notFoundPort, { Host: "kuma-404.local" });

        assert.strictEqual(first.status, 404);
        assert.strictEqual(second.headers["x-cache"], "miss");

        await new Promise((resolve) => notFoundServer.close(resolve));
    });

    test("expires an entry after its duration", async () => {
        const shortServer = await startServer("1 second");
        const shortPort = shortServer.address().port;

        await request(shortPort, { Host: "kuma-ttl.local" });
        await new Promise((resolve) => setTimeout(resolve, 1100));
        const expired = await request(shortPort, { Host: "kuma-ttl.local" });

        assert.strictEqual(expired.headers["x-cache"], "miss");

        await new Promise((resolve) => shortServer.close(resolve));
    });

    test("replies 304 for a matching If-None-Match", async () => {
        const warm = await request(port, { Host: "kuma-etag.local" });
        const response = await request(port, { Host: "kuma-etag.local", "If-None-Match": warm.headers.etag });

        assert.strictEqual(response.status, 304);
        assert.strictEqual(response.headers.etag, warm.headers.etag);
        assert.strictEqual(response.headers["content-length"], undefined);
        assert.strictEqual(response.headers["content-type"], undefined);
        assert.strictEqual(response.body, "");
    });
});
