const test = require("node:test");
const assert = require("node:assert");
const { UptimeCalculator } = require("../../server/uptime-calculator");
const dayjs = require("dayjs");
const { UP, DOWN, PENDING, MAINTENANCE } = require("../../src/util");
dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("../../server/modules/dayjs/plugin/timezone"));
dayjs.extend(require("dayjs/plugin/customParseFormat"));

test("Test Uptime Calculator - custom date", async (t) => {
    let c1 = new UptimeCalculator();

    // Test custom date
    UptimeCalculator.currentDate = dayjs.utc("2021-01-01T00:00:00.000Z");
    assert.strictEqual(c1.getCurrentDate().unix(), dayjs.utc("2021-01-01T00:00:00.000Z").unix());
});

test("Test update - UP", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:46:59");
    let c2 = new UptimeCalculator();
    let date = await c2.update(UP);
    assert.strictEqual(date.unix(), dayjs.utc("2023-08-12 20:46:59").unix());
});

test("Test update - MAINTENANCE", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:47:20");
    let c2 = new UptimeCalculator();
    let date = await c2.update(MAINTENANCE);
    assert.strictEqual(date.unix(), dayjs.utc("2023-08-12 20:47:20").unix());
});

test("Test update - DOWN", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:47:20");
    let c2 = new UptimeCalculator();
    let date = await c2.update(DOWN);
    assert.strictEqual(date.unix(), dayjs.utc("2023-08-12 20:47:20").unix());
});

test("Test update - PENDING", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:47:20");
    let c2 = new UptimeCalculator();
    let date = await c2.update(PENDING);
    assert.strictEqual(date.unix(), dayjs.utc("2023-08-12 20:47:20").unix());
});

test("Test flatStatus", async (t) => {
    let c2 = new UptimeCalculator();
    assert.strictEqual(c2.flatStatus(UP), UP);
    //assert.strictEqual(c2.flatStatus(MAINTENANCE), UP);
    assert.strictEqual(c2.flatStatus(DOWN), DOWN);
    assert.strictEqual(c2.flatStatus(PENDING), DOWN);
});

test("Test getMinutelyKey", async (t) => {
    let c2 = new UptimeCalculator();
    let divisionKey = c2.getMinutelyKey(dayjs.utc("2023-08-12 20:46:00"));
    assert.strictEqual(divisionKey, dayjs.utc("2023-08-12 20:46:00").unix());

    // Edge case 1
    c2 = new UptimeCalculator();
    divisionKey = c2.getMinutelyKey(dayjs.utc("2023-08-12 20:46:01"));
    assert.strictEqual(divisionKey, dayjs.utc("2023-08-12 20:46:00").unix());

    // Edge case 2
    c2 = new UptimeCalculator();
    divisionKey = c2.getMinutelyKey(dayjs.utc("2023-08-12 20:46:59"));
    assert.strictEqual(divisionKey, dayjs.utc("2023-08-12 20:46:00").unix());
});

test("Test getDailyKey", async (t) => {
    let c2 = new UptimeCalculator();
    let dailyKey = c2.getDailyKey(dayjs.utc("2023-08-12 20:46:00"));
    assert.strictEqual(dailyKey, dayjs.utc("2023-08-12").unix());

    c2 = new UptimeCalculator();
    dailyKey = c2.getDailyKey(dayjs.utc("2023-08-12 23:45:30"));
    assert.strictEqual(dailyKey, dayjs.utc("2023-08-12").unix());

    // Edge case 1
    c2 = new UptimeCalculator();
    dailyKey = c2.getDailyKey(dayjs.utc("2023-08-12 23:59:59"));
    assert.strictEqual(dailyKey, dayjs.utc("2023-08-12").unix());

    // Edge case 2
    c2 = new UptimeCalculator();
    dailyKey = c2.getDailyKey(dayjs.utc("2023-08-12 00:00:00"));
    assert.strictEqual(dailyKey, dayjs.utc("2023-08-12").unix());

    // Test timezone
    c2 = new UptimeCalculator();
    dailyKey = c2.getDailyKey(dayjs("Sat Dec 23 2023 05:38:39 GMT+0800 (Hong Kong Standard Time)"));
    assert.strictEqual(dailyKey, dayjs.utc("2023-12-22").unix());
});

