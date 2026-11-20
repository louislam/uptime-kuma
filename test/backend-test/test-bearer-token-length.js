const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

describe("Bearer token length (#7808)", () => {
    test("bearer_token column is text (no 255 varchar limit)", () => {
        const migration = fs.readFileSync(
            path.join(__dirname, "../../db/knex_migrations/2026-05-20-0000-add-bearer-token.js"),
            "utf8"
        );
        assert.match(migration, /table\.text\(["']bearer_token["']\)/);
    });

    test("EditMonitor bearer HiddenInput fields override default maxlength of 255", () => {
        const source = fs.readFileSync(path.join(__dirname, "../../src/pages/EditMonitor.vue"), "utf8");
        const bearerInputIds = ["bearer-token", "ws-bearer-token", "bearer-token-globalping"];

        for (const id of bearerInputIds) {
            const marker = `id="${id}"`;
            const start = source.indexOf(marker);
            assert.ok(start !== -1, `expected HiddenInput id=${id}`);

            const tagStart = source.lastIndexOf("<HiddenInput", start);
            const tagEnd = source.indexOf("/>", start);
            assert.ok(tagStart !== -1 && tagEnd !== -1 && tagStart < start && start < tagEnd);

            const tag = source.slice(tagStart, tagEnd + 2);
            const match = tag.match(/:maxlength="(\d+)"/);
            assert.ok(match, `expected :maxlength on HiddenInput id=${id}`);
            assert.ok(Number(match[1]) > 255, `maxlength for ${id} should exceed HiddenInput default of 255`);
        }
    });
});
