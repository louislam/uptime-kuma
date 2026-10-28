/**
 * Aggregate UptimeCalculator data into fixed-width, time-anchored buckets for
 * the status page heartbeat bar.
 *
 * The data arrays returned by UptimeCalculator are sparse: periods without any
 * stored stat are simply missing. Buckets are therefore never narrower than
 * the stored tier (per minute for 1 day, hourly up to 30 days, daily above) nor than the
 * monitor's check interval rounded up to whole tier periods, so every bucket in
 * the requested range contains at least one stored period and empty beats can
 * only mean "no data recorded".
 *
 * Buckets hold whole tier periods and their edges sit on multiples of the
 * bucket width, so every stored period falls into exactly one bucket and the
 * edges stay put between requests. The width fits evenly into an hour or a
 * day, so the edges land on round clock times. The newest bucket holds the
 * current time once it has a check, until then the bar ends one bucket earlier.
 * @param {object} uptimeCalculator UptimeCalculator instance of the monitor
 * @param {number} days Number of days to cover, counting back from now (1-365)
 * @param {number} maxBeats Upper limit for the number of buckets
 * @param {number} interval Check interval of the monitor in seconds
 * @returns {Array<{start: number, end: number, up: number, down: number, maintenance: number}>} Buckets in ascending time order
 */
function getAggregatedBuckets(uptimeCalculator, days, maxBeats = 100, interval = 60) {
    // UptimeCalculator keeps per-minute stats for 24 hours, hourly ones for 30
    // days and daily ones for a year
    let tier;
    if (days <= 1) {
        tier = { type: "minute", seconds: 60, kept: 1440 };
    } else if (days <= 30) {
        tier = { type: "hour", seconds: 3600, kept: 720 };
    } else {
        tier = { type: "day", seconds: 86400, kept: 365 };
    }
    const tierSeconds = tier.seconds;
    const rangePeriods = (days * 86400) / tierSeconds;

    // Never create more buckets than the stored tier (or a slow check
    // interval) can fill, otherwise the in-between buckets stay empty. A 90
    // minute interval leaves every third hour empty, so it needs 2 hour buckets
    const minPeriods = Math.max(1, Math.ceil((interval || 0) / tierSeconds));
    let periodsPerBucket = Math.max(minPeriods, Math.ceil(rangePeriods / maxBeats));

    // Grow the size until it fits evenly into an hour, is whole hours that fit
    // evenly into a day, or is whole days, so the buckets start at round
    // clock times
    const isRound = (seconds) => {
        if (seconds < 3600) {
            return 3600 % seconds === 0;
        }
        if (seconds < 86400) {
            return seconds % 3600 === 0 && 86400 % seconds === 0;
        }
        return seconds % 86400 === 0;
    };
    while (!isRound(periodsPerBucket * tierSeconds)) {
        periodsPerBucket++;
    }
    const bucketSeconds = periodsPerBucket * tierSeconds;
    const bucketCount = Math.ceil(rangePeriods / periodsPerBucket);

    const now = uptimeCalculator.getCurrentDate().unix();
    const end = (Math.floor(now / bucketSeconds) + 1) * bucketSeconds;
    // One extra bucket at the old end, used while the newest one has no check yet
    const start = end - (bucketCount + 1) * bucketSeconds;

    const periods = Math.floor((now - start) / tierSeconds) + 1;
    const dataPoints = uptimeCalculator.getDataArray(Math.min(periods, tier.kept), tier.type);

    const buckets = [];
    for (let i = 0; i <= bucketCount; i++) {
        buckets.push({
            start: start + i * bucketSeconds,
            end: start + (i + 1) * bucketSeconds,
            up: 0,
            down: 0,
            maintenance: 0,
        });
    }

    for (const point of dataPoints) {
        const bucket = buckets[Math.floor((point.timestamp - start) / bucketSeconds)];
        if (bucket) {
            bucket.up += point.up || 0;
            bucket.down += point.down || 0;
            bucket.maintenance += point.maintenance || 0;
        }
    }

    // Like a new beat in auto mode, the newest bucket only shows up once a
    // check landed in it. Until then the bar ends one bucket earlier
    const newest = buckets[buckets.length - 1];
    if (newest.up + newest.down + newest.maintenance === 0) {
        buckets.pop();
    } else {
        buckets.shift();
    }

    return buckets;
}

module.exports = {
    getAggregatedBuckets,
};
