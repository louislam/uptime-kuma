const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..", "..");
const { apps } = require(path.join(root, "ecosystem.config.js"));
const packageJson = require(path.join(root, "package.json"));

describe("ecosystem.config.js", () => {
    test("defines one PM2 app for Uptime Kuma in the repository root", () => {
        assert.strictEqual(apps.length, 1);
        assert.strictEqual(apps[0].name, "uptime-kuma");
        assert.strictEqual(apps[0].cwd, root);
    });

    test("runs an existing package.json script through node --run", () => {
        const app = apps[0];
        const runMatch = /^--run (\S+)$/.exec(app.args);

        assert.strictEqual(app.script, "node");
        assert.strictEqual(app.interpreter, "none");
        assert.ok(runMatch, `Unexpected args: ${app.args}`);
        assert.ok(packageJson.scripts[runMatch[1]], `Missing script: ${runMatch[1]}`);
    });

    test("start-server keeps the tsx loader and points at an existing entry", () => {
        const startServer = packageJson.scripts["start-server"];

        assert.match(startServer, /--import=tsx/);
        assert.ok(packageJson.dependencies.tsx);
        assert.ok(fs.existsSync(path.join(root, "server", "server.js")));
    });
});
