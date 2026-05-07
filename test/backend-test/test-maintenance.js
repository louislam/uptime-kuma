process.env.UPTIME_KUMA_HIDE_LOG = ["info_db", "info_server", "info_maintenance", "debug_maintenance"].join(",");

const { describe, test, before, after } = require("node:test");
const assert = require("node:assert");

// Maintenance.toPublicJSON / getStatus rely on `dayjs.tz()` and `customParseFormat`
// (see server/server.js where these are registered at boot). The test harness
// doesn't go through server.js, so we register them explicitly here.
const dayjs = require("dayjs");
dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("../../server/modules/dayjs/plugin/timezone"));
dayjs.extend(require("dayjs/plugin/customParseFormat"));

const Maintenance = require("../../server/model/maintenance");
const TestDB = require("../mock-testdb");
const { Settings } = require("../../server/settings");
const { getKnex } = require("../../server/db");

const testDb = new TestDB("./data/test-maintenance");

/**
 * Build a base maintenance row payload with required snake_case columns.
 * Tweak per-strategy in caller.
 * @param {object} overrides Per-test overrides
 * @returns {object} Maintenance row ready for `Maintenance.query().insert(...)`
 */
function baseMaintenancePayload(overrides = {}) {
    return {
        title: "test-maintenance",
        description: "round-trip test",
        active: true,
        strategy: "manual",
        start_date: null,
        end_date: null,
        start_time: null,
        end_time: null,
        weekdays: "[]",
        days_of_month: "[]",
        interval_day: null,
        timezone: "UTC",
        cron: null,
        duration: null,
        ...overrides,
    };
}

