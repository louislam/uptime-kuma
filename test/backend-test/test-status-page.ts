import { describe, test } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const StatusPage = require("../../server/model/status_page");
const {
    UP,
    DOWN,
    PENDING,
    MAINTENANCE,
    STATUS_PAGE_ALL_UP,
    STATUS_PAGE_PARTIAL_DOWN,
    STATUS_PAGE_ALL_DOWN,
    STATUS_PAGE_MAINTENANCE,
} = require("../../src/util");

/**
 * Build a StatusPage instance without touching the database
 * @param {object} fields Status page fields
 * @returns {object} StatusPage instance
 */
function statusPageWith(fields) {
    return Object.assign(Object.create(StatusPage.prototype), fields);
}

describe("StatusPage", () => {
    describe("overallStatus()", () => {
        test("returns -1 when there are no services", () => {
            assert.strictEqual(StatusPage.overallStatus([]), -1);
        });

        test("returns all up when every service is up", () => {
            assert.strictEqual(StatusPage.overallStatus([{ status: UP }, { status: UP }]), STATUS_PAGE_ALL_UP);
        });

        test("returns partial down when at least one service is down", () => {
            assert.strictEqual(StatusPage.overallStatus([{ status: UP }, { status: DOWN }]), STATUS_PAGE_PARTIAL_DOWN);
        });

        test("returns all down when no service is up", () => {
            assert.strictEqual(StatusPage.overallStatus([{ status: DOWN }, { status: PENDING }]), STATUS_PAGE_ALL_DOWN);
        });

        test("returns maintenance when any service is under maintenance", () => {
            assert.strictEqual(
                StatusPage.overallStatus([{ status: UP }, { status: MAINTENANCE }]),
                STATUS_PAGE_MAINTENANCE
            );
        });
    });

    describe("getStatusDescription()", () => {
        test("describes every overall status", () => {
            assert.strictEqual(StatusPage.getStatusDescription(-1), "No Services");
            assert.strictEqual(StatusPage.getStatusDescription(STATUS_PAGE_ALL_UP), "All Systems Operational");
            assert.strictEqual(StatusPage.getStatusDescription(STATUS_PAGE_PARTIAL_DOWN), "Partially Degraded Service");
            assert.strictEqual(StatusPage.getStatusDescription(STATUS_PAGE_ALL_DOWN), "Degraded Service");
            assert.strictEqual(StatusPage.getStatusDescription(MAINTENANCE), "Under maintenance");
        });

        test("returns a placeholder for an unknown status", () => {
            assert.strictEqual(StatusPage.getStatusDescription(99), "?");
        });
    });

    describe("getIcon()", () => {
        test("falls back to the default icon", () => {
            assert.strictEqual(statusPageWith({ icon: null }).getIcon(), "/icon.svg");
        });

        test("returns the configured icon", () => {
            assert.strictEqual(statusPageWith({ icon: "/icon-custom.svg" }).getIcon(), "/icon-custom.svg");
        });
    });
});
