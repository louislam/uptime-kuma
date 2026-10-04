const { describe, test } = require("node:test");
const assert = require("node:assert");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");

dayjs.extend(utc);
dayjs.extend(timezone);

const { SQL_DATETIME_FORMAT } = require("../../src/util");

/**
 * Regression test for issue #7895:
 * Recurring maintenance timeslot dates must be naive strings in the maintenance timezone,
 * not UTC ISO strings — so the frontend .tz(tz, true) call displays the correct local time.
 */
describe("Maintenance timeslot format", () => {
    test("recurring timeslot startDate must be a naive SQL datetime string in the maintenance timezone", () => {
        // Simulate what toPublicJSON() now does for a recurring window
        const tz = "America/Chicago"; // UTC-5 in winter
        // nextRun() returns a Date object representing UTC 10:00 (= 05:00 Chicago)
        const nextRunUTC = new Date("2026-09-22T10:00:00.000Z");

        const startDateDayjs = dayjs(nextRunUTC).tz(tz);
        const startDate = startDateDayjs.format(SQL_DATETIME_FORMAT);

        // Must be a naive string with no Z or T — in the maintenance timezone
        assert.match(startDate, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
            "startDate should be a naive SQL datetime string (YYYY-MM-DD HH:mm:ss)");

        // Must represent 05:00 Chicago, not 10:00 UTC
        assert.strictEqual(startDate, "2026-09-22 05:00:00",
            "startDate must be in the maintenance timezone, not UTC");

        // Simulate the frontend: dayjs(startDate).tz(tz, true) should display 05:00
        const displayed = dayjs(startDate).tz(tz, true).format("YYYY-MM-DD HH:mm");
        assert.strictEqual(displayed, "2026-09-22 05:00",
            "Frontend .tz(tz, true) must show the correct time in the configured timezone");
    });

    test("UTC timezone recurring window shows correct time", () => {
        const tz = "UTC";
        const nextRunUTC = new Date("2026-09-22T05:00:00.000Z");

        const startDate = dayjs(nextRunUTC).tz(tz).format(SQL_DATETIME_FORMAT);

        assert.strictEqual(startDate, "2026-09-22 05:00:00");
        const displayed = dayjs(startDate).tz(tz, true).format("YYYY-MM-DD HH:mm");
        assert.strictEqual(displayed, "2026-09-22 05:00");
    });
});
