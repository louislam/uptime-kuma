const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");
const dayjs = require("dayjs");
const Cron = require("croner");
const TestDB = require("../mock-testdb");
const { R } = require("redbean-node");
const { SQL_DATETIME_FORMAT } = require("../../src/util");
const { Settings } = require("../../server/settings");

dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("../../server/modules/dayjs/plugin/timezone"));

const testDb = new TestDB("./data/test-maintenance-timeslot");

// Every Tuesday 05:00 - 06:00, in the timezone of the maintenance
const CRON = "0 5 * * 2";
const NAIVE_DATE_TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

describe("Maintenance timeslot dates", () => {
    before(async () => {
        await testDb.create();
    });

    after(async () => {
        Settings.stopCacheCleaner();
        await testDb.destroy();
    });

    /**
     * Create a maintenance and give it the cron job the server would create for it
     * @param {object} fields Fields of the maintenance
     * @returns {Promise<object>} The stored maintenance
     */
    async function createMaintenance(fields) {
        const maintenance = R.dispense("maintenance");
        maintenance.title = "Timeslot test";
        maintenance.description = "";
        maintenance.active = 1;
        maintenance.duration = 3600;
        maintenance.start_time = "05:00:00";
        maintenance.end_time = "06:00:00";
        maintenance.weekdays = "[2]";
        maintenance.days_of_month = "[]";
        Object.assign(maintenance, fields);

        maintenance.id = await R.store(maintenance);

        if (maintenance.cron) {
            maintenance.beanMeta.job = new Cron(maintenance.cron, { timezone: maintenance.timezone });
        }

        return maintenance;
    }

    test("recurring window is a wall clock time in the timezone of the maintenance", async () => {
        for (const timezone of ["UTC", "America/Chicago"]) {
            const maintenance = await createMaintenance({
                strategy: "cron",
                cron: CRON,
                timezone,
            });
            const nextRun = maintenance.beanMeta.job.nextRun();

            const json = await maintenance.toPublicJSON();

            assert.ok(json.timeslotList.length > 0, `${timezone}: no timeslot`);

            for (const timeslot of json.timeslotList) {
                assert.match(timeslot.startDate, NAIVE_DATE_TIME);
                assert.match(timeslot.endDate, NAIVE_DATE_TIME);
                // 05:00 in Chicago is 10:00 UTC, the timeslot still has to be the configured 05:00
                assert.strictEqual(dayjs.tz(timeslot.startDate, timezone).format("HH:mm"), "05:00");
                assert.strictEqual(dayjs.tz(timeslot.endDate, timezone).format("HH:mm"), "06:00");
            }

            // The last timeslot is the next scheduled run, it has to be the instant of the cron job
            const nextTimeslot = json.timeslotList[json.timeslotList.length - 1];
            assert.strictEqual(dayjs.tz(nextTimeslot.startDate, timezone).valueOf(), dayjs(nextRun).valueOf());
            assert.strictEqual(
                dayjs.tz(nextTimeslot.endDate, timezone).valueOf() - dayjs.tz(nextTimeslot.startDate, timezone).valueOf(),
                3600 * 1000
            );
        }
    });

    test("single window keeps the configured wall clock time", async () => {
        const maintenance = await createMaintenance({
            strategy: "single",
            start_date: "2026-10-20T05:00",
            end_date: "2026-10-20T06:00",
            timezone: "Asia/Shanghai",
        });

        const json = await maintenance.toPublicJSON();

        assert.deepStrictEqual(json.timeslotList[0], {
            startDate: "2026-10-20 05:00:00",
            endDate: "2026-10-20 06:00:00",
        });
    });

    test("timeslot dates are shown as configured by the frontend", async () => {
        const maintenance = await createMaintenance({
            strategy: "cron",
            cron: CRON,
            timezone: "America/Chicago",
        });

        const json = await maintenance.toPublicJSON();
        const startDate = json.timeslotList[0].startDate;

        // What src/components/MaintenanceTime.vue does with the startDate
        const displayed = dayjs(startDate).tz(json.timezone, true).format(SQL_DATETIME_FORMAT);

        assert.strictEqual(displayed, startDate);
        assert.strictEqual(displayed.substring(11, 16), "05:00");
    });
});
