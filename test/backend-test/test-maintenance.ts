import { describe, test } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";
import dayjs from "dayjs";

const require = createRequire(import.meta.url);
dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("dayjs/plugin/customParseFormat"));
dayjs.extend(require("../../server/modules/dayjs/plugin/timezone"));

const Maintenance = require("../../server/model/maintenance");

/**
 * Build a Maintenance instance without touching the database
 * @param {object} fields Maintenance fields
 * @returns {object} Maintenance instance
 */
function maintenanceWith(fields) {
    return Object.assign(Object.create(Maintenance.prototype), fields);
}

describe("Maintenance", () => {
    describe("getDayOfWeekList()", () => {
        test("parses the stored JSON and sorts the days", () => {
            assert.deepStrictEqual(maintenanceWith({ weekdays: "[3,1,2]" }).getDayOfWeekList(), [1, 2, 3]);
        });

        test("returns an empty list when no weekday is selected", () => {
            assert.deepStrictEqual(maintenanceWith({ weekdays: "[]" }).getDayOfWeekList(), []);
        });
    });

    describe("getDayOfMonthList()", () => {
        test("parses the stored JSON and sorts numerically", () => {
            assert.deepStrictEqual(maintenanceWith({ days_of_month: "[10,2]" }).getDayOfMonthList(), [2, 10]);
        });
    });

    describe("calcDuration()", () => {
        test("returns the duration between start and end on the same day", () => {
            assert.strictEqual(maintenanceWith({ start_time: "10:00", end_time: "12:30" }).calcDuration(), 2.5 * 3600);
        });

        test("adds 24 hours when the window crosses midnight", () => {
            assert.strictEqual(maintenanceWith({ start_time: "23:00", end_time: "01:00" }).calcDuration(), 2 * 3600);
        });
    });

    describe("inferDuration()", () => {
        test("returns a positive custom duration as is", () => {
            assert.strictEqual(maintenanceWith({ duration: 60 }).inferDuration(5000), 5000);
        });

        test("falls back to the configured duration", () => {
            assert.strictEqual(maintenanceWith({ duration: 60, end_date: null }).inferDuration(0), 60000);
        });
    });

    describe("inferDuration() with an end date", () => {
        test("uses the remaining time when it is shorter than the configured duration", () => {
            const endDate = dayjs().add(30, "second").toISOString();
            const duration = maintenanceWith({ duration: 60, end_date: endDate }).inferDuration(0);

            assert.ok(duration > 20000 && duration <= 31000, String(duration));
        });
    });

    describe("getStatus()", () => {
        test("returns inactive when the maintenance is disabled", async () => {
            assert.strictEqual(await maintenanceWith({ active: false }).getStatus(), "inactive");
        });

        test("returns under-maintenance for a manual strategy", async () => {
            assert.strictEqual(
                await maintenanceWith({ active: true, strategy: "manual" }).getStatus(),
                "under-maintenance"
            );
        });

        test("returns scheduled when the start date is in the future", async () => {
            const maintenance = maintenanceWith({
                active: true,
                strategy: "single",
                timezone: "Asia/Hong_Kong",
                start_date: dayjs().add(1, "day").toISOString(),
            });

            assert.strictEqual(await maintenance.getStatus(), "scheduled");
        });

        test("returns ended when the end date is in the past", async () => {
            const maintenance = maintenanceWith({
                active: true,
                strategy: "single",
                timezone: "Asia/Hong_Kong",
                end_date: dayjs().subtract(1, "day").toISOString(),
            });

            assert.strictEqual(await maintenance.getStatus(), "ended");
        });

        test("returns under-maintenance for a running single strategy", async () => {
            const maintenance = maintenanceWith({
                active: true,
                strategy: "single",
                timezone: "Asia/Hong_Kong",
            });

            assert.strictEqual(await maintenance.getStatus(), "under-maintenance");
        });

        test("returns unknown when the bean has no status", async () => {
            const maintenance = maintenanceWith({
                active: true,
                strategy: "recurring",
                timezone: "Asia/Hong_Kong",
                beanMeta: {},
            });

            assert.strictEqual(await maintenance.getStatus(), "unknown");
        });
    });

    describe("getTimezone()", () => {
        test("returns the configured timezone", async () => {
            assert.strictEqual(await maintenanceWith({ timezone: "Asia/Hong_Kong" }).getTimezone(), "Asia/Hong_Kong");
        });
    });

    describe("getTimezoneOffset()", () => {
        test("formats the offset of the configured timezone", async () => {
            assert.strictEqual(await maintenanceWith({ timezone: "Asia/Hong_Kong" }).getTimezoneOffset(), "+08:00");
        });
    });

    describe("getRunningTimeslot()", () => {
        test("returns the slot when now is inside the running window", () => {
            const job = { nextRun: () => dayjs().subtract(30, "second").toDate() };
            const maintenance = maintenanceWith({ duration: 60, beanMeta: { job } });

            const slot = maintenance.getRunningTimeslot();

            assert.ok(slot);
            assert.ok(dayjs(slot.startDate).isBefore(dayjs(slot.endDate)));
        });

        test("returns null when now is outside the running window", () => {
            const job = { nextRun: () => dayjs().subtract(120, "second").toDate() };
            const maintenance = maintenanceWith({ duration: 60, beanMeta: { job } });

            assert.strictEqual(maintenance.getRunningTimeslot(), null);
        });
    });

    describe("validateCron()", () => {
        test("accepts a valid cron expression", () => {
            assert.doesNotThrow(() => Maintenance.validateCron("*/5 * * * *"));
        });

        test("rejects an invalid cron expression", () => {
            assert.throws(() => Maintenance.validateCron("not a cron"));
        });
    });
});
