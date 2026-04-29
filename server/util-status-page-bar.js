const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const { UP, DOWN } = require("../src/util");

dayjs.extend(utc);

/** fixed number of stripes on the public status-page bar */
const PUBLIC_BAR_SEGMENT_COUNT = 100;

const WINDOW_TO_ARRAY = {
    "24h": { num: 1440, type: "minute", stepSec: 60 },
    "7d": { num: 168, type: "hour", stepSec: 3600 },
    "30d": { num: 30, type: "day", stepSec: 86400 },
};

/**
 * build ~100 segments from UptimeCalculator for the same window as public uptime %
 * @param {*} uptimeCalculator monitor calculator
 * @param {string} uptimeWindow 24h | 7d | 30d
 * @returns {object[]} oldest-first pseudo-beats (toPublicJSON-shaped)
 */
function buildPublicStatusBarSegmentList(uptimeCalculator, uptimeWindow) {
    const cfg = WINDOW_TO_ARRAY[uptimeWindow] || WINDOW_TO_ARRAY["24h"];
    const raw = uptimeCalculator.getDataArray(cfg.num, cfg.type);
    const { num, type, stepSec } = cfg;

    const key = uptimeCalculator.getKey(uptimeCalculator.getCurrentDate(), type);
    let endTimestamp;
    if (type === "day") {
        endTimestamp = key - 86400 * (num - 1);
    } else if (type === "hour") {
        endTimestamp = key - 3600 * (num - 1);
    } else {
        endTimestamp = key - 60 * (num - 1);
    }

    const windowSpanSec = num * stepSec;
    const segmentWidth = windowSpanSec / PUBLIC_BAR_SEGMENT_COUNT;
    const aggregates = Array.from({ length: PUBLIC_BAR_SEGMENT_COUNT }, () => ({ up: 0, down: 0 }));

    for (const row of raw) {
        const ts = row.timestamp;
        if (ts < endTimestamp || ts > key) {
            continue;
        }
        let idx = Math.floor((ts - endTimestamp) / segmentWidth);
        if (idx < 0) {
            idx = 0;
        }
        if (idx >= PUBLIC_BAR_SEGMENT_COUNT) {
            idx = PUBLIC_BAR_SEGMENT_COUNT - 1;
        }
        aggregates[idx].up += row.up || 0;
        aggregates[idx].down += row.down || 0;
    }

    const beats = [];
    for (let i = 0; i < PUBLIC_BAR_SEGMENT_COUNT; i++) {
        const segStart = endTimestamp + i * segmentWidth;
        const { up, down } = aggregates[i];
        let status = null;
        if (down > 0) {
            status = DOWN;
        } else if (up > 0) {
            status = UP;
        }
        beats.push({
            status,
            time: dayjs.unix(segStart).utc().format("YYYY-MM-DD HH:mm:ss"),
            msg: "",
            ping: null,
        });
    }
    return beats;
}

module.exports = {
    buildPublicStatusBarSegmentList,
    PUBLIC_BAR_SEGMENT_COUNT,
};
