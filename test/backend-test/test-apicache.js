const { after, before, describe, test } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const apicache = require("../../server/modules/apicache/apicache").newInstance();

/**
 * Request the test server.
 * @param {number} port Server port
 * @param {object} headers Request headers
 * @returns {Promise<import("node:http").IncomingMessage>} Server response
 */
function request(port, headers = {}) {
    return new Promise((resolve, reject) => {
        const req = http.request({ port, path: "/cached", headers }, resolve);
        req.on("error", reject);
        req.end();
    });
}

describe("API cache", () => {
    let server;
    let port;

    before(async () => {
        const cache = apicache.middleware("1 minute");
        server = http.createServer((req, res) => {
            cache(req, res, () => {
                const body = "cached body";
                res.setHeader("Content-Type", "text/plain");
                res.setHeader("Content-Length", Buffer.byteLength(body));
                res.setHeader("ETag", '"cached"');
                res.end(body);
            });
        });
        await new Promise((resolve) => server.listen(0, resolve));
        port = server.address().port;
    });

    after(async () => {
        apicache.clear("/cached");
        await new Promise((resolve) => server.close(resolve));
    });

    test("cached response omits representation headers for a matching ETag", async () => {
        const warmResponse = await request(port);
        warmResponse.resume();
        await new Promise((resolve) => warmResponse.on("end", resolve));

        const response = await request(port, { "If-None-Match": '"cached"' });
        response.resume();

        assert.strictEqual(response.statusCode, 304);
        assert.strictEqual(response.headers.etag, '"cached"');
        assert.strictEqual(response.headers["content-length"], undefined);
        assert.strictEqual(response.headers["content-type"], undefined);
    });
});
