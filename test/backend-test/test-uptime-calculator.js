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

test("Test getAggregatedBuckets - Basic functionality", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2025-08-12 12:00:00");
    let c = new UptimeCalculator();

    // Add some test data
    await c.update(UP);
    await c.update(DOWN);
    await c.update(UP);

    // Test basic 1-day aggregation
    let buckets = c.getAggregatedBuckets(1, 10);

    // Should return exactly 10 buckets
    assert.strictEqual(buckets.length, 10);

    // Each bucket should have required properties
    buckets.forEach(bucket => {
        assert.ok(typeof bucket.start === "number");
        assert.ok(typeof bucket.end === "number");
        assert.ok(typeof bucket.up === "number");
        assert.ok(typeof bucket.down === "number");
        assert.ok(typeof bucket.maintenance === "number");
        assert.ok(typeof bucket.pending === "number");
        assert.ok(bucket.start < bucket.end);
    });

    // Buckets should be contiguous
    for (let i = 0; i < buckets.length - 1; i++) {
        assert.strictEqual(buckets[i].end, buckets[i + 1].start);
    }
});

test("Test getAggregatedBuckets - Time range accuracy", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2025-08-12 12:00:00");
    let c = new UptimeCalculator();

    let buckets = c.getAggregatedBuckets(2, 48); // 2 days, 48 buckets = 1 hour per bucket

    assert.strictEqual(buckets.length, 48);

    // First bucket should start 2 days ago from current time
    let currentTime = dayjs.utc("2025-08-12 12:00:00");
    let expectedStart = currentTime.subtract(2, "day").unix();
    assert.strictEqual(buckets[0].start, expectedStart);

    // Last bucket should end at current time
    let expectedEnd = currentTime.unix();
    assert.strictEqual(buckets[buckets.length - 1].end, expectedEnd);

    // Each bucket should be exactly 1 hour (3600 seconds)
    buckets.forEach(bucket => {
        assert.strictEqual(bucket.end - bucket.start, 3600);
    });
});

test("Test getAggregatedBuckets - Different time ranges", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2025-08-12 12:00:00");
    let c = new UptimeCalculator();

    // Test 1 day (should use minutely data)
    let buckets1d = c.getAggregatedBuckets(1, 24);
    assert.strictEqual(buckets1d.length, 24);

    // Test 7 days (should use hourly data)
    let buckets7d = c.getAggregatedBuckets(7, 50);
    assert.strictEqual(buckets7d.length, 50);

    // Test 60 days (should use daily data)
    let buckets60d = c.getAggregatedBuckets(60, 60);
    assert.strictEqual(buckets60d.length, 60);

    // Test maximum days (365)
    let buckets365d = c.getAggregatedBuckets(365, 100);
    assert.strictEqual(buckets365d.length, 100);
});

test("Test getAggregatedBuckets - Data aggregation", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2025-08-12 12:00:00");
    let c = new UptimeCalculator();

    // Create test data - add heartbeats over the past hour
    let currentTime = dayjs.utc("2025-08-12 12:00:00");

    // Add some recent data (within the last hour) to ensure it's captured
    for (let i = 0; i < 10; i++) {
        UptimeCalculator.currentDate = currentTime.subtract(60 - (i * 5), "minute"); // Go back in time
        if (i < 5) {
            await c.update(UP);
        } else {
            await c.update(DOWN);
        }
    }

    // Reset to current time
    UptimeCalculator.currentDate = currentTime;

    // Get aggregated buckets for 1 hour with 6 buckets (10 minutes each)
    let buckets = c.getAggregatedBuckets(1 / 24, 6); // 1/24 day = 1 hour

    assert.strictEqual(buckets.length, 6);

    // Check that we have bucket structure even if no data (should not crash)
    buckets.forEach(bucket => {
        assert.ok(typeof bucket.start === "number");
        assert.ok(typeof bucket.end === "number");
        assert.ok(typeof bucket.up === "number");
        assert.ok(typeof bucket.down === "number");
        assert.ok(bucket.start < bucket.end);
    });

    // For this test, we'll just verify the method works and returns proper structure
    // The actual data aggregation depends on the complex internal storage which is tested separately
});

