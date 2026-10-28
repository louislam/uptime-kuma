const { test } = require("node:test");
const assert = require("node:assert");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const { UP, DOWN, MAINTENANCE } = require("../../src/util");
const { UptimeCalculator } = require("../../server/uptime-calculator");
const { getAggregatedBuckets } = require("../../server/utils/heartbeat-buckets");

dayjs.extend(utc);

/**
 * Create a calculator whose bucket loading is stubbed, so update() does not query the database
 * @returns {UptimeCalculator} Calculator instance
 */
function createCalculator() {
    const calculator = new UptimeCalculator();
    calculator.currentBucketsLoaded = true;
    return calculator;
}

test("getAggregatedBuckets - caps bucket count at tier resolution (no grey gaps from upsampling)", async (t) => {
    const currentTime = dayjs.utc("2026-07-01 12:00:00");
    UptimeCalculator.currentDate = currentTime;
    const c = createCalculator();

    // Populate 40 days of daily data, one beat per day
    for (let i = 0; i < 40; i++) {
        UptimeCalculator.currentDate = currentTime.subtract(i, "day").hour(10);
        await c.update(1); // UP
    }
    UptimeCalculator.currentDate = currentTime;

    // 35 days uses the daily tier: asking for up to 100 beats must be capped
    // at 35 (one per stored day), otherwise buckets narrower than the tier
    // stay empty and render as grey gaps
    const buckets = getAggregatedBuckets(c, 35, 100, 60);

    assert.strictEqual(buckets.length, 35);

    for (const [i, bucket] of buckets.entries()) {
        assert.ok(bucket.up > 0, `Bucket ${i} is empty - this is the grey gap bug`);
    }
});

test("getAggregatedBuckets - bucket count at tier boundaries", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2026-07-01 12:00:00");
    const c = createCalculator();

    // 1 day uses the per-minute tier, 15 minutes per bucket keeps it under maxBeats
    assert.strictEqual(getAggregatedBuckets(c, 1, 100, 60).length, 96);

    // 2 days on the hourly tier can never have more than 48 buckets
    assert.strictEqual(getAggregatedBuckets(c, 2, 100, 60).length, 48);

    // 30 days is still hourly (720 stored hours), 8 hours per bucket keeps it under maxBeats
    assert.strictEqual(getAggregatedBuckets(c, 30, 100, 60).length, 90);

    // 31 days switches to the daily tier: one bucket per stored day
    assert.strictEqual(getAggregatedBuckets(c, 31, 100, 60).length, 31);

    // 365 days daily leaves 4 days per bucket to stay under maxBeats
    assert.strictEqual(getAggregatedBuckets(c, 365, 100, 60).length, 92);
});

test("getAggregatedBuckets - buckets start at round clock times", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2026-07-01 12:00:00");
    const c = createCalculator();

    // 24 minutes would fit 60 beats, half an hour fits evenly into an hour
    const wide = getAggregatedBuckets(c, 1, 60, 60);
    assert.strictEqual(wide.length, 48);
    assert.strictEqual(wide[0].end - wide[0].start, 30 * 60);

    // 44 minutes would fit 33 beats, a full hour is used instead
    const narrow = getAggregatedBuckets(c, 1, 33, 60);
    assert.strictEqual(narrow.length, 24);
    assert.strictEqual(narrow[0].end - narrow[0].start, 3600);

    // 22 hours would fit 33 beats, whole days are used instead
    const month = getAggregatedBuckets(c, 30, 33, 60);
    assert.strictEqual(month.length, 30);
    assert.strictEqual(month[0].end - month[0].start, 86400);
});

test("getAggregatedBuckets - slow check interval caps the bucket count", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2026-07-01 12:00:00");
    const c = createCalculator();

    // A monitor checked every 2 hours can only fill 12 buckets in a day
    assert.strictEqual(getAggregatedBuckets(c, 1, 100, 7200).length, 12);
});

test("getAggregatedBuckets - interval that is not a whole number of hours leaves no gaps", async (t) => {
    const currentTime = dayjs.utc("2026-07-01 12:20:00");
    const c = createCalculator();

    // Every 90 minutes at :10 and :40, so every third hour has no data
    for (let i = 26 * 60 + 40; i >= 0; i -= 90) {
        UptimeCalculator.currentDate = currentTime.subtract(i, "minute");
        await c.update(UP);
    }
    UptimeCalculator.currentDate = currentTime;

    const buckets = getAggregatedBuckets(c, 1, 100, 5400);

    // The newest bucket only started at 12:00 and has no check until 12:40
    for (const [i, bucket] of buckets.slice(0, -1).entries()) {
        assert.ok(bucket.up > 0, `Bucket ${i} is empty`);
    }
});

test("getAggregatedBuckets - buckets tile the requested range without gaps", async (t) => {
    const currentTime = dayjs.utc("2026-07-01 12:00:00");
    UptimeCalculator.currentDate = currentTime;
    const c = createCalculator();

    const buckets = getAggregatedBuckets(c, 7, 100, 60);
    const newest = buckets[buckets.length - 1];

    assert.ok(newest.start <= currentTime.unix() && currentTime.unix() < newest.end, "Newest bucket should hold now");
    assert.ok(newest.end - buckets[0].start >= 7 * 86400, "Buckets should span the whole range");

    for (let i = 0; i < buckets.length - 1; i++) {
        assert.strictEqual(buckets[i].end, buckets[i + 1].start, `Gap between bucket ${i} and ${i + 1}`);
    }
});

