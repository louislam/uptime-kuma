const { test } = require("node:test");
const assert = require("node:assert");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const { UP, DOWN, MAINTENANCE } = require("../../src/util");
const { UptimeCalculator } = require("../../server/uptime-calculator");
const { getAggregatedBuckets } = require("../../server/utils/heartbeat-buckets");

dayjs.extend(utc);

test("getAggregatedBuckets - caps bucket count at tier resolution (no grey gaps from upsampling)", async (t) => {
    const currentTime = dayjs.utc("2026-07-01 12:00:00");
    UptimeCalculator.currentDate = currentTime;
    const c = new UptimeCalculator();

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

    for (const [ i, bucket ] of buckets.entries()) {
        assert.ok(bucket.up > 0, `Bucket ${i} is empty - this is the grey gap bug`);
    }
});

test("getAggregatedBuckets - bucket count at tier boundaries", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2026-07-01 12:00:00");
    const c = new UptimeCalculator();

    // 1 day on the hourly tier can never have more than 24 buckets
    assert.strictEqual(getAggregatedBuckets(c, 1, 100, 60).length, 24);

    // 30 days is still hourly (720 stored hours), so maxBeats is the limit
    assert.strictEqual(getAggregatedBuckets(c, 30, 100, 60).length, 100);

    // 31 days switches to the daily tier: one bucket per stored day
    assert.strictEqual(getAggregatedBuckets(c, 31, 100, 60).length, 31);

    // 365 days daily leaves several days per bucket, maxBeats is the limit
    assert.strictEqual(getAggregatedBuckets(c, 365, 100, 60).length, 100);
});

test("getAggregatedBuckets - slow check interval caps the bucket count", async (t) => {
    UptimeCalculator.currentDate = dayjs.utc("2026-07-01 12:00:00");
    const c = new UptimeCalculator();

    // A monitor checked every 2 hours can only fill 12 buckets in a day
    assert.strictEqual(getAggregatedBuckets(c, 1, 100, 7200).length, 12);
});

test("getAggregatedBuckets - buckets tile the requested range without gaps", async (t) => {
    const currentTime = dayjs.utc("2026-07-01 12:00:00");
    UptimeCalculator.currentDate = currentTime;
    const c = new UptimeCalculator();

    const buckets = getAggregatedBuckets(c, 7, 100, 60);

    assert.strictEqual(buckets[0].start, currentTime.unix() - 7 * 86400);
    assert.strictEqual(buckets[buckets.length - 1].end, currentTime.unix());

    for (let i = 0; i < buckets.length - 1; i++) {
        assert.strictEqual(buckets[i].end, buckets[i + 1].start, `Gap between bucket ${i} and ${i + 1}`);
    }
});

test("getAggregatedBuckets - a period without data stays empty, the rest does not", async (t) => {
    const currentTime = dayjs.utc("2026-07-01 12:00:00");
    UptimeCalculator.currentDate = currentTime;
    const c = new UptimeCalculator();

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

    for (const [ i, bucket ] of buckets.entries()) {
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
    const c = new UptimeCalculator();

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
    const c = new UptimeCalculator();

    const buckets = getAggregatedBuckets(c, 35, 100, 60);

    assert.strictEqual(buckets.length, 35);
    for (const bucket of buckets) {
        assert.strictEqual(bucket.up + bucket.down + bucket.maintenance, 0);
    }
});

test("getAggregatedBuckets - beat on the exact range end is not dropped", async (t) => {
    // Exactly on an hour boundary, so the current hourly key equals the range end
    const currentTime = dayjs.utc("2026-07-01 12:00:00");
    UptimeCalculator.currentDate = currentTime;
    const c = new UptimeCalculator();

    await c.update(1); // key 12:00:00 == end of the requested range
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
    const c = new UptimeCalculator();

    UptimeCalculator.currentDate = currentTime.subtract(3, "hour");
    await c.update(MAINTENANCE);
    UptimeCalculator.currentDate = currentTime;

    const buckets = getAggregatedBuckets(c, 1, 100, 60);
    const maintenance = buckets.filter((b) => b.maintenance > 0);

    assert.strictEqual(maintenance.length, 1);
});
