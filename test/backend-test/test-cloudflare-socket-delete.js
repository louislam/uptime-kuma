const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

describe("Cloudflare Worker socket delete shim", () => {
    test("normalizes successful REST delete responses for Socket.IO callers", () => {
        const source = fs.readFileSync(
            path.join(__dirname, "../../src/mixins/socket.js"),
            "utf8"
        );

        const deleteBlockMatch = source.match(/if \(event === "deleteMonitor"\) \{[\s\S]*?return;\n\s+\}/);
        assert.ok(deleteBlockMatch, "deleteMonitor handler should exist in the Worker socket shim");

        const deleteBlock = deleteBlockMatch[0];

        assert.match(deleteBlock, /method:\s*"DELETE"/, "deleteMonitor should still call the REST DELETE endpoint");
        assert.match(
            deleteBlock,
            /callback\?\.\(\{\s*ok:\s*true,\s*msg:\s*"Deleted",\s*\.\.\.body\s*\}\)/,
            "successful REST delete responses must be normalized to Socket.IO's ok:true response shape"
        );
    });
});
