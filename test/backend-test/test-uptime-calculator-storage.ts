import { afterEach, describe, test } from "node:test";
import assert from "node:assert";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { UptimeCalculator } = require("../../server/uptime-calculator");
const { R } = require("redbean-node");
const dayjs = require("dayjs");
const { UP } = require("../../src/util");
dayjs.extend(require("dayjs/plugin/utc"));

const originals = {
    getAll: R.getAll,
    findOne: R.findOne,
    exec: R.exec,
    knex: R.knex,
    testBackend: process.env.TEST_BACKEND,
};

afterEach(() => {
    R.getAll = originals.getAll;
    R.findOne = originals.findOne;
    R.exec = originals.exec;
    // knex is a getter on the prototype; drop the own override to restore it
    delete R.knex;
    if (originals.testBackend === undefined) {
        delete process.env.TEST_BACKEND;
    } else {
        process.env.TEST_BACKEND = originals.testBackend;
    }
    UptimeCalculator.currentDate = undefined;
});

/**
 * Create a calculator for a monitor without a database
 * @param {number} monitorID Monitor id
 * @returns {UptimeCalculator} Calculator
 */
function calculator(monitorID = 7) {
    const calc = new UptimeCalculator();
    calc.monitorID = monitorID;
    return calc;
}

describe("UptimeCalculator.loadHistory()", () => {
    test("loads minutely buckets with their extras", async () => {
        R.getAll = async (sql) => {
            if (sql.includes("stat_minutely")) {
                return [
                    {
                        timestamp: 1700000000,
                        up: 2,
                        down: 1,
                        ping: 10,
                        ping_min: 5,
                        ping_max: 20,
                        extras: '{"custom":1}',
                    },
                ];
            }
            return [];
        };

        const calc = calculator();
        await calc.loadHistory();

        assert.strictEqual(calc.historyLoaded, true);
        assert.deepStrictEqual(calc.minutelyUptimeDataList[1700000000], {
            up: 2,
            down: 1,
            avgPing: 10,
            minPing: 5,
            maxPing: 20,
            custom: 1,
        });
    });

    test("queries each stat table once", async () => {
        const tables = [];
        R.getAll = async (sql) => {
            tables.push(sql.includes("stat_minutely") ? "minutely" : sql.includes("stat_hourly") ? "hourly" : "daily");
            return [];
        };

        await calculator().loadHistory();

        assert.deepStrictEqual(tables, ["minutely", "hourly", "daily"]);
    });
});

describe("UptimeCalculator.addHistoryEntry()", () => {
    test("merges into an existing bucket instead of duplicating it", () => {
        const calc = calculator();
        const list = calc.minutelyUptimeDataList;
        list.push(100, { up: 1, down: 0, avgPing: 5 });

        calc.addHistoryEntry(list, 100, { up: 2, down: 1, avgPing: 7 });

        assert.strictEqual(list.length(), 1);
        assert.deepStrictEqual(list[100], { up: 2, down: 1, avgPing: 7 });
    });

    test("pushes a new bucket", () => {
        const calc = calculator();
        const list = calc.minutelyUptimeDataList;

        calc.addHistoryEntry(list, 200, { up: 1, down: 0, avgPing: 3 });

        assert.strictEqual(list.length(), 1);
        assert.deepStrictEqual(list[200], { up: 1, down: 0, avgPing: 3 });
    });
});

