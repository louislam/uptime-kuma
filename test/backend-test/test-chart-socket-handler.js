const { describe, test, afterEach, mock } = require("node:test");
const assert = require("node:assert");
const { R } = require("redbean-node");
const Database = require("../../server/database");
const { getInformationalChartData } = require("../../server/socket-handlers/chart-socket-handler");

const originalDbConfig = Database.dbConfig;

afterEach(() => {
    mock.restoreAll();
    Database.dbConfig = originalDbConfig;
});

describe("getInformationalChartData()", () => {
    test("builds minute buckets from SQLite heartbeat data", async () => {
        Database.dbConfig = { type: "sqlite" };
        mock.method(R, "getAll", async (query, params) => {
            assert.match(query, /strftime\('%s', time\)/);
            assert.match(query, /% 60/);
            assert.deepStrictEqual(params.slice(0, 8), [1, 0, 2, 3, 1, 1, 1, 7]);
            assert.match(params[8], /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:00$/);

            return [
                {
                    bucket_timestamp: "1793099760",
                    up: "2",
                    down: "3",
                    maintenance: "0",
                    avgPing: "15.5",
                    minPing: "12",
                    maxPing: "19",
                },
                {
                    bucket_timestamp: "1793099820",
                    up: "0",
                    down: "2",
                    maintenance: "1",
                    avgPing: null,
                    minPing: null,
                    maxPing: null,
                },
            ];
        });

        const data = await getInformationalChartData(7, 3);

        assert.deepStrictEqual(data, [
            {
                timestamp: 1793099760,
                up: 2,
                down: 3,
                maintenance: undefined,
                avgPing: 15.5,
                minPing: 12,
                maxPing: 19,
            },
            {
                timestamp: 1793099820,
                up: 0,
                down: 2,
                maintenance: 1,
                avgPing: null,
                minPing: null,
                maxPing: null,
            },
        ]);
    });

    test("uses hourly MariaDB buckets for longer periods", async () => {
        Database.dbConfig = { type: "embedded-mariadb" };
        mock.method(R, "getAll", async (query, params) => {
            assert.match(query, /UNIX_TIMESTAMP\(time\)/);
            assert.match(query, /% 3600/);
            assert.strictEqual(params[7], 9);
            return [];
        });

        assert.deepStrictEqual(await getInformationalChartData(9, 168), []);
    });

    test("rejects invalid periods", async () => {
        await assert.rejects(getInformationalChartData(1, 0), { message: "Invalid period." });
        await assert.rejects(getInformationalChartData(1, Number.NaN), { message: "Invalid period." });
    });
});
