const http = require("node:http");
const fs = require("node:fs");
const childProcess = require("node:child_process");
const { runCheck } = require("./checker");

const port = Number(process.env.PORT || 8788);
const twingateStatus = {
    configured: Boolean(process.env.TWINGATE_SERVICE_KEY_B64),
    running: false,
    proxyUrl: process.env.TWINGATE_PROXY_URL || "http://127.0.0.1:9999",
    lastError: null,
};

startTwingate();

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

function startTwingate() {
    if (!process.env.TWINGATE_SERVICE_KEY_B64) {
        return;
    }

    try {
        fs.mkdirSync("/etc/twingate", { recursive: true });
        fs.writeFileSync(
            "/etc/twingate/service_key.json",
            Buffer.from(process.env.TWINGATE_SERVICE_KEY_B64, "base64")
        );

        const proxyAddress = twingateStatus.proxyUrl.replace(/^https?:\/\//, "");
        const child = childProcess.spawn("twingated", ["--http-proxy", proxyAddress, "--tun", "off"], {
            stdio: ["ignore", "pipe", "pipe"],
        });

        twingateStatus.running = true;
        child.stderr.on("data", (chunk) => {
            twingateStatus.lastError = chunk.toString("utf8").trim() || null;
        });
        child.on("exit", (code, signal) => {
            twingateStatus.running = false;
            twingateStatus.lastError = `twingated exited with ${signal || code}`;
        });
    } catch (error) {
        twingateStatus.running = false;
        twingateStatus.lastError = error.message;
    }
}

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
