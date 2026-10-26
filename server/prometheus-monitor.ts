import { MonitorStats } from "./monitor-stats";

interface PrometheusTarget {
    update: (heartbeat: unknown, tlsInfo: unknown, uptime: unknown) => void;
}

/**
 * Feed the prometheus gauges from the grouped stats cache.
 * Loads no stat history: without a cache entry the uptime gauges are skipped.
 * @param prometheus Prometheus wrapper of the monitor
 * @param monitorID Monitor id
 * @param heartbeat Stored heartbeat
 * @param tlsInfo Certificate info of the beat
 * @returns True when cached stats were passed
 */
export function updatePrometheusStats(
    prometheus: PrometheusTarget,
    monitorID: number,
    heartbeat: unknown,
    tlsInfo: unknown
): boolean {
    const stats = MonitorStats.get(monitorID);

    prometheus.update(
        heartbeat,
        tlsInfo,
        stats
            ? {
                  data24h: { uptime: stats.uptime24, avgPing: stats.avgPing ?? 0 },
                  data30d: { uptime: stats.uptime720, avgPing: stats.avgPing ?? 0 },
                  data1y: { uptime: stats.uptime1y, avgPing: stats.avgPing ?? 0 },
              }
            : null
    );

    return Boolean(stats);
}
