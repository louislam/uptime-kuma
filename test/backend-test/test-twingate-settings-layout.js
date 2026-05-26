const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const readSource = (relativePath) => fs.readFileSync(path.join(__dirname, "../..", relativePath), "utf8");

describe("Twingate settings layout", () => {
    test("keeps settings navigation from being clipped by horizontal page overflow", () => {
        const settingsSource = readSource("src/pages/Settings.vue");

        assert.match(settingsSource, /class="settings-page"/);
        assert.match(settingsSource, /\.settings-page\s*\{[\s\S]*overflow-x:\s*clip;/);
        assert.match(settingsSource, /\.settings-content\s*\{[\s\S]*min-width:\s*0;/);
    });

    test("bounds Twingate startup log columns inside the settings content area", () => {
        const twingateSource = readSource("src/components/settings/Twingate.vue");

        assert.match(twingateSource, /\.twingate-log-panel\s*\{[^}]*max-width:\s*100%;/);
        assert.match(twingateSource, /\.twingate-log-panel\s*\{[^}]*min-width:\s*0;/);
        assert.match(twingateSource, /\.twingate-log-toolbar\s*\{[^}]*min-width:\s*0;/);
        assert.match(twingateSource, /\.twingate-log-style-picker\s*\{[^}]*flex-wrap:\s*wrap;/);
        assert.match(twingateSource, /grid-template-columns:\s*3rem 4\.5rem minmax\(0,\s*17rem\) minmax\(0,\s*1fr\);/);
        assert.doesNotMatch(twingateSource, /grid-template-columns:[^;]*max-content/);
    });

    test("offers five distinct Twingate startup log view styles", () => {
        const twingateSource = readSource("src/components/settings/Twingate.vue");

        for (const style of ["console", "timeline", "inspector", "cards", "compact"]) {
            assert.match(twingateSource, new RegExp(`id:\\s*"${style}"`));
            assert.match(twingateSource, new RegExp(`is-style-${style}`));
        }
    });
});