test("Test getAggregatedBuckets - Edge cases", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2025-08-12 12:00:00");
    let c = new UptimeCalculator();

    // Test with no data
    let emptyBuckets = c.getAggregatedBuckets(1, 10);
    assert.strictEqual(emptyBuckets.length, 10);
    emptyBuckets.forEach(bucket => {
        assert.strictEqual(bucket.up, 0);
        assert.strictEqual(bucket.down, 0);
        assert.strictEqual(bucket.maintenance, 0);
        assert.strictEqual(bucket.pending, 0);
    });

    // Test with single bucket
    let singleBucket = c.getAggregatedBuckets(1, 1);
    assert.strictEqual(singleBucket.length, 1);
    assert.strictEqual(singleBucket[0].end - singleBucket[0].start, 24 * 60 * 60); // 1 day in seconds

    // Test with very small time range
    let smallRange = c.getAggregatedBuckets(0.1, 5); // 0.1 days = 2.4 hours
    assert.strictEqual(smallRange.length, 5);
    smallRange.forEach(bucket => {
        assert.strictEqual(bucket.end - bucket.start, 2.4 * 60 * 60 / 5); // 2.4 hours / 5 buckets
    });
});

test("Test getAggregatedBuckets - Bucket size calculation", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2025-08-12 12:00:00");
    let c = new UptimeCalculator();

    // Test different bucket counts for same time range
    let days = 3;
    let buckets10 = c.getAggregatedBuckets(days, 10);
    let buckets50 = c.getAggregatedBuckets(days, 50);
    let buckets100 = c.getAggregatedBuckets(days, 100);

    assert.strictEqual(buckets10.length, 10);
    assert.strictEqual(buckets50.length, 50);
    assert.strictEqual(buckets100.length, 100);

    // Bucket sizes should be inversely proportional to bucket count
    let bucket10Size = buckets10[0].end - buckets10[0].start;
    let bucket50Size = buckets50[0].end - buckets50[0].start;
    let bucket100Size = buckets100[0].end - buckets100[0].start;

    assert.ok(bucket10Size > bucket50Size);
    assert.ok(bucket50Size > bucket100Size);

    // All buckets should cover the same total time range
    assert.strictEqual(buckets10[buckets10.length - 1].end - buckets10[0].start, days * 24 * 60 * 60);
    assert.strictEqual(buckets50[buckets50.length - 1].end - buckets50[0].start, days * 24 * 60 * 60);
    assert.strictEqual(buckets100[buckets100.length - 1].end - buckets100[0].start, days * 24 * 60 * 60);
});

test("Test getAggregatedBuckets - Default parameters", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2025-08-12 12:00:00");
    let c = new UptimeCalculator();

    // Test default targetBuckets (should be 100)
    let defaultBuckets = c.getAggregatedBuckets(7);
    assert.strictEqual(defaultBuckets.length, 100);

    // Test explicit targetBuckets
    let explicitBuckets = c.getAggregatedBuckets(7, 50);
    assert.strictEqual(explicitBuckets.length, 50);
});

test("Test getAggregatedBuckets - Rounding precision", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2025-08-12 12:00:00");
    let c = new UptimeCalculator();

    // Test with non-integer bucket sizes (should not have rounding drift)
    let buckets = c.getAggregatedBuckets(1, 7); // 1 day / 7 buckets = ~3.43 hours per bucket

    assert.strictEqual(buckets.length, 7);

    // Verify no gaps or overlaps between buckets
    for (let i = 0; i < buckets.length - 1; i++) {
        assert.strictEqual(buckets[i].end, buckets[i + 1].start, `Gap found between bucket ${i} and ${i + 1}`);
    }

    // Verify total time range is exactly as requested
    let totalTime = buckets[buckets.length - 1].end - buckets[0].start;
    let expectedTime = 1 * 24 * 60 * 60; // 1 day in seconds
    assert.strictEqual(totalTime, expectedTime);
});

