/**
 * Shared helpers for monitor response-time chart periods.
 * Used by the authenticated socket handler and the public status-page chart API.
 */

/** Periods exposed by PingChart (hours), excluding "Recent" (0) which uses heartbeats. */
const PING_CHART_PERIODS_HOURS = Object.freeze([3, 6, 24, 168]);

/**
 * @param {number} period Period in hours
 * @returns {boolean} Whether this period is offered by PingChart (excluding Recent)
 */
function isPingChartPeriod(period) {
    return PING_CHART_PERIODS_HOURS.includes(period);
}

/**
 * Resolve aggregated chart series for a period, matching getMonitorChartData.
 * @param {{ getDataArray: Function }} uptimeCalculator Calculator for the monitor
 * @param {number} period Period in hours
 * @returns {object[]} Chart datapoints
 */
function getChartDataArrayForPeriod(uptimeCalculator, period) {
    if (period <= 24) {
        return uptimeCalculator.getDataArray(period * 60, "minute");
    }
    if (period <= 720) {
        return uptimeCalculator.getDataArray(period, "hour");
    }
    return uptimeCalculator.getDataArray(period / 24, "day");
}

module.exports = {
    PING_CHART_PERIODS_HOURS,
    isPingChartPeriod,
    getChartDataArrayForPeriod,
};
