const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Read a source file from the repository.
 * @param {string} relativePath Relative path from repository root.
 * @returns {string} Source.
 */
function readSource(relativePath) {
    return fs.readFileSync(path.join(__dirname, "../..", relativePath), "utf8");
}

describe("Details event log UI", () => {
    test("keeps event messages on one line with an expandable full message on event tables", () => {
        const detailsSource = readSource("src/pages/Details.vue");
        const dashboardSource = readSource("src/pages/DashboardHome.vue");
        const eventMessageSource = readSource("src/components/EventMessage.vue");

        for (const source of [detailsSource, dashboardSource]) {
            assert.match(source, /import EventMessage from "\.\.\/components\/EventMessage\.vue";/);
            assert.match(source, /important-events-table/);
            assert.match(source, /class="border-0 event-message-cell"/);
            assert.match(source, /<EventMessage :message="beat\.msg" \/>/);
            assert.match(source, /\.important-events-table\s*\{[\s\S]*?table-layout:\s*fixed;/);
            assert.match(source, /\.event-message-cell\s*\{[\s\S]*?max-width:\s*0;/);
        }

        assert.match(eventMessageSource, /<details\s+v-if="displayMessage"\s+class="event-message-disclosure">/);
        assert.match(eventMessageSource, /<summary\s+class="event-message-summary"\s+:title="displayMessage">/);
        assert.match(eventMessageSource, /class="event-message-summary-text"/);
        assert.match(eventMessageSource, /class="event-message-full"/);
        assert.match(eventMessageSource, /\.event-message-summary-text\s*\{[\s\S]*?white-space:\s*nowrap;/);
        assert.match(eventMessageSource, /\.event-message-summary-text\s*\{[\s\S]*?text-overflow:\s*ellipsis;/);
        assert.match(eventMessageSource, /\.event-message-full\s*\{[\s\S]*?white-space:\s*pre-wrap;/);
        assert.match(eventMessageSource, /\.event-message-full\s*\{[\s\S]*?overflow:\s*auto;/);
    });
});
