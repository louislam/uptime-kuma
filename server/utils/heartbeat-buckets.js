/**
 * Aggregate UptimeCalculator data into fixed-width, time-anchored buckets for
 * the status page heartbeat bar.
 *
 * The data arrays returned by UptimeCalculator are sparse: periods without any
 * stored stat are simply missing. Buckets are therefore never narrower than
 * the stored tier (hourly for ranges up to 30 days, daily above) nor than the
 * monitor's check interval, so every bucket in the requested range contains at
 * least one stored period and empty beats can only mean "no data recorded".
 * @param {object} uptimeCalculator UptimeCalculator instance of the monitor
 * @param {number} days Number of days to cover, counting back from now (1-365)
 * @param {number} maxBeats Upper limit for the number of buckets
 * @param {number} interval Check interval of the monitor in seconds
 * @returns {Array<{start: number, end: number, up: number, down: number, maintenance: number}>} Buckets in ascending time order
 */
function getAggregatedBuckets(uptimeCalculator, days, maxBeats = 100, interval = 60) {
    const useDailyTier = days > 30;
    const tierFloor = useDailyTier ? 86400 : 3600;
    const rangeSeconds = days * 86400;

    // Never create more buckets than the stored tier (or a slow check
    // interval) can fill, otherwise the in-between buckets stay empty
    const bucketFloor = Math.max(tierFloor, interval || 0);
    const bucketCount = Math.max(1, Math.min(maxBeats, Math.floor(rangeSeconds / bucketFloor)));
    const bucketSeconds = rangeSeconds / bucketCount;

    const end = uptimeCalculator.getCurrentDate().unix();
    const start = end - rangeSeconds;

    let dataPoints;
    if (useDailyTier) {
        dataPoints = uptimeCalculator.getDataArray(Math.min(days, 365), "day");
    } else {
        dataPoints = uptimeCalculator.getDataArray(Math.min(Math.ceil(days * 24), 720), "hour");
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

    // getDataArray returns the points newest first
    const sortedPoints = dataPoints.filter((point) => point && point.timestamp).sort((a, b) => a.timestamp - b.timestamp);

    // Single pass: points and buckets are both in ascending time order
    let bucketIndex = 0;
    for (const point of sortedPoints) {
        while (bucketIndex < buckets.length && point.timestamp >= buckets[bucketIndex].end) {
            bucketIndex++;
        }

        if (bucketIndex >= buckets.length) {
            break;
        }

        const bucket = buckets[bucketIndex];
        if (point.timestamp >= bucket.start) {
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
