const { R } = require("redbean-node");
const dayjs = require("dayjs");

/**
 * Utility functions for heartbeat range handling
 */

/**
 * Parse heartbeat range string and return hours
 * @param {string} range - Range string like "6h", "7d", "auto"
 * @returns {number|null} Hours or null for auto
 */
function parseRangeHours(range) {
    if (!range || range === "auto") {
        return null;
    }
    
    if (range.endsWith("h")) {
        return parseInt(range);
    } else if (range.endsWith("d")) {
        return parseInt(range) * 24;
    }
    
    // Fallback
    return 90 * 24;
}

/**
 * Get aggregated heartbeat data using stat tables for better performance
 * @param {number} monitorId - Monitor ID
 * @param {string} range - Range string like "6h", "7d", "auto"
 * @returns {Promise<Array>} Aggregated heartbeat data
 */
async function getAggregatedHeartbeatData(monitorId, range) {
    if (!range || range === "auto") {
        // Fall back to regular heartbeat query for auto mode
        return null;
    }
    
    const now = dayjs();
    const hours = parseRangeHours(range);
    
    if (hours <= 24) {
        // Use hourly stats for ranges up to 24 hours
        const startTime = now.subtract(hours, "hours");
        const timestampKey = Math.floor(startTime.valueOf() / (60 * 60 * 1000)) * (60 * 60 * 1000);
        
        const stats = await R.getAll(`
            SELECT * FROM stat_hourly 
            WHERE monitor_id = ? AND timestamp >= ? 
            ORDER BY timestamp ASC
        `, [monitorId, timestampKey]);
        
        // Convert to heartbeat-like format
        return stats.map(stat => ({
            time: dayjs(stat.timestamp).format("YYYY-MM-DD HH:mm:ss"),
            status: stat.up > 0 ? 1 : (stat.down > 0 ? 0 : 1), // Simplified status logic
            up: stat.up,
            down: stat.down,
            ping: stat.ping
        }));
    } else {
        // Use daily stats for ranges over 24 hours
        const days = Math.ceil(hours / 24);
        const startTime = now.subtract(days, "days");
        const timestampKey = Math.floor(startTime.valueOf() / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
        
        const stats = await R.getAll(`
            SELECT * FROM stat_daily 
            WHERE monitor_id = ? AND timestamp >= ? 
            ORDER BY timestamp ASC
        `, [monitorId, timestampKey]);
        
        // Convert to heartbeat-like format
        return stats.map(stat => ({
            time: dayjs(stat.timestamp).format("YYYY-MM-DD HH:mm:ss"),
            status: stat.up > 0 ? 1 : (stat.down > 0 ? 0 : 1), // Simplified status logic
            up: stat.up,
            down: stat.down,
            ping: stat.ping
        }));
    }
}

module.exports = {
    parseRangeHours,
    getAggregatedHeartbeatData
};