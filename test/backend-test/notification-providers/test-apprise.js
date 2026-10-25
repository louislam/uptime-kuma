const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const express = require("express");
const commandExists = require("command-exists");

const Apprise = require("../../../server/notification-providers/apprise");

const skip = commandExists.sync("apprise") ? false : "apprise CLI is not installed";

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
            await new Apprise().send(
                {
                    appriseURL: `json://127.0.0.1:${server.address().port}/notify`,
                    title: "The Title",
                },
                "the body text"
            );

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
        await assert.rejects(
            new Apprise().send({ appriseURL: "json://127.0.0.1:1/notify" }, "msg"),
            /exited with code/
        );
    });

    test("send() does not let a URL be executed as an apprise flag", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "apprise-argue-"));
        const marker = path.join(dir, "pwned.txt");
        await fs.writeFile(path.join(dir, "pwn.py"), `open(${JSON.stringify(marker)}, "w").write("executed")`);

        try {
            await assert.rejects(new Apprise().send({ appriseURL: `--plugin-path=${dir}` }, "msg"), /exited with code/);
            await assert.rejects(fs.access(marker), "the injected Python must not run");
        } finally {
            await fs.rm(dir, { recursive: true, force: true });
        }
    });
});
