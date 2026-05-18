const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

describe("Worker Tags settings UI", () => {
    test("exposes the Tags settings page in Worker UI mode", () => {
        const settingsSource = fs.readFileSync(
            path.join(__dirname, "../../src/pages/Settings.vue"),
            "utf8"
        );

        assert.match(
            settingsSource,
            /"tags"/,
            "tags should be listed as a supported Worker settings page"
        );
    });

    test("maps tag socket events to Worker REST endpoints", () => {
        const socketSource = fs.readFileSync(
            path.join(__dirname, "../../src/mixins/socket.js"),
            "utf8"
        );

        assert.match(socketSource, /event === "getTags"/);
        assert.match(socketSource, /event === "addTag"/);
        assert.match(socketSource, /event === "editTag"/);
        assert.match(socketSource, /event === "deleteTag"/);
        assert.match(socketSource, /\/api\/tags/);
    });
});