test("Test getAggregatedBuckets - 31-63 day edge case (daily data)", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2025-08-12 12:00:00");
    let c = new UptimeCalculator();

    // Create test data for 40 days ago to ensure daily data is used
    let currentTime = dayjs.utc("2025-08-12 12:00:00");
    
    // Add data for past 40 days
    for (let i = 0; i < 40; i++) {
        UptimeCalculator.currentDate = currentTime.subtract(i, "day").hour(10); // 10 AM each day
        await c.update(i % 3 === 0 ? DOWN : UP); // Mix of UP/DOWN
    }

    // Reset to current time
    UptimeCalculator.currentDate = currentTime;

    // Test 35-day range (should use daily data, not hourly)
    let buckets = c.getAggregatedBuckets(35, 70); // 35 days with 70 buckets

    assert.strictEqual(buckets.length, 70);

    // Count non-empty buckets - should have data distributed across buckets
    let nonEmptyBuckets = buckets.filter(b => b.up > 0 || b.down > 0).length;
    assert.ok(nonEmptyBuckets > 20, `Expected more than 20 non-empty buckets, got ${nonEmptyBuckets}`);

    // Verify buckets cover the full time range without gaps
    for (let i = 0; i < buckets.length - 1; i++) {
        assert.strictEqual(buckets[i].end, buckets[i + 1].start, `Gap found between bucket ${i} and ${i + 1}`);
    }

    // Verify total counts
    let totalUp = buckets.reduce((sum, b) => sum + b.up, 0);
    let totalDown = buckets.reduce((sum, b) => sum + b.down, 0);
    
    // We added 35 days of data (within the range), with pattern: DOWN, UP, UP, DOWN, UP, UP...
    // So roughly 1/3 DOWN and 2/3 UP
    assert.ok(totalUp > 0, "Should have UP heartbeats");
    assert.ok(totalDown > 0, "Should have DOWN heartbeats");
    assert.ok(totalUp + totalDown <= 35, "Should not exceed 35 total heartbeats for 35 days");
});

test("Test getAggregatedBuckets - 31-day boundary transition", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2025-08-12 12:00:00");
    let c = new UptimeCalculator();

    // Test exactly at 30/31 day boundary
    let buckets30 = c.getAggregatedBuckets(30, 60);
    let buckets31 = c.getAggregatedBuckets(31, 62);

    assert.strictEqual(buckets30.length, 60);
    assert.strictEqual(buckets31.length, 62);

    // Both should work without errors
    assert.ok(buckets30.every(b => typeof b.up === "number"));
    assert.ok(buckets31.every(b => typeof b.up === "number"));
});

test("Test getAggregatedBuckets - Large range with daily data (60 days)", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2025-08-12 12:00:00");
    let c = new UptimeCalculator();

    let currentTime = dayjs.utc("2025-08-12 12:00:00");
    
    // Add daily data for past 60 days
    for (let i = 0; i < 60; i++) {
        UptimeCalculator.currentDate = currentTime.subtract(i, "day").hour(14); // 2 PM each day
        if (i < 30) {
            await c.update(UP); // First 30 days all UP
        } else {
            await c.update(i % 2 === 0 ? UP : DOWN); // Last 30 days alternating
        }
    }

    // Reset to current time
    UptimeCalculator.currentDate = currentTime;

    // Test 60-day range
    let buckets = c.getAggregatedBuckets(60, 60); // 1 bucket per day

    assert.strictEqual(buckets.length, 60);

    // Count buckets with data
    let bucketsWithData = buckets.filter(b => b.up > 0 || b.down > 0).length;
    assert.ok(bucketsWithData >= 55, `Expected at least 55 buckets with data, got ${bucketsWithData}`);

    // Verify data distribution
    let totalUp = buckets.reduce((sum, b) => sum + b.up, 0);
    let totalDown = buckets.reduce((sum, b) => sum + b.down, 0);
    
    assert.ok(totalUp >= 40, `Expected at least 40 UP beats, got ${totalUp}`);
    assert.ok(totalDown >= 10, `Expected at least 10 DOWN beats, got ${totalDown}`);
});

