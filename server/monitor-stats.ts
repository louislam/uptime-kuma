import { R } from "redbean-node";
import dayjs from "dayjs";
import { z } from "zod";
import { DOWN, PENDING, UP } from "../src/util";
import { socketRoom } from "./heartbeat-emit";
import { UptimeDataResult } from "./uptime-calculator";

const MINUTE = 60;
const DAY = 86400;
const MINUTES_PER_DAY = 24 * 60;
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const CHUNK_SIZE = 500;

/** Dashboard uptime and ping numbers for a single monitor */
export interface MonitorStatsResult {
    avgPing: number | null;
    uptime24: number;
    uptime720: number;
    uptime1y: number;
}

/** Raw up/down sums behind a cached result, kept so a beat can adjust them */
interface WindowSum {
    up: number;
    down: number;
    pingSum: number;
}

/** Window anchors and sums of a cached result */
interface StatsWindow {
    minuteKey: number;
    dayKey: number;
    minutely: WindowSum;
    daily30: WindowSum;
    daily365: WindowSum;
}

/** Minimal socket room emitter, avoids importing the full socket.io type */
interface RoomEmitter {
    to(room: string): { emit(event: string, payload: unknown): unknown };
}

const monitorIdsSchema = z.array(z.coerce.number().int().positive());

const statSumRowSchema = z.object({
    monitor_id: z.coerce.number().int(),
    up: z.coerce.number().nullable().optional(),
    down: z.coerce.number().nullable().optional(),
    ping_sum: z.coerce.number().nullable().optional(),
});

const windowSumSchema = z.object({
    up: z.coerce.number().nullable().optional(),
    down: z.coerce.number().nullable().optional(),
    ping_sum: z.coerce.number().nullable().optional(),
});

type StatSumRow = z.infer<typeof statSumRowSchema>;

/**
 * Dashboard-level uptime/ping numbers for many monitors at once.
 * Uses grouped SQL instead of loading every stat bucket into memory.
 */
export class MonitorStats {
    /** monitorID -> latest stats */
    static cache = new Map<number, MonitorStatsResult>();

    /** monitorID -> raw sums behind the cached stats */
    static windows = new Map<number, StatsWindow>();

    static lastRefresh = 0;

    /** In-flight aggregate scan, shared by every caller */
    static refreshPromise: Promise<Record<number, MonitorStatsResult>> | null = null;

    /**
     * Sum stat buckets for a set of monitors in one grouped query per chunk
     * @param table stat table name
     * @param monitorIDs Monitor ids
     * @param since Unix timestamp (seconds)
     * @returns monitorID -> sum row
     */
    private static async sumStats(table: string, monitorIDs: number[], since: number) {
        const result = new Map<number, StatSumRow>();
        for (let i = 0; i < monitorIDs.length; i += CHUNK_SIZE) {
            const chunk = monitorIDs.slice(i, i + CHUNK_SIZE);
            const placeholders = chunk.map(() => "?").join(",");
            const rows = await R.getAll(
                `SELECT monitor_id,
                        SUM(up) AS up,
                        SUM(down) AS down,
                        SUM(ping * up) AS ping_sum
                 FROM ${table}
                 WHERE timestamp >= ? AND monitor_id IN (${placeholders})
                 GROUP BY monitor_id`,
                [since, ...chunk]
            );
            for (const row of rows) {
                const parsed = statSumRowSchema.safeParse(row);
                if (parsed.success) {
                    result.set(parsed.data.monitor_id, parsed.data);
                }
            }
        }
        return result;
    }

    /**
     * Build the stat object from up/down/ping sums
     * @param sum Row from sumStats
     * @returns Uptime and average ping
     */
    private static toUptime(sum?: StatSumRow): UptimeDataResult {
        return UptimeDataResult.fromTotals(Number(sum?.up) || 0, Number(sum?.down) || 0, Number(sum?.ping_sum) || 0);
    }

