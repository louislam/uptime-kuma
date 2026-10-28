export interface StatsRefreshOptions {
    monitorIDs: Array<number | string>;
    refresh: (monitorIDs: Array<number | string>) => Promise<unknown>;
    onError: (error: Error) => void;
    initialDelayMs?: number;
    intervalMs?: number;
    setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
    setInterval?: (fn: () => void, ms: number) => ReturnType<typeof setInterval>;
}

/**
 * Warm the stats cache once after startup, then refresh it periodically.
 * Without it, every beat would load years of stat rows per monitor.
 * @param options Timers and the refresh implementation
 * @returns Handle to stop the timers
 */
export function startStatsRefresh(options: StatsRefreshOptions): { stop: () => void } {
    const setTimer = options.setTimer ?? setTimeout;
    const setIntervalFn = options.setInterval ?? setInterval;
    const run = () => {
        options.refresh(options.monitorIDs).catch((error) => options.onError(error));
    };

    const initial = setTimer(run, options.initialDelayMs ?? 5000);
    const interval = setIntervalFn(run, options.intervalMs ?? 15 * 60 * 1000);
    initial.unref?.();
    interval.unref?.();

    return {
        stop() {
            clearTimeout(initial);
            clearInterval(interval);
        },
    };
}
