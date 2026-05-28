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
        assert.match(twingateSource, /\.twingate-log-actions\s*\{[^}]*flex-wrap:\s*wrap;/);
        assert.match(twingateSource, /grid-template-columns:\s*2\.25rem 3\.5rem minmax\(0,\s*1fr\);/);
        assert.doesNotMatch(twingateSource, /grid-template-columns:[^;]*max-content/);
    });

    test("uses compact Twingate startup log view without style choices", () => {
        const twingateSource = readSource("src/components/settings/Twingate.vue");
        const languageSource = readSource("src/lang/en.json");

        assert.match(twingateSource, /\.twingate-log-time\s*\{[^}]*display:\s*none;/);
        assert.doesNotMatch(twingateSource, /twingate-log-style-picker/);
        assert.doesNotMatch(twingateSource, /selectedLogStyle|logStyleOptions|is-style-/);
        assert.doesNotMatch(languageSource, /twingateLogStyle/);
    });

    test("exposes Twingate startup alert settings with notification selection", () => {
        const twingateSource = readSource("src/components/settings/Twingate.vue");
        const languageSource = readSource("src/lang/en.json");

        assert.match(twingateSource, /v-model="settings\.twingateAlertEnabled"/);
        assert.match(twingateSource, /v-model="settings\.twingateAlertThresholdMinutes"/);
        assert.match(twingateSource, /v-model="settings\.twingateAlertNotificationIDList\[notification\.id\]"/);
        assert.match(twingateSource, /\$root\.notificationList/);
        assert.match(twingateSource, /NotificationDialog/);
        assert.match(twingateSource, /@click="saveSettings\(\)"/);
        assert.match(languageSource, /twingateAlertEnabled/);
        assert.match(languageSource, /twingateAlertThresholdMinutes/);
    });
});