test("Test lastDailyUptimeData", async (t) => {
    let c2 = new UptimeCalculator();
    await c2.update(UP);
    assert.strictEqual(c2.lastDailyUptimeData.up, 1);
});

test("Test get24Hour Uptime and Avg Ping", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:46:59");

    // No data
    let c2 = new UptimeCalculator();
    let data = c2.get24Hour();
    assert.strictEqual(data.uptime, 0);
    assert.strictEqual(data.avgPing, null);

    // 1 Up
    c2 = new UptimeCalculator();
    await c2.update(UP, 100);
    let uptime = c2.get24Hour().uptime;
    assert.strictEqual(uptime, 1);
    assert.strictEqual(c2.get24Hour().avgPing, 100);

    // 2 Up
    c2 = new UptimeCalculator();
    await c2.update(UP, 100);
    await c2.update(UP, 200);
    uptime = c2.get24Hour().uptime;
    assert.strictEqual(uptime, 1);
    assert.strictEqual(c2.get24Hour().avgPing, 150);

    // 3 Up
    c2 = new UptimeCalculator();
    await c2.update(UP, 0);
    await c2.update(UP, 100);
    await c2.update(UP, 400);
    uptime = c2.get24Hour().uptime;
    assert.strictEqual(uptime, 1);
    assert.strictEqual(c2.get24Hour().avgPing, 166.66666666666666);

    // 1 MAINTENANCE
    c2 = new UptimeCalculator();
    await c2.update(MAINTENANCE);
    uptime = c2.get24Hour().uptime;
    assert.strictEqual(uptime, 0);
    assert.strictEqual(c2.get24Hour().avgPing, null);

    // 1 PENDING
    c2 = new UptimeCalculator();
    await c2.update(PENDING);
    uptime = c2.get24Hour().uptime;
    assert.strictEqual(uptime, 0);
    assert.strictEqual(c2.get24Hour().avgPing, null);

    // 1 DOWN
    c2 = new UptimeCalculator();
    await c2.update(DOWN);
    uptime = c2.get24Hour().uptime;
    assert.strictEqual(uptime, 0);
    assert.strictEqual(c2.get24Hour().avgPing, null);

    // 2 DOWN
    c2 = new UptimeCalculator();
    await c2.update(DOWN);
    await c2.update(DOWN);
    uptime = c2.get24Hour().uptime;
    assert.strictEqual(uptime, 0);
    assert.strictEqual(c2.get24Hour().avgPing, null);

    // 1 DOWN, 1 UP
    c2 = new UptimeCalculator();
    await c2.update(DOWN);
    await c2.update(UP, 0.5);
    uptime = c2.get24Hour().uptime;
    assert.strictEqual(uptime, 0.5);
    assert.strictEqual(c2.get24Hour().avgPing, 0.5);

    // 1 UP, 1 DOWN
    c2 = new UptimeCalculator();
    await c2.update(UP, 123);
    await c2.update(DOWN);
    uptime = c2.get24Hour().uptime;
    assert.strictEqual(uptime, 0.5);
    assert.strictEqual(c2.get24Hour().avgPing, 123);

    // Add 24 hours
    c2 = new UptimeCalculator();
    await c2.update(UP, 0);
    await c2.update(UP, 0);
    await c2.update(UP, 0);
    await c2.update(UP, 1);
    await c2.update(DOWN);
    uptime = c2.get24Hour().uptime;
    assert.strictEqual(uptime, 0.8);
    assert.strictEqual(c2.get24Hour().avgPing, 0.25);

    UptimeCalculator.currentDate = UptimeCalculator.currentDate.add(24, "hour");

    // After 24 hours, even if there is no data, the uptime should be still 80%
    uptime = c2.get24Hour().uptime;
    assert.strictEqual(uptime, 0.8);
    assert.strictEqual(c2.get24Hour().avgPing, 0.25);

    // Add more 24 hours (48 hours)
    UptimeCalculator.currentDate = UptimeCalculator.currentDate.add(24, "hour");

    // After 48 hours, even if there is no data, the uptime should be still 80%
    uptime = c2.get24Hour().uptime;
    assert.strictEqual(uptime, 0.8);
    assert.strictEqual(c2.get24Hour().avgPing, 0.25);
});

