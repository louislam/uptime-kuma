/* eslint-disable jsdoc/require-jsdoc */
const http = require("node:http");
const { runCheck } = require("./checker");
const {
    resolveTwingateServiceKey,
} = require("./twingate-service-key");
const { TwingateLifecycle } = require("./twingate-lifecycle");

const port = Number(process.env.PORT || 8788);
const twingateServiceKey = resolveTwingateServiceKey();
const twingateLifecycle = new TwingateLifecycle({ serviceKey: twingateServiceKey });
const twingateStatus = twingateLifecycle.status;

twingateLifecycle.start();

const server = http.createServer(async (req, res) => {
    try {
        if (req.method === "GET" && req.url === "/health") {
            return sendJson(res, 200, { ok: true });
        }

        if (req.method === "GET" && req.url === "/twingate/status") {
            return sendJson(res, 200, twingateStatus);
        }

        if (req.method === "POST" && req.url === "/check") {
            const job = await readJson(req);
            const result = await runCheck({
                ...job,
                twingateProxyUrl: twingateStatus.proxyUrl,
            });
            return sendJson(res, 200, result);
        }

        return sendJson(res, 404, { error: "Not found" });
    } catch (error) {
        return sendJson(res, 500, { error: error.message });
    }
});

server.listen(port, "0.0.0.0", () => {
    console.log(`Cloudflare monitor runner listening on ${port}`);
});

function readJson(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => {
            try {
                const body = Buffer.concat(chunks).toString("utf8") || "{}";
                resolve(JSON.parse(body));
            } catch (error) {
                reject(error);
            }
        });
        req.on("error", reject);
    });
}

function sendJson(res, status, body) {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
}
