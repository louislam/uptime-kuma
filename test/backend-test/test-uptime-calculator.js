const semver = require("semver");
let test;
const nodeVersion = process.versions.node;
// Node.js version >= 18
if (semver.satisfies(nodeVersion, ">= 18")) {
    test = require("node:test");
} else {
    test = require("test");
}

const assert = require("node:assert");
const { UptimeCalculator } = require("../../server/uptime-calculator");
const dayjs = require("dayjs");
const { UP, DOWN, PENDING, MAINTENANCE } = require("../../src/util");
dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("../../server/modules/dayjs/plugin/timezone"));
dayjs.extend(require("dayjs/plugin/customParseFormat"));

test("Test Uptime Calculator - custom date", (t) => {
    let c1 = new UptimeCalculator();

    // Test custom date
    UptimeCalculator.currentDate = dayjs.utc("2021-01-01T00:00:00.000Z");
    assert.strictEqual(c1.getCurrentDate().unix(), dayjs.utc("2021-01-01T00:00:00.000Z").unix());
});

test("Test update - UP", (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:46:59");
    let c2 = new UptimeCalculator();
    let date = c2.update(UP);
    assert.strictEqual(date.unix(), dayjs.utc("2023-08-12 20:46:59").unix());
});

test("Test update - MAINTENANCE", (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:47:20");
    let c2 = new UptimeCalculator();
    let date = c2.update(MAINTENANCE);
    assert.strictEqual(date.unix(), dayjs.utc("2023-08-12 20:47:20").unix());
});

test("Test update - DOWN", (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:47:20");
    let c2 = new UptimeCalculator();
    let date = c2.update(DOWN);
    assert.strictEqual(date.unix(), dayjs.utc("2023-08-12 20:47:20").unix());
});

test("Test update - PENDING", (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:47:20");
    let c2 = new UptimeCalculator();
    let date = c2.update(PENDING);
    assert.strictEqual(date.unix(), dayjs.utc("2023-08-12 20:47:20").unix());
});

test("Test flatStatus", (t) => {
    let c2 = new UptimeCalculator();
    assert.strictEqual(c2.flatStatus(UP), UP);
    assert.strictEqual(c2.flatStatus(MAINTENANCE), UP);
    assert.strictEqual(c2.flatStatus(DOWN), DOWN);
    assert.strictEqual(c2.flatStatus(PENDING), DOWN);
});