test("Test getAggregatedBuckets - Daily data bucket assignment", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2025-08-12 12:00:00");
    let c = new UptimeCalculator();

    let currentTime = dayjs.utc("2025-08-12 12:00:00");
    
    // Add specific daily data points
    const testDays = [1, 5, 10, 20, 35, 40]; // Days ago
    for (const daysAgo of testDays) {
        UptimeCalculator.currentDate = currentTime.subtract(daysAgo, "day").startOf("day").add(6, "hour"); // 6 AM
        await c.update(UP);
    }

    // Reset to current time
    UptimeCalculator.currentDate = currentTime;

    // Test 45-day range with 45 buckets (1 per day)
    let buckets = c.getAggregatedBuckets(45, 45);

    assert.strictEqual(buckets.length, 45);

    // Check that each test day has exactly one heartbeat in the correct bucket
    for (const daysAgo of testDays) {
        if (daysAgo <= 45) { // Only check days within our range
            // Find the bucket that should contain this day
            const targetTime = currentTime.subtract(daysAgo, "day").startOf("day");
            const targetTimestamp = targetTime.unix();
            
            let found = false;
            for (const bucket of buckets) {
                // Check if this bucket's range includes our target day
                if (targetTimestamp >= bucket.start && targetTimestamp < bucket.end) {
                    assert.ok(bucket.up > 0, `Bucket containing day ${daysAgo} should have UP count`);
                    found = true;
                    break;
                }
            }
            assert.ok(found, `Should find bucket containing day ${daysAgo}`);
        }
    }
});

test("Test getAggregatedBuckets - No gaps in 31-63 day range", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2025-08-12 12:00:00");
    let c = new UptimeCalculator();

    // Test various day ranges that were problematic
    const testRanges = [
        { days: 31, buckets: 100 },
        { days: 35, buckets: 100 },
        { days: 40, buckets: 100 },
        { days: 45, buckets: 100 },
        { days: 50, buckets: 100 },
        { days: 60, buckets: 100 },
        { days: 63, buckets: 100 }
    ];

    for (const { days, buckets: bucketCount } of testRanges) {
        let buckets = c.getAggregatedBuckets(days, bucketCount);
        
        assert.strictEqual(buckets.length, bucketCount, `Should have exactly ${bucketCount} buckets for ${days} days`);
        
        // Verify no gaps between buckets
        for (let i = 0; i < buckets.length - 1; i++) {
            assert.strictEqual(buckets[i].end, buckets[i + 1].start, 
                `No gap should exist between buckets ${i} and ${i + 1} for ${days}-day range`);
        }
        
        // Verify total time coverage
        const totalSeconds = buckets[buckets.length - 1].end - buckets[0].start;
        const expectedSeconds = days * 24 * 60 * 60;
        assert.strictEqual(totalSeconds, expectedSeconds, 
            `Total time should be exactly ${days} days for ${days}-day range`);
    }
});

test("Test getAggregatedBuckets - Mixed data granularity", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2025-08-12 12:00:00");
    let c = new UptimeCalculator();

    let currentTime = dayjs.utc("2025-08-12 12:00:00");
    
    // Add recent minute data (last hour)
    for (let i = 0; i < 60; i += 5) {
        UptimeCalculator.currentDate = currentTime.subtract(i, "minute");
        await c.update(UP);
    }
    
    // Add hourly data (last 24 hours)
    for (let i = 1; i < 24; i++) {
        UptimeCalculator.currentDate = currentTime.subtract(i, "hour");
        await c.update(i % 4 === 0 ? DOWN : UP);
    }
    
    // Add daily data (last 40 days)
    for (let i = 2; i <= 40; i++) {
        UptimeCalculator.currentDate = currentTime.subtract(i, "day").hour(12);
        await c.update(i % 5 === 0 ? DOWN : UP);
    }

    // Reset to current time
    UptimeCalculator.currentDate = currentTime;

    // Test different ranges to ensure proper data selection
    // 1-day range should use minute data
    let buckets1d = c.getAggregatedBuckets(1, 24);
    assert.strictEqual(buckets1d.length, 24);
    
    // 7-day range should use hourly data  
    let buckets7d = c.getAggregatedBuckets(7, 50);
    assert.strictEqual(buckets7d.length, 50);
    
    // 35-day range should use daily data
    let buckets35d = c.getAggregatedBuckets(35, 70);
    assert.strictEqual(buckets35d.length, 70);
    
    // All should have some data
    assert.ok(buckets1d.some(b => b.up > 0));
    assert.ok(buckets7d.some(b => b.up > 0 || b.down > 0));
    assert.ok(buckets35d.some(b => b.up > 0 || b.down > 0));
});

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