    /**
     * Aggregate the daily table once for both the 30-day and the 1-year window
     * @param monitorIDs Monitor ids
     * @param monthSince Unix timestamp (seconds)
     * @param yearSince Unix timestamp (seconds)
     * @returns monitorID -> { up30, down30, up1y, down1y }
     */
    private static async sumDailyWindows(monitorIDs: number[], monthSince: number, yearSince: number) {
        const result = new Map<number, { up30: number; down30: number; up1y: number; down1y: number }>();
        for (let i = 0; i < monitorIDs.length; i += CHUNK_SIZE) {
            const chunk = monitorIDs.slice(i, i + CHUNK_SIZE);
            const placeholders = chunk.map(() => "?").join(",");
            const rows = await R.getAll(
                `SELECT monitor_id,
                        SUM(CASE WHEN timestamp >= ? THEN up ELSE 0 END) AS up30,
                        SUM(CASE WHEN timestamp >= ? THEN down ELSE 0 END) AS down30,
                        SUM(up) AS up1y,
                        SUM(down) AS down1y
                 FROM stat_daily
                 WHERE timestamp >= ? AND monitor_id IN (${placeholders})
                 GROUP BY monitor_id`,
                [monthSince, monthSince, yearSince, ...chunk]
            );
            for (const row of rows) {
                result.set(Number(row.monitor_id), {
                    up30: Number(row.up30) || 0,
                    down30: Number(row.down30) || 0,
                    up1y: Number(row.up1y) || 0,
                    down1y: Number(row.down1y) || 0,
                });
            }
        }
        return result;
    }

    /**
     * Compute 24h / 30d / 1y stats with two grouped queries
     * @param monitorIDs Monitor ids
     * @param now Current time (tests)
     * @returns Stats plus the raw sums behind them
     */
    static async collect(
        monitorIDs: Array<number | string>,
        now: dayjs.Dayjs = dayjs.utc()
    ): Promise<{ stats: Record<number, MonitorStatsResult>; windows: Map<number, StatsWindow> }> {
        const ids = monitorIdsSchema.parse(monitorIDs);
        const unix = now.unix();
        const minuteKey = Math.floor(unix / MINUTE) * MINUTE;
        const dayKey = Math.floor(unix / DAY) * DAY;
        const minutelySince = minuteKey - MINUTE * (MINUTES_PER_DAY - 1);
        const monthSince = dayKey - DAY * (30 - 1);
        const yearSince = dayKey - DAY * (365 - 1);

        const [minutely, daily] = await Promise.all([
            MonitorStats.sumStats("stat_minutely", ids, minutelySince),
            MonitorStats.sumDailyWindows(ids, monthSince, yearSince),
        ]);

        const stats: Record<number, MonitorStatsResult> = {};
        const windows = new Map<number, StatsWindow>();
        for (const monitorID of ids) {
            const minute = minutely.get(monitorID);
            const days = daily.get(monitorID);
            const data24 = MonitorStats.toUptime(minute);
            stats[monitorID] = {
                avgPing: data24.avgPing === null ? null : Number(data24.avgPing.toFixed(2)),
                uptime24: data24.uptime,
                uptime720: UptimeDataResult.fromTotals(Number(days?.up30) || 0, Number(days?.down30) || 0).uptime,
                uptime1y: UptimeDataResult.fromTotals(Number(days?.up1y) || 0, Number(days?.down1y) || 0).uptime,
            };
            windows.set(monitorID, {
                minuteKey,
                dayKey,
                minutely: {
                    up: Number(minute?.up) || 0,
                    down: Number(minute?.down) || 0,
                    pingSum: Number(minute?.ping_sum) || 0,
                },
                daily30: {
                    up: Number(days?.up30) || 0,
                    down: Number(days?.down30) || 0,
                    pingSum: 0,
                },
                daily365: {
                    up: Number(days?.up1y) || 0,
                    down: Number(days?.down1y) || 0,
                    pingSum: 0,
                },
            });
        }
        return { stats, windows };
    }