test("Test get7DayUptime", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:46:59");

    // No data
    let c2 = new UptimeCalculator();
    let uptime = c2.get7Day().uptime;
    assert.strictEqual(uptime, 0);

    // 1 Up
    c2 = new UptimeCalculator();
    await c2.update(UP);
    uptime = c2.get7Day().uptime;
    assert.strictEqual(uptime, 1);

    // 2 Up
    c2 = new UptimeCalculator();
    await c2.update(UP);
    await c2.update(UP);
    uptime = c2.get7Day().uptime;
    assert.strictEqual(uptime, 1);

    // 3 Up
    c2 = new UptimeCalculator();
    await c2.update(UP);
    await c2.update(UP);
    await c2.update(UP);
    uptime = c2.get7Day().uptime;
    assert.strictEqual(uptime, 1);

    // 1 MAINTENANCE
    c2 = new UptimeCalculator();
    await c2.update(MAINTENANCE);
    uptime = c2.get7Day().uptime;
    assert.strictEqual(uptime, 0);

    // 1 PENDING
    c2 = new UptimeCalculator();
    await c2.update(PENDING);
    uptime = c2.get7Day().uptime;
    assert.strictEqual(uptime, 0);

    // 1 DOWN
    c2 = new UptimeCalculator();
    await c2.update(DOWN);
    uptime = c2.get7Day().uptime;
    assert.strictEqual(uptime, 0);

    // 2 DOWN
    c2 = new UptimeCalculator();
    await c2.update(DOWN);
    await c2.update(DOWN);
    uptime = c2.get7Day().uptime;
    assert.strictEqual(uptime, 0);

    // 1 DOWN, 1 UP
    c2 = new UptimeCalculator();
    await c2.update(DOWN);
    await c2.update(UP);
    uptime = c2.get7Day().uptime;
    assert.strictEqual(uptime, 0.5);

    // 1 UP, 1 DOWN
    c2 = new UptimeCalculator();
    await c2.update(UP);
    await c2.update(DOWN);
    uptime = c2.get7Day().uptime;
    assert.strictEqual(uptime, 0.5);

    // Add 7 days
    c2 = new UptimeCalculator();
    await c2.update(UP);
    await c2.update(UP);
    await c2.update(UP);
    await c2.update(UP);
    await c2.update(DOWN);
    uptime = c2.get7Day().uptime;
    assert.strictEqual(uptime, 0.8);
    UptimeCalculator.currentDate = UptimeCalculator.currentDate.add(7, "day");

    // After 7 days, even if there is no data, the uptime should be still 80%
    uptime = c2.get7Day().uptime;
    assert.strictEqual(uptime, 0.8);

});

test("Test get30DayUptime (1 check per day)", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:46:59");

    let c2 = new UptimeCalculator();
    let uptime = c2.get30Day().uptime;
    assert.strictEqual(uptime, 0);

    let up = 0;
    let down = 0;
    let flip = true;
    for (let i = 0; i < 30; i++) {
        UptimeCalculator.currentDate = UptimeCalculator.currentDate.add(1, "day");

        if (flip) {
            await c2.update(UP);
            up++;
        } else {
            await c2.update(DOWN);
            down++;
        }

        uptime = c2.get30Day().uptime;
        assert.strictEqual(uptime, up / (up + down));

        flip = !flip;
    }

    // Last 7 days
    // Down, Up, Down, Up, Down, Up, Down
    // So 3 UP
    assert.strictEqual(c2.get7Day().uptime, 3 / 7);
});