test("Test getMinutelyKey", (t) => {
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

test("Test getDailyKey", (t) => {
    let c2 = new UptimeCalculator();
    let dailyKey = c2.getDailyKey(dayjs.utc("2023-08-12 20:46:00").unix());
    assert.strictEqual(dailyKey, dayjs.utc("2023-08-12").unix());

    c2 = new UptimeCalculator();
    dailyKey = c2.getDailyKey(dayjs.utc("2023-08-12 23:45:30").unix());
    assert.strictEqual(dailyKey, dayjs.utc("2023-08-12").unix());

    // Edge case 1
    c2 = new UptimeCalculator();
    dailyKey = c2.getDailyKey(dayjs.utc("2023-08-12 23:59:59").unix());
    assert.strictEqual(dailyKey, dayjs.utc("2023-08-12").unix());

    // Edge case 2
    c2 = new UptimeCalculator();
    dailyKey = c2.getDailyKey(dayjs.utc("2023-08-12 00:00:00").unix());
    assert.strictEqual(dailyKey, dayjs.utc("2023-08-12").unix());
});

test("Test lastDailyUptimeData", (t) => {
    let c2 = new UptimeCalculator();
    c2.update(UP);
    assert.strictEqual(c2.lastDailyUptimeData.up, 1);
});

test("Test get24HourUptime", (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:46:59");

    // No data
    let c2 = new UptimeCalculator();
    let data = c2.get24Hour();
    assert.strictEqual(data.uptime, 0);
    assert.strictEqual(data.avgPing, 0);

    // 1 Up
    c2 = new UptimeCalculator();
    c2.update(UP);
    let uptime = c2.get24Hour().uptime;
    assert.strictEqual(uptime, 1);

    // 2 Up
    c2 = new UptimeCalculator();
    c2.update(UP);
    c2.update(UP);
    uptime = c2.get24Hour().uptime;
    assert.strictEqual(uptime, 1);

    // 3 Up
    c2 = new UptimeCalculator();
    c2.update(UP);
    c2.update(UP);
    c2.update(UP);
    uptime = c2.get24Hour().uptime;
    assert.strictEqual(uptime, 1);

    // 1 MAINTENANCE
    c2 = new UptimeCalculator();
    c2.update(MAINTENANCE);
    uptime = c2.get24Hour().uptime;
    assert.strictEqual(uptime, 1);

    // 1 PENDING
    c2 = new UptimeCalculator();
    c2.update(PENDING);
    uptime = c2.get24Hour().uptime;
    assert.strictEqual(uptime, 0);

    // 1 DOWN
    c2 = new UptimeCalculator();
    c2.update(DOWN);
    uptime = c2.get24Hour().uptime;
    assert.strictEqual(uptime, 0);

    // 2 DOWN
    c2 = new UptimeCalculator();
    c2.update(DOWN);
    c2.update(DOWN);
    uptime = c2.get24Hour().uptime;
    assert.strictEqual(uptime, 0);

    // 1 DOWN, 1 UP
    c2 = new UptimeCalculator();
    c2.update(DOWN);
    c2.update(UP);
    uptime = c2.get24Hour().uptime;
    assert.strictEqual(uptime, 0.5);

    // 1 UP, 1 DOWN
    c2 = new UptimeCalculator();
    c2.update(UP);
    c2.update(DOWN);
    uptime = c2.get24Hour().uptime;
    assert.strictEqual(uptime, 0.5);

    // Add 24 hours
    c2 = new UptimeCalculator();
    c2.update(UP);
    c2.update(UP);
    c2.update(UP);
    c2.update(UP);
    c2.update(DOWN);
    uptime = c2.get24Hour().uptime;
    assert.strictEqual(uptime, 0.8);
    UptimeCalculator.currentDate = UptimeCalculator.currentDate.add(24, "hour");

    // After 24 hours, even if there is no data, the uptime should be still 80%
    uptime = c2.get24Hour().uptime;
    assert.strictEqual(uptime, 0.8);

    // Add more 24 hours (48 hours)
    UptimeCalculator.currentDate = UptimeCalculator.currentDate.add(24, "hour");

    // After 48 hours, even if there is no data, the uptime should be still 80%
    uptime = c2.get24Hour().uptime;
    assert.strictEqual(uptime, 0.8);
});

test("Test get7DayUptime", (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:46:59");

    // No data
    let c2 = new UptimeCalculator();
    let uptime = c2.get7Day().uptime;
    assert.strictEqual(uptime, 0);

    // 1 Up
    c2 = new UptimeCalculator();
    c2.update(UP);
    uptime = c2.get7Day().uptime;
    assert.strictEqual(uptime, 1);

    // 2 Up
    c2 = new UptimeCalculator();
    c2.update(UP);
    c2.update(UP);
    uptime = c2.get7Day().uptime;
    assert.strictEqual(uptime, 1);

    // 3 Up
    c2 = new UptimeCalculator();
    c2.update(UP);
    c2.update(UP);
    c2.update(UP);
    uptime = c2.get7Day().uptime;
    assert.strictEqual(uptime, 1);

    // 1 MAINTENANCE
    c2 = new UptimeCalculator();
    c2.update(MAINTENANCE);
    uptime = c2.get7Day().uptime;
    assert.strictEqual(uptime, 1);

    // 1 PENDING
    c2 = new UptimeCalculator();
    c2.update(PENDING);
    uptime = c2.get7Day().uptime;
    assert.strictEqual(uptime, 0);

    // 1 DOWN
    c2 = new UptimeCalculator();
    c2.update(DOWN);
    uptime = c2.get7Day().uptime;
    assert.strictEqual(uptime, 0);

    // 2 DOWN
    c2 = new UptimeCalculator();
    c2.update(DOWN);
    c2.update(DOWN);
    uptime = c2.get7Day().uptime;
    assert.strictEqual(uptime, 0);

    // 1 DOWN, 1 UP
    c2 = new UptimeCalculator();
    c2.update(DOWN);
    c2.update(UP);
    uptime = c2.get7Day().uptime;
    assert.strictEqual(uptime, 0.5);

    // 1 UP, 1 DOWN
    c2 = new UptimeCalculator();
    c2.update(UP);
    c2.update(DOWN);
    uptime = c2.get7Day().uptime;
    assert.strictEqual(uptime, 0.5);

    // Add 7 days
    c2 = new UptimeCalculator();
    c2.update(UP);
    c2.update(UP);
    c2.update(UP);
    c2.update(UP);
    c2.update(DOWN);
    uptime = c2.get7Day().uptime;
    assert.strictEqual(uptime, 0.8);
    UptimeCalculator.currentDate = UptimeCalculator.currentDate.add(7, "day");

    // After 7 days, even if there is no data, the uptime should be still 80%
    uptime = c2.get7Day().uptime;
    assert.strictEqual(uptime, 0.8);

});

test("Test get30DayUptime (1 check per day)", (t) => {
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
            c2.update(UP);
            up++;
        } else {
            c2.update(DOWN);
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

test("Test get1YearUptime (1 check per day)", (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2023-08-12 20:46:59");

    let c2 = new UptimeCalculator();
    let uptime = c2.get1Year().uptime;
    assert.strictEqual(uptime, 0);

    let flip = true;
    for (let i = 0; i < 365; i++) {
        UptimeCalculator.currentDate = UptimeCalculator.currentDate.add(1, "day");

        if (flip) {
            c2.update(UP);
        } else {
            c2.update(DOWN);
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
 */
function memoryUsage() {
    const formatMemoryUsage = (data) => `${Math.round(data / 1024 / 1024 * 100) / 100} MB`;
    const memoryData = process.memoryUsage();

    const memoryUsage = {
        rss: `${formatMemoryUsage(memoryData.rss)} -> Resident Set Size - total memory allocated for the process execution`,
        heapTotal: `${formatMemoryUsage(memoryData.heapTotal)} -> total size of the allocated heap`,
        heapUsed: `${formatMemoryUsage(memoryData.heapUsed)} -> actual memory used during the execution`,
        external: `${formatMemoryUsage(memoryData.external)} -> V8 external memory`,
    };
    return memoryUsage;
}

test("Worst case", async (t) => {
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
                    up++;
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

        assert.strictEqual(c.uptimeDataList.length(), 1440);
        assert.strictEqual(c.dailyUptimeDataList.length(), 365);
    });

    await t.test("get1YearUptime()", async () => {
        assert.strictEqual(c.get1Year().uptime, up / (up + down));
    });

});