    /**
     * Reload the stats cache. Single flight: logins, beats and the periodic
     * refresh all share one aggregate scan instead of starting competing scans.
     * @param monitorIDs Monitor ids
     * @param now Current time (tests)
     * @returns monitorID -> stats
     */
    static async refresh(
        monitorIDs: Array<number | string>,
        now: dayjs.Dayjs = dayjs.utc()
    ): Promise<Record<number, MonitorStatsResult>> {
        if (MonitorStats.refreshPromise) {
            return MonitorStats.refreshPromise;
        }
        const ids = monitorIdsSchema.parse(monitorIDs);
        MonitorStats.refreshPromise = (async () => {
            const { stats, windows } = await MonitorStats.collect(ids, now);
            for (const monitorID of ids) {
                MonitorStats.cache.set(monitorID, stats[monitorID]);
                const window = windows.get(monitorID);
                if (window) {
                    MonitorStats.windows.set(monitorID, window);
                }
            }
            MonitorStats.lastRefresh = Date.now();
            return stats;
        })();
        try {
            return await MonitorStats.refreshPromise;
        } finally {
            MonitorStats.refreshPromise = null;
        }
    }

    /**
     * Fold one beat into the cached stats, so every window stays live
     * @param monitorID Monitor id
     * @param status Beat status
     * @param ping Beat ping
     * @param now Current time (tests)
     * @returns Updated stats, or undefined before the first refresh
     */
    static async recordBeat(
        monitorID: number | string,
        status: number,
        ping: number,
        now: dayjs.Dayjs = dayjs.utc()
    ): Promise<MonitorStatsResult | undefined> {
        const id = Number(monitorID);
        const window = MonitorStats.windows.get(id);
        const cached = MonitorStats.cache.get(id);
        if (!window || !cached) {
            return undefined;
        }

        await MonitorStats.expireWindow(id, window, now);

        if (status === UP) {
            window.minutely.up++;
            window.daily30.up++;
            window.daily365.up++;
            if (!Number.isNaN(ping)) {
                window.minutely.pingSum += ping;
            }
        } else if (status === DOWN || status === PENDING) {
            window.minutely.down++;
            window.daily30.down++;
            window.daily365.down++;
        }

        const data24 = UptimeDataResult.fromTotals(window.minutely.up, window.minutely.down, window.minutely.pingSum);
        cached.uptime24 = data24.uptime;
        cached.avgPing = data24.avgPing === null ? null : Number(data24.avgPing.toFixed(2));
        cached.uptime720 = UptimeDataResult.fromTotals(window.daily30.up, window.daily30.down).uptime;
        cached.uptime1y = UptimeDataResult.fromTotals(window.daily365.up, window.daily365.down).uptime;
        return cached;
    }

    /**
     * Drop the buckets that left the windows since the last beat
     * @param monitorID Monitor id
     * @param window Raw window sums
     * @param now Current time
     * @returns {Promise<void>}
     */
    private static async expireWindow(monitorID: number, window: StatsWindow, now: dayjs.Dayjs): Promise<void> {
        const unix = now.unix();
        const minuteKey = Math.floor(unix / MINUTE) * MINUTE;
        const dayKey = Math.floor(unix / DAY) * DAY;

        if (minuteKey > window.minuteKey) {
            const gap = minuteKey - window.minuteKey;
            const from = window.minuteKey - MINUTE * (MINUTES_PER_DAY - 1);
            window.minuteKey = minuteKey;
            if (gap >= MINUTES_PER_DAY * MINUTE) {
                // A day without beats means nothing is left in the 24h window
                window.minutely = { up: 0, down: 0, pingSum: 0 };
            } else {
                const expired = await MonitorStats.sumExpired(
                    "stat_minutely",
                    monitorID,
                    from,
                    minuteKey - MINUTE * (MINUTES_PER_DAY - 1)
                );
                window.minutely = MonitorStats.subtract(window.minutely, expired);
            }
        }

        if (dayKey > window.dayKey) {
            const gap = dayKey - window.dayKey;
            const oldDayKey = window.dayKey;
            window.dayKey = dayKey;
            const expired30 =
                gap >= 30 * DAY
                    ? { up: 0, down: 0, pingSum: 0 }
                    : await MonitorStats.sumExpired(
                          "stat_daily",
                          monitorID,
                          oldDayKey - DAY * (30 - 1),
                          dayKey - DAY * (30 - 1)
                      );
            const expired365 =
                gap >= 365 * DAY
                    ? { up: 0, down: 0, pingSum: 0 }
                    : await MonitorStats.sumExpired(
                          "stat_daily",
                          monitorID,
                          oldDayKey - DAY * (365 - 1),
                          dayKey - DAY * (365 - 1)
                      );
            // A full window without beats leaves nothing to subtract
            window.daily30 =
                gap >= 30 * DAY ? { up: 0, down: 0, pingSum: 0 } : MonitorStats.subtract(window.daily30, expired30);
            window.daily365 =
                gap >= 365 * DAY ? { up: 0, down: 0, pingSum: 0 } : MonitorStats.subtract(window.daily365, expired365);
        }
    }