test("Test get1YearUptime (1 check per day)", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:46:59");

    let c2 = new UptimeCalculator();
    let uptime = c2.get1Year().uptime;
    assert.strictEqual(uptime, 0);

    let flip = true;
    for (let i = 0; i < 365; i++) {
        UptimeCalculator.currentDate = UptimeCalculator.currentDate.add(1, "day");

        if (flip) {
            await c2.update(UP);
        } else {
            await c2.update(DOWN);
        }

        uptime = c2.get30Day().time;
        flip = !flip;
    }

    assert.strictEqual(c2.get1Year().uptime, 183 / 365);
    assert.strictEqual(c2.get30Day().uptime, 15 / 30);
    assert.strictEqual(c2.get7Day().uptime, 4 / 7);
});

/**
 * Code from here: https://stackoverflow.com/a/64550489/1097815
 * @returns {{rss: string, heapTotal: string, heapUsed: string, external: string}} Current memory usage
 */
function memoryUsage() {
    const formatMemoryUsage = (data) => `${Math.round(data / 1024 / 1024 * 100) / 100} MB`;
    const memoryData = process.memoryUsage();

    return {
        rss: `${formatMemoryUsage(memoryData.rss)} -> Resident Set Size - total memory allocated for the process execution`,
        heapTotal: `${formatMemoryUsage(memoryData.heapTotal)} -> total size of the allocated heap`,
        heapUsed: `${formatMemoryUsage(memoryData.heapUsed)} -> actual memory used during the execution`,
        external: `${formatMemoryUsage(memoryData.external)} -> V8 external memory`,
    };
}

test("Worst case", async (t) => {

    // Disable on GitHub Actions, as it is not stable on it
    if (process.env.GITHUB_ACTIONS) {
        return;
    }

    console.log("Memory usage before preparation", memoryUsage());

    let c = new UptimeCalculator();
    let up = 0;
    let down = 0;
    let interval = 20;

    await t.test("Prepare data", async () => {
        UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:46:59");

        // Since 2023-08-12 will be out of 365 range, it starts from 2023-08-13 actually
        let actualStartDate = dayjs.utc("2023-08-13 00:00:00").unix();

        // Simulate 1s interval for a year
        for (let i = 0; i < 365 * 24 * 60 * 60; i += interval) {
            UptimeCalculator.currentDate = UptimeCalculator.currentDate.add(interval, "second");

            //Randomly UP, DOWN, MAINTENANCE, PENDING
            let rand = Math.random();
            if (rand < 0.25) {
                c.update(UP);
                if (UptimeCalculator.currentDate.unix() > actualStartDate) {
                    up++;
                }
            } else if (rand < 0.5) {
                c.update(DOWN);
                if (UptimeCalculator.currentDate.unix() > actualStartDate) {
                    down++;
                }
            } else if (rand < 0.75) {
                c.update(MAINTENANCE);
                if (UptimeCalculator.currentDate.unix() > actualStartDate) {
                    //up++;
                }
            } else {
                c.update(PENDING);
                if (UptimeCalculator.currentDate.unix() > actualStartDate) {
                    down++;
                }
            }
        }
        console.log("Final Date: ", UptimeCalculator.currentDate.format("YYYY-MM-DD HH:mm:ss"));
        console.log("Memory usage before preparation", memoryUsage());

        assert.strictEqual(c.minutelyUptimeDataList.length(), 1440);
        assert.strictEqual(c.dailyUptimeDataList.length(), 365);
    });

    await t.test("get1YearUptime()", async () => {
        assert.strictEqual(c.get1Year().uptime, up / (up + down));
    });

});
