const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

describe("General settings credential fields", () => {
    test("does not render Steam or Globalping account token inputs", () => {
        const source = fs.readFileSync(
            path.join(__dirname, "../../src/components/settings/General.vue"),
            "utf8"
        );

        assert.doesNotMatch(source, /for="steamAPIKey"/);
        assert.doesNotMatch(source, /v-model="settings\.steamAPIKey"/);
        assert.doesNotMatch(source, /for="globalpingApiToken"/);
        assert.doesNotMatch(source, /v-model="settings\.globalpingApiToken"/);
    });
});