    /**
     * Subtract the expired sums from a window, never going below zero
     * @param window Current sums
     * @param expired Expired sums
     * @returns Remaining sums
     */
    private static subtract(window: WindowSum, expired: WindowSum): WindowSum {
        return {
            up: Math.max(0, window.up - expired.up),
            down: Math.max(0, window.down - expired.down),
            pingSum: Math.max(0, window.pingSum - expired.pingSum),
        };
    }

    /**
     * Sum the stat buckets that fell out of a window
     * @param table stat table name
     * @param monitorID Monitor id
     * @param from First expired timestamp (inclusive)
     * @param to End of the expired range (exclusive)
     * @returns Expired sums
     */
    private static async sumExpired(table: string, monitorID: number, from: number, to: number): Promise<WindowSum> {
        const rows = await R.getAll(
            `SELECT SUM(up) AS up,
                    SUM(down) AS down,
                    SUM(ping * up) AS ping_sum
             FROM ${table}
             WHERE monitor_id = ? AND timestamp >= ? AND timestamp < ?`,
            [monitorID, from, to]
        );
        const parsed = windowSumSchema.safeParse(rows[0]);
        if (!parsed.success) {
            return { up: 0, down: 0, pingSum: 0 };
        }
        return {
            up: Number(parsed.data.up) || 0,
            down: Number(parsed.data.down) || 0,
            pingSum: Number(parsed.data.ping_sum) || 0,
        };
    }

    /**
     * Cached stats for a set of monitors, without ever starting a scan
     * @param monitorIDs Monitor ids
     * @returns monitorID -> stats (partial)
     */
    static getCached(monitorIDs: Array<number | string>): Record<number, MonitorStatsResult> {
        const result: Record<number, MonitorStatsResult> = {};
        for (const id of monitorIdsSchema.parse(monitorIDs)) {
            const cached = MonitorStats.cache.get(id);
            if (cached) {
                result[id] = cached;
            }
        }
        return result;
    }

    /**
     * Cached stats for one monitor (may be undefined before the first refresh)
     * @param monitorID Monitor id
     * @returns Stats
     */
    static get(monitorID: number | string): MonitorStatsResult | undefined {
        return MonitorStats.cache.get(Number(monitorID));
    }

    /**
     * Refresh all monitor stats when the cache is stale (fire and forget)
     * @param io Socket server
     * @param monitorIDs All monitor ids
     */
    static maybeRefresh(io: RoomEmitter, monitorIDs: Array<number | string>): void {
        if (Date.now() - MonitorStats.lastRefresh < REFRESH_INTERVAL_MS) {
            return;
        }
        MonitorStats.lastRefresh = Date.now();
        MonitorStats.refresh(monitorIDs)
            .then((stats) => io.to(socketRoom).emit("stats", stats))
            .catch(() => {
                MonitorStats.lastRefresh = 0;
            });
    }
}
