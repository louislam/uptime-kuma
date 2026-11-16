import { describe, test } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Incident = require("../../server/model/incident");

/**
 * Build an Incident instance without touching the database
 * @param {object} fields Bean fields
 * @returns {object} Incident instance
 */
function incidentWith(fields) {
    return Object.assign(Object.create(Incident.prototype), fields);
}

describe("Incident", () => {
    describe("toPublicJSON()", () => {
        test("maps bean fields to the public payload", () => {
            const incident = incidentWith({
                id: 7,
                style: "warning",
                title: "Degraded",
                content: "Investigating",
                pin: 1,
                active: 1,
                created_date: "2026-01-01 00:00:00",
                last_updated_date: "2026-01-01 01:00:00",
                status_page_id: 3,
            });

            assert.deepStrictEqual(incident.toPublicJSON(), {
                id: 7,
                style: "warning",
                title: "Degraded",
                content: "Investigating",
                pin: true,
                active: true,
                createdDate: "2026-01-01 00:00:00",
                lastUpdatedDate: "2026-01-01 01:00:00",
                status_page_id: 3,
            });
        });

        test("coerces numeric zero to false for pin and active", () => {
            const incident = incidentWith({ id: 1, pin: 0, active: 0 });

            const json = incident.toPublicJSON();

            assert.strictEqual(json.pin, false);
            assert.strictEqual(json.active, false);
        });

        test("coerces null pin and active to false", () => {
            const incident = incidentWith({ id: 1, pin: null, active: null });

            const json = incident.toPublicJSON();

            assert.strictEqual(json.pin, false);
            assert.strictEqual(json.active, false);
        });
    });
});
