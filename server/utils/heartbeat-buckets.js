/**
 * Aggregate UptimeCalculator data into fixed-width, time-anchored buckets for
 * the status page heartbeat bar.
 *
 * The data arrays returned by UptimeCalculator are sparse: periods without any
 * stored stat are simply missing. Buckets are therefore never narrower than
 * the stored tier (hourly for ranges up to 30 days, daily above) nor than the
 * monitor's check interval rounded up to whole tier periods, so every bucket in
 * the requested range contains at least one stored period and empty beats can
 * only mean "no data recorded".
 *
 * Buckets hold whole tier periods and their edges sit on multiples of the
 * bucket width, so every stored period falls into exactly one bucket and the
 * edges stay put between requests. The newest bucket holds the current time.
 * @param {object} uptimeCalculator UptimeCalculator instance of the monitor
 * @param {number} days Number of days to cover, counting back from now (1-365)
 * @param {number} maxBeats Upper limit for the number of buckets
 * @param {number} interval Check interval of the monitor in seconds
 * @returns {Array<{start: number, end: number, up: number, down: number, maintenance: number}>} Buckets in ascending time order
 */
function getAggregatedBuckets(uptimeCalculator, days, maxBeats = 100, interval = 60) {
    const useDailyTier = days > 30;
    const tierSeconds = useDailyTier ? 86400 : 3600;
    const rangePeriods = (days * 86400) / tierSeconds;

    // Never create more buckets than the stored tier (or a slow check
    // interval) can fill, otherwise the in-between buckets stay empty. A 90
    // minute interval leaves every third hour empty, so it needs 2 hour buckets
    const minPeriods = Math.max(1, Math.ceil((interval || 0) / tierSeconds));
    const periodsPerBucket = Math.max(minPeriods, Math.ceil(rangePeriods / maxBeats));
    const bucketSeconds = periodsPerBucket * tierSeconds;
    const bucketCount = Math.ceil(rangePeriods / periodsPerBucket);

    const now = uptimeCalculator.getCurrentDate().unix();
    const end = (Math.floor(now / bucketSeconds) + 1) * bucketSeconds;
    const start = end - bucketCount * bucketSeconds;

    const periods = Math.floor((now - start) / tierSeconds) + 1;
    let dataPoints;
    if (useDailyTier) {
        dataPoints = uptimeCalculator.getDataArray(Math.min(periods, 365), "day");
    } else {
        dataPoints = uptimeCalculator.getDataArray(Math.min(periods, 720), "hour");
    }

    const buckets = [];
    for (let i = 0; i < bucketCount; i++) {
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

    return buckets;
}

module.exports = {
    getAggregatedBuckets,
};