describe("UptimeCalculator.ensureCurrentBuckets()", () => {
    test("continues the current buckets from their stored rows", async () => {
        let queries = 0;
        R.findOne = async () => {
            queries++;
            return { up: 3, down: 1, ping: 8, pingMin: 4, pingMax: 12, extras: null };
        };

        const calc = calculator();
        // The current buckets are created by get*Key during a normal beat
        calc.minutelyUptimeDataList.push(100, { up: 0, down: 0, avgPing: 0, minPing: 0, maxPing: 0 });
        calc.hourlyUptimeDataList.push(200, { up: 0, down: 0, avgPing: 0, minPing: 0, maxPing: 0 });
        calc.dailyUptimeDataList.push(300, { up: 0, down: 0, avgPing: 0, minPing: 0, maxPing: 0 });
        await calc.ensureCurrentBuckets(100, 200, 300);

        assert.strictEqual(queries, 3);
        assert.deepStrictEqual(calc.minutelyUptimeDataList[100], {
            up: 3,
            down: 1,
            avgPing: 8,
            minPing: 4,
            maxPing: 12,
        });
        assert.strictEqual(calc.currentBucketsLoaded, true);
    });

    test("does nothing once the current buckets were loaded", async () => {
        let queries = 0;
        R.findOne = async () => {
            queries++;
            return null;
        };

        const calc = calculator();
        await calc.ensureCurrentBuckets(100, 200, 300);
        await calc.ensureCurrentBuckets(400, 500, 600);

        assert.strictEqual(queries, 3);
    });
});

describe("UptimeCalculator.upsertStat()", () => {
    test("upserts the aggregated row and its extras", async () => {
        let captured = null;
        Object.defineProperty(R, "knex", {
            configurable: true,
            writable: true,
            value: (table) => ({
                insert(row) {
                    captured = { table, row };
                    return {
                        onConflict(columns) {
                            captured.conflict = columns;
                            return {
                                merge(mergeColumns) {
                                    captured.merge = mergeColumns;
                                    return Promise.resolve();
                                },
                            };
                        },
                    };
                },
            }),
        });

        await calculator().upsertStat("stat_minutely", 123, {
            up: 1,
            down: 2,
            avgPing: 3,
            minPing: 1,
            maxPing: 5,
            custom: "x",
        });

        assert.strictEqual(captured.table, "stat_minutely");
        assert.deepStrictEqual(captured.row, {
            monitor_id: 7,
            timestamp: 123,
            up: 1,
            down: 2,
            ping: 3,
            ping_min: 1,
            ping_max: 5,
            extras: '{"custom":"x"}',
        });
        assert.deepStrictEqual(captured.conflict, ["monitor_id", "timestamp"]);
        assert.deepStrictEqual(captured.merge, ["up", "down", "ping", "ping_min", "ping_max", "extras"]);
    });

    test("omits the extras column when there is nothing extra", async () => {
        let captured = null;
        Object.defineProperty(R, "knex", {
            configurable: true,
            writable: true,
            value: () => ({
                insert(row) {
                    captured = { row };
                    return {
                        onConflict() {
                            return {
                                merge(columns) {
                                    captured.merge = columns;
                                    return Promise.resolve();
                                },
                            };
                        },
                    };
                },
            }),
        });

        await calculator().upsertStat("stat_daily", 1, { up: 1, down: 0, avgPing: 2, minPing: 1, maxPing: 3 });

        assert.strictEqual("extras" in captured.row, false);
        assert.deepStrictEqual(captured.merge, ["up", "down", "ping", "ping_min", "ping_max"]);
    });
});

describe("UptimeCalculator.update() storage", () => {
    test("stores the buckets and prunes once per hour", async () => {
        delete process.env.TEST_BACKEND;
        UptimeCalculator.currentDate = dayjs.utc("2024-01-01T10:00:00Z");

        const tables = [];
        Object.defineProperty(R, "knex", {
            configurable: true,
            writable: true,
            value: (table) => ({
                insert() {
                    tables.push(table);
                    return {
                        onConflict() {
                            return {
                                merge() {
                                    return Promise.resolve();
                                },
                            };
                        },
                    };
                },
            }),
        });
        const execs = [];
        R.exec = async (sql, params) => {
            execs.push({ sql, params });
        };

        const calc = calculator();
        calc.currentBucketsLoaded = true;
        calc.historyLoaded = true;

        await calc.update(UP);
        assert.deepStrictEqual(tables.sort(), ["stat_daily", "stat_hourly", "stat_minutely"]);
        assert.strictEqual(execs.length, 2);
        assert.match(execs[0].sql, /DELETE FROM stat_minutely/);
        assert.match(execs[1].sql, /DELETE FROM stat_hourly/);

        // A second beat in the same hour must not prune again
        await calc.update(UP);
        assert.strictEqual(execs.length, 2);
    });
});
