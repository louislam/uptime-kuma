const { describe, test } = require("node:test");
const assert = require("node:assert");
const express = require("express");
const commandExists = require("command-exists");

const Apprise = require("../../../server/notification-providers/apprise");

// Apprise is an external CLI. It is bundled in the Docker image, but not
// installed on every dev machine / CI runner, so skip when it is unavailable.
// The `json://` (Custom JSON) service is used as a throwaway local endpoint.
const appriseAvailable = commandExists.sync("apprise");
const skip = appriseAvailable ? false : "apprise CLI is not installed";

describe("Apprise notification provider", { skip }, () => {
    test("send() delivers the title and message to a Custom JSON endpoint", async () => {
        const app = express();
        app.use(express.json());

        let received = null;
        app.post("/notify", (req, res) => {
            received = req.body;
            res.status(200).json({ ok: true });
        });

        const server = await new Promise((resolve) => {
            const s = app.listen(0, () => resolve(s));
        });

        try {
            const notification = {
                appriseURL: `json://127.0.0.1:${server.address().port}/notify`,
                title: "The Title",
            };

            const result = await new Apprise().send(notification, "the body text");

            assert.strictEqual(result, "Sent Successfully.");
            assert.deepStrictEqual(received, {
                version: "1.0",
                title: "The Title",
                message: "the body text",
                attachments: [],
                type: "info",
            });
        } finally {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    test("send() rejects when the endpoint cannot be reached", async () => {
        // Nothing is listening on port 1, so apprise exits non-zero.
        await assert.rejects(
            new Apprise().send({ appriseURL: "json://127.0.0.1:1/notify" }, "msg"),
            /exited with code/
        );
    });
});
