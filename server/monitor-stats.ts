import { R } from "redbean-node";
import dayjs from "dayjs";
import { z } from "zod";
import { socketRoom } from "./heartbeat-emit";

const MINUTE = 60;
const DAY = 86400;
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const CHUNK_SIZE = 500;

/** Dashboard uptime and ping numbers for a single monitor */
export interface MonitorStatsResult {
    avgPing: number | null;
    uptime24: number;
    uptime720: number;
    uptime1y: number;
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

type StatSumRow = z.infer<typeof statSumRowSchema>;

/**
 * Dashboard-level uptime/ping numbers for many monitors at once.
 * Uses grouped SQL instead of loading every stat bucket into memory.
 */
export class MonitorStats {
    /** monitorID -> latest stats */
    static cache = new Map<number, MonitorStatsResult>();

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
    private static toUptime(sum?: StatSumRow): { uptime: number; avgPing: number | null } {
        const up = Number(sum?.up) || 0;
        const down = Number(sum?.down) || 0;
        const pingSum = Number(sum?.ping_sum) || 0;
        return {
            uptime: up + down === 0 ? 0 : up / (up + down),
            avgPing: up === 0 ? null : pingSum / up,
        };
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
     * Compute 24h / 30d / 1y stats for all monitors with two grouped queries
     * @param monitorIDs Monitor ids
     * @param now Current time (tests)
     * @returns monitorID -> stats
     */
    static async compute(
        monitorIDs: Array<number | string>,
        now: dayjs.Dayjs = dayjs.utc()
    ): Promise<Record<number, MonitorStatsResult>> {
        const ids = monitorIdsSchema.parse(monitorIDs);
        const unix = now.unix();
        const minuteKey = Math.floor(unix / MINUTE) * MINUTE;
        const dayKey = Math.floor(unix / DAY) * DAY;
        const minutelySince = minuteKey - MINUTE * (1440 - 1);
        const monthSince = dayKey - DAY * (30 - 1);
        const yearSince = dayKey - DAY * (365 - 1);

        const [minutely, daily] = await Promise.all([
            MonitorStats.sumStats("stat_minutely", ids, minutelySince),
            MonitorStats.sumDailyWindows(ids, monthSince, yearSince),
        ]);

        const result: Record<number, MonitorStatsResult> = {};
        for (const monitorID of ids) {
            const data24 = MonitorStats.toUptime(minutely.get(monitorID));
            const days = daily.get(monitorID);
            const uptime30 =
                (days?.up30 ?? 0) + (days?.down30 ?? 0) === 0
                    ? 0
                    : (days?.up30 ?? 0) / ((days?.up30 ?? 0) + (days?.down30 ?? 0));
            const uptime1y =
                (days?.up1y ?? 0) + (days?.down1y ?? 0) === 0
                    ? 0
                    : (days?.up1y ?? 0) / ((days?.up1y ?? 0) + (days?.down1y ?? 0));
            result[monitorID] = {
                avgPing: data24.avgPing === null ? null : Number(data24.avgPing.toFixed(2)),
                uptime24: data24.uptime,
                uptime720: uptime30,
                uptime1y,
            };
        }
        return result;
    }

    /**
     * Reload the stats cache. Single flight: logins, beats and the periodic
     * refresh all share one aggregate scan instead of starting competing scans.
     * @param monitorIDs Monitor ids
     * @returns monitorID -> stats
     */
    static async refresh(monitorIDs: Array<number | string>): Promise<Record<number, MonitorStatsResult>> {
        if (MonitorStats.refreshPromise) {
            return MonitorStats.refreshPromise;
        }
        const ids = monitorIdsSchema.parse(monitorIDs);
        MonitorStats.refreshPromise = (async () => {
            const stats = await MonitorStats.compute(ids);
            for (const monitorID of ids) {
                MonitorStats.cache.set(monitorID, stats[monitorID]);
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