test("getAggregatedBuckets - an outage is counted in the bucket that covers it", async (t) => {
    const base = dayjs.utc("2026-07-01 00:00:00");
    const c = createCalculator();

    // Checked every minute until 12:07, down from 08:52 to 09:20
    for (let i = 0; i <= 12 * 60 + 7; i++) {
        UptimeCalculator.currentDate = base.add(i, "minute");
        await c.update(i >= 8 * 60 + 52 && i <= 9 * 60 + 20 ? DOWN : UP);
    }

    const outageStart = base.add(8 * 60 + 52, "minute").unix();
    const outageEnd = base.add(9 * 60 + 21, "minute").unix();

    for (const days of [1, 3, 7]) {
        const downBuckets = getAggregatedBuckets(c, days, 100, 60).filter((b) => b.down > 0);

        assert.ok(downBuckets.length > 0);
        for (const bucket of downBuckets) {
            assert.ok(
                bucket.start < outageEnd && bucket.end > outageStart,
                `${days} days: bucket ${dayjs.unix(bucket.start).utc().format("HH:mm")}-${dayjs.unix(bucket.end).utc().format("HH:mm")} does not overlap the outage`
            );
        }
    }
});

test("getAggregatedBuckets - bucket edges do not move between requests", async (t) => {
    const c = createCalculator();

    UptimeCalculator.currentDate = dayjs.utc("2026-07-01 12:07:00");
    const first = getAggregatedBuckets(c, 7, 100, 60);
    UptimeCalculator.currentDate = dayjs.utc("2026-07-01 12:08:00");
    const second = getAggregatedBuckets(c, 7, 100, 60);

    assert.deepStrictEqual(
        second.map((b) => b.start),
        first.map((b) => b.start)
    );
});

test("getAggregatedBuckets - a period without data stays empty, the rest does not", async (t) => {
    const currentTime = dayjs.utc("2026-07-01 12:00:00");
    UptimeCalculator.currentDate = currentTime;
    const c = createCalculator();

    // Populate 10 days of hourly data, leaving a gap between 6 and 4 days ago
    for (let i = 0; i < 240; i++) {
        if (i > 96 && i <= 144) {
            continue;
        }
        UptimeCalculator.currentDate = currentTime.subtract(i, "hour");
        await c.update(UP);
    }
    UptimeCalculator.currentDate = currentTime;

    const buckets = getAggregatedBuckets(c, 10, 100, 60);
    const gapStart = currentTime.unix() - 6 * 86400;
    const gapEnd = currentTime.unix() - 4 * 86400;

    for (const [i, bucket] of buckets.entries()) {
        if (bucket.start >= gapStart && bucket.end <= gapEnd) {
            assert.strictEqual(bucket.up, 0, `Bucket ${i} inside the gap should be empty`);
        } else if (bucket.end <= gapStart || bucket.start >= gapEnd) {
            assert.ok(bucket.up > 0, `Bucket ${i} outside the gap should have data`);
        }
    }
});

test("getAggregatedBuckets - partial downtime keeps both up and down counts", async (t) => {
    const currentTime = dayjs.utc("2026-07-01 12:00:00");
    UptimeCalculator.currentDate = currentTime;
    const c = createCalculator();

    for (let i = 0; i < 35; i++) {
        UptimeCalculator.currentDate = currentTime.subtract(i, "day").hour(10);
        await c.update(UP);
        if (i === 5) {
            await c.update(DOWN);
        }
    }
    UptimeCalculator.currentDate = currentTime;

    const buckets = getAggregatedBuckets(c, 35, 100, 60);
    const mixed = buckets.filter((b) => b.up > 0 && b.down > 0);

    assert.strictEqual(mixed.length, 1);
    assert.strictEqual(mixed[0].up, 1);
    assert.strictEqual(mixed[0].down, 1);
});

test("getAggregatedBuckets - monitor without data yields only empty buckets", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2026-07-01 12:00:00");
    const c = createCalculator();

    const buckets = getAggregatedBuckets(c, 35, 100, 60);

    assert.strictEqual(buckets.length, 35);
    for (const bucket of buckets) {
        assert.strictEqual(bucket.up + bucket.down + bucket.maintenance, 0);
    }
});

test("getAggregatedBuckets - beat on a bucket edge is not dropped", async (t) => {
    // Exactly on a bucket boundary, so the current key starts the newest bucket
    const currentTime = dayjs.utc("2026-07-01 12:00:00");
    UptimeCalculator.currentDate = currentTime;
    const c = createCalculator();

    await c.update(1); // key 12:00:00
    UptimeCalculator.currentDate = currentTime.subtract(90, "minute");
    await c.update(1);
    UptimeCalculator.currentDate = currentTime;

    const buckets = getAggregatedBuckets(c, 1, 100, 60);
    const totalUp = buckets.reduce((sum, b) => sum + b.up, 0);

    assert.strictEqual(totalUp, 2);
});

test("getAggregatedBuckets - maintenance is aggregated on the hourly tier", async (t) => {
    const currentTime = dayjs.utc("2026-07-01 12:00:00");
    UptimeCalculator.currentDate = currentTime;
    const c = createCalculator();

    UptimeCalculator.currentDate = currentTime.subtract(3, "hour");
    await c.update(MAINTENANCE);
    UptimeCalculator.currentDate = currentTime;

    const buckets = getAggregatedBuckets(c, 2, 100, 60);
    const maintenance = buckets.filter((b) => b.maintenance > 0);

    assert.strictEqual(maintenance.length, 1);
});
