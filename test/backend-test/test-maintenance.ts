import { describe, test } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";
import dayjs from "dayjs";

const require = createRequire(import.meta.url);

const Maintenance = require("../../server/model/maintenance");
const Monitor = require("../../server/model/monitor");
const { UptimeKumaServer } = require("../../server/uptime-kuma-server");
const { R } = require("redbean-node");

/**
 * Build a Maintenance instance without touching the database
 * @param {object} fields Maintenance fields
 * @returns {object} Maintenance instance
 */
function maintenanceWith(fields) {
    return Object.assign(Object.create(Maintenance.prototype), fields);
}

describe("Monitor.isUnderMaintenance()", () => {
    /**
     * Snapshot of two monitors, 2 inside group 1, plus one maintenance on the group
     * @param {boolean} active Is the group's maintenance running
     * @returns {object} Snapshot for the list build
     */
    function snapshot(active) {
        return {
            links: new Map([
                [1, [10]],
                [2, []],
            ]),
            active: new Map([[10, active]]),
            parents: new Map([
                [1, null],
                [2, 1],
            ]),
            cache: new Map(),
        };
    }

    test("applies the group's maintenance to its children", async () => {
        const state = snapshot(true);

        assert.strictEqual(await Monitor.isUnderMaintenance(1, state), true);
        assert.strictEqual(await Monitor.isUnderMaintenance(2, state), true);
    });

    test("returns false for a monitor outside any running maintenance", async () => {
        const state = snapshot(false);

        assert.strictEqual(await Monitor.isUnderMaintenance(1, state), false);
        assert.strictEqual(await Monitor.isUnderMaintenance(2, state), false);
    });

    test("memoizes the answers of one list build", async () => {
        const state = snapshot(true);

        await Monitor.isUnderMaintenance(2, state);
        await Monitor.isUnderMaintenance(2, state);

        assert.strictEqual(state.cache.get(1), true);
        assert.strictEqual(state.cache.get(2), true);
    });
});

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

describe("Maintenance.run() recurring-interval", () => {
    const RealDate = Date;
    let fakeNow = 0;

    /**
     * Freeze Date at the given instant; dayjs() reads new Date()/Date.now()
     * @param {string} iso Instant to freeze at
     */
    function useFakeTime(iso) {
        fakeNow = dayjs(iso).valueOf();
        class FakeDate extends RealDate {
            /**
             * A Date that is frozen at fakeNow unless arguments are given
             * @param {...*} args Date constructor arguments
             */
            constructor(...args) {
                super(...(args.length > 0 ? args : [fakeNow]));
            }
            /**
             * The frozen current time
             * @returns {number} Milliseconds since epoch
             */
            static now() {
                return fakeNow;
            }
        }
        global.Date = FakeDate;
    }

    /**
     * Move the frozen clock forward
     * @param {string} iso Instant to advance to
     */
    function advanceTo(iso) {
        fakeNow = dayjs(iso).valueOf();
    }

    /**
     * Maintenance instance that emulates redbean-node's casing-insensitive
     * field mapping (last_start_date and lastStartDate are the same column)
     * @param {object} fields Maintenance fields
     * @returns {object} Maintenance instance
     */
    function beanWith(fields) {
        const target = maintenanceWith({ beanMeta: {}, ...fields });
        return new Proxy(target, {
            get(t, key) {
                if (typeof key === "string" && !(key in t)) {
                    const alt = key.includes("_")
                        ? key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
                        : key.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());
                    if (alt in t) {
                        return t[alt];
                    }
                }
                return t[key];
            },
        });
    }

    test("fires again once the interval has passed, without a restart or edit", async () => {
        UptimeKumaServer.instance = { sendMaintenanceListToDashboard: () => {} };
        const originalStore = R.store;
        R.store = async () => ({});

        const maintenance = beanWith({
            id: 1,
            strategy: "recurring-interval",
            cron: "0 1 * * *",
            interval_day: 2,
            startDate: "2026-01-01",
            startTime: "01:00",
            start_time: "01:00",
            end_time: "01:30",
            duration: 1800,
            timezone: "UTC",
            active: true,
        });

        useFakeTime("2026-01-02T01:00:00.000Z");
        try {
            await maintenance.run();
            const job = maintenance.beanMeta.job;
            assert.ok(job, "a cron job was scheduled");

            // First daily tick after (re)start: no last start date yet
            await job.trigger();
            assert.strictEqual(maintenance.last_start_date, "2026-01-02 01:00:00");

            // Two days later, same process: the next daily tick must fire again
            advanceTo("2026-01-04T01:00:00.000Z");
            await job.trigger();
            assert.strictEqual(maintenance.last_start_date, "2026-01-04 01:00:00");
        } finally {
            clearTimeout(maintenance.beanMeta.durationTimeout);
            maintenance.stop();
            R.store = originalStore;
            UptimeKumaServer.instance = null;
            global.Date = RealDate;
        }
    });
});