describe("Maintenance model", () => {
    before(async () => {
        await testDb.create();
    });

    after(async () => {
        Settings.stopCacheCleaner();
        await testDb.destroy();
    });

    describe("Construction", () => {
        test("`new Maintenance()` initialises beanMeta to an empty object (not undefined)", () => {
            const bean = new Maintenance();
            assert.notStrictEqual(bean.beanMeta, undefined, "beanMeta should be defined");
            assert.deepStrictEqual(bean.beanMeta, {}, "beanMeta should default to {}");
            // Critical: this is the BLOCKER. If beanMeta is undefined,
            // any access (e.g. `this.beanMeta.job` in toPublicJSON / run) throws.
            assert.doesNotThrow(() => {
                // eslint-disable-next-line no-unused-expressions
                bean.beanMeta.job;
            }, "reading beanMeta.job must not throw on a fresh instance");
        });
    });

    describe("Persistence", () => {
        test("$formatDatabaseJson strips beanMeta and bean_meta from the persisted row", () => {
            const bean = new Maintenance();
            bean.title = "x";
            bean.description = "y";
            bean.strategy = "manual";
            bean.beanMeta = { job: { fake: true } };

            const dbJson = bean.$toDatabaseJson();
            assert.ok(
                !("beanMeta" in dbJson),
                `beanMeta must not be in $toDatabaseJson output (got ${JSON.stringify(dbJson)})`
            );
            assert.ok(
                !("bean_meta" in dbJson),
                `bean_meta must not be in $toDatabaseJson output (got ${JSON.stringify(dbJson)})`
            );
            assert.strictEqual(dbJson.title, "x");
            assert.strictEqual(dbJson.description, "y");
            assert.strictEqual(dbJson.strategy, "manual");
        });

        test("$formatDatabaseJson strips beanMeta even when only the camelCase form is set", () => {
            const bean = new Maintenance();
            bean.title = "x";
            bean.description = "y";
            bean.strategy = "manual";
            bean.bean_meta = "should-not-persist";

            const dbJson = bean.$toDatabaseJson();
            assert.ok(!("beanMeta" in dbJson));
            assert.ok(!("bean_meta" in dbJson));
        });
    });

    describe("Round-trip per strategy", () => {
        const strategies = [
            {
                label: "manual",
                payload: baseMaintenancePayload({
                    title: "manual-strategy",
                    strategy: "manual",
                }),
            },
            {
                label: "single",
                payload: baseMaintenancePayload({
                    title: "single-strategy",
                    strategy: "single",
                    start_date: "2099-01-01 00:00:00",
                    end_date: "2099-01-02 00:00:00",
                }),
            },
            {
                label: "recurring-interval",
                payload: baseMaintenancePayload({
                    title: "recurring-interval-strategy",
                    strategy: "recurring-interval",
                    start_date: "2099-01-01 00:00:00",
                    end_date: "2099-12-31 00:00:00",
                    start_time: "09:00",
                    end_time: "10:00",
                    interval_day: 1,
                    cron: "0 9 * * *",
                    duration: 3600,
                    weekdays: "[]",
                    days_of_month: "[]",
                }),
            },
        ];

        for (const { label, payload } of strategies) {
            test(`Insert + findById round-trip preserves snake_case columns and rehydrates beanMeta = {} for strategy '${label}'`, async () => {
                const inserted = await Maintenance.query().insert(payload);
                assert.ok(inserted.id > 0, "insert returned an id");

                const loaded = await Maintenance.query().findById(inserted.id);
                assert.ok(loaded, "row reloaded by id");
                assert.strictEqual(loaded.title, payload.title);
                assert.strictEqual(loaded.strategy, payload.strategy);

                // beanMeta should be a fresh empty object after rehydration; this is
                // the field the original BLOCKER crashed on.
                assert.deepStrictEqual(
                    loaded.beanMeta,
                    {},
                    `loaded ${label} maintenance must have beanMeta === {} (not undefined)`
                );

                // Snake-case columns survived the round-trip.
                if (payload.start_date) {
                    assert.ok(loaded.start_date, "start_date column round-tripped");
                }
                if (payload.end_date) {
                    assert.ok(loaded.end_date, "end_date column round-tripped");
                }
                if (payload.cron) {
                    assert.strictEqual(loaded.cron, payload.cron);
                }

                // Sanity: nothing called "beanMeta" or "bean_meta" should land in the row.
                const knex = getKnex();
                const raw = await knex("maintenance").where("id", inserted.id).first();
                assert.ok(raw, "raw row exists in DB");
                assert.ok(!("beanMeta" in raw), "raw row has no beanMeta column");
                assert.ok(!("bean_meta" in raw), "raw row has no bean_meta column");
            });
        }
    });

    describe("toPublicJSON", () => {
        test("returns expected timeslotList for 'single' strategy without throwing", async () => {
            const inserted = await Maintenance.query().insert(
                baseMaintenancePayload({
                    title: "single-public-json",
                    strategy: "single",
                    start_date: "2099-06-01 12:00:00",
                    end_date: "2099-06-01 13:00:00",
                })
            );
            const loaded = await Maintenance.query().findById(inserted.id);

            // Sanity: beanMeta must exist or toPublicJSON's `if (this.beanMeta.job)`
            // branch in the recurring case will throw.
            assert.deepStrictEqual(loaded.beanMeta, {});

            const json = await loaded.toPublicJSON();
            assert.strictEqual(json.strategy, "single");
            assert.strictEqual(Array.isArray(json.timeslotList), true);
            assert.strictEqual(json.timeslotList.length, 1);
            assert.ok(json.timeslotList[0].startDate, "timeslot has startDate");
            assert.ok(json.timeslotList[0].endDate, "timeslot has endDate");
        });

        test("recurring-interval toPublicJSON exercises the `if (this.beanMeta.job)` branch and yields a timeslot from job.nextRun()", async () => {
            const inserted = await Maintenance.query().insert(
                baseMaintenancePayload({
                    title: "recurring-public-json",
                    strategy: "recurring-interval",
                    start_date: "2099-01-01 00:00:00",
                    end_date: "2099-12-31 00:00:00",
                    start_time: "09:00",
                    end_time: "10:00",
                    interval_day: 1,
                    cron: "0 9 * * *",
                    duration: 3600,
                })
            );
            const loaded = await Maintenance.query().findById(inserted.id);

            // Inject a fake Cron-like job so the branch is hit but no real cron registers.
            const futureDate = new Date(Date.now() + 60 * 60 * 1000);
            loaded.beanMeta.job = {
                nextRun: () => futureDate,
            };

            const json = await loaded.toPublicJSON();
            assert.strictEqual(json.strategy, "recurring-interval");
            assert.strictEqual(Array.isArray(json.timeslotList), true);
            // getRunningTimeslot returns null because nextRun is in the future,
            // so we expect exactly one entry: the upcoming timeslot derived from job.nextRun().
            assert.ok(
                json.timeslotList.length >= 1,
                `expected at least one timeslot for recurring strategy with stub job, got ${JSON.stringify(json.timeslotList)}`
            );
            const last = json.timeslotList[json.timeslotList.length - 1];
            assert.ok(last.startDate, "computed timeslot has startDate");
            assert.ok(last.endDate, "computed timeslot has endDate");
        });

        test("manual strategy produces empty timeslotList without throwing", async () => {
            const inserted = await Maintenance.query().insert(
                baseMaintenancePayload({
                    title: "manual-public-json",
                    strategy: "manual",
                })
            );
            const loaded = await Maintenance.query().findById(inserted.id);
            const json = await loaded.toPublicJSON();
            assert.strictEqual(json.strategy, "manual");
            assert.deepStrictEqual(json.timeslotList, []);
        });
    });
});
