const { describe, test } = require("node:test");
const assert = require("node:assert");
const Maintenance = require("../../server/model/maintenance");

describe("Maintenance model", () => {
    describe("jsonToBean()", () => {
        test("accepts valid single maintenance date range", async () => {
            const bean = {};
            const payload = {
                title: "Planned upgrade",
                description: "Rolling deployment window",
                strategy: "single",
                intervalDay: 1,
                timezoneOption: "UTC",
                active: 1,
                dateRange: ["2026-02-24T01:00", "2026-02-24T02:00"],
                timeRange: [],
                weekdays: [],
                daysOfMonth: [],
            };

            await assert.doesNotReject(async () => {
                await Maintenance.jsonToBean(bean, payload);
            });

            assert.strictEqual(bean.start_date, "2026-02-24T01:00");
            assert.strictEqual(bean.end_date, "2026-02-24T02:00");
            assert.strictEqual(bean.strategy, "single");
        });

        test("rejects when end date predates start date", async () => {
            const bean = {};
            const payload = {
                title: "Invalid range",
                description: "",
                strategy: "single",
                intervalDay: 1,
                timezoneOption: "UTC",
                active: 1,
                dateRange: ["2026-02-24T03:00", "2026-02-24T02:00"],
                timeRange: [],
                weekdays: [],
                daysOfMonth: [],
            };

            await assert.rejects(async () => {
                await Maintenance.jsonToBean(bean, payload);
            }, /End date must be after start date/);
        });

        test("rejects invalid start date format", async () => {
            const bean = {};
            const payload = {
                title: "Bad date",
                description: "",
                strategy: "single",
                intervalDay: 1,
                timezoneOption: "UTC",
                active: 1,
                dateRange: ["not-a-date", "2026-02-24T02:00"],
                timeRange: [],
                weekdays: [],
                daysOfMonth: [],
            };

            await assert.rejects(async () => {
                await Maintenance.jsonToBean(bean, payload);
            }, /Invalid start date/);
        });
    });
});
