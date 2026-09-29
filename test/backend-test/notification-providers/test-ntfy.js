const { describe, test } = require("node:test");
const assert = require("node:assert");
const express = require("express");

const Ntfy = require("../../../server/notification-providers/ntfy");

const notification = {
    type: "ntfy",
    ntfytopic: "uptime-kuma-test",
    ntfyPriority: 4,
    ntfyAuthenticationMethod: "none",
};

/**
 * Starts a local server on a free port
 * @param {Function} setup Callback that registers the routes on the express app
 * @returns {Promise<{url: string, close: Function}>} Server URL and a close callback
 */
async function startServer(setup) {
    const app = express();
    app.use(express.json());
    setup(app);

    return new Promise((resolve) => {
        const server = app.listen(0, "127.0.0.1", () => {
            resolve({
                url: `http://127.0.0.1:${server.address().port}`,
                close: () => server.close(),
            });
        });
    });
}

describe("Ntfy", () => {
    const ntfy = new Ntfy();

    test("accepts a published message", async () => {
        const server = await startServer((app) => {
            app.post("/", (req, res) => {
                res.json({
                    id: "0F1sTgV0m2N4",
                    time: 1755000000,
                    event: "message",
                    topic: req.body.topic,
                    message: req.body.message,
                });
            });
        });

        try {
            const result = await ntfy.send({ ...notification, ntfyserverurl: server.url }, "Testing");
            assert.strictEqual(result, "Sent Successfully.");
        } finally {
            server.close();
        }
    });

    test("rejects a request that was redirected away from ntfy", async () => {
        const server = await startServer((app) => {
            app.post("/", (req, res) => res.redirect(302, "/login"));
            app.get("/login", (req, res) => res.send("<html lang='en'><body>Please sign in</body></html>"));
        });

        try {
            await assert.rejects(ntfy.send({ ...notification, ntfyserverurl: server.url }, "Testing"), {
                message: /did not confirm the notification/,
            });
        } finally {
            server.close();
        }
    });
});
