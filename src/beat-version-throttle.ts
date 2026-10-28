/**
 * Coalesce heartbeat version bumps: thousands of beats arrive every minute and
 * each one may want to refresh the counters, but once per interval is enough.
 */
export class BeatVersionThrottle {
    private timer: ReturnType<typeof setTimeout> | null = null;

    /**
     * @param bump Called at most once per interval
     * @param delayMs Minimum time between bumps
     */
    constructor(
        private readonly bump: () => void,
        private readonly delayMs = 1000
    ) {}

    /**
     * Request a bump, ignored while one is already pending
     * @returns void
     */
    schedule(): void {
        if (this.timer) {
            return;
        }
        this.timer = setTimeout(() => {
            this.timer = null;
            this.bump();
        }, this.delayMs);
    }

    /**
     * Drop a pending bump
     * @returns void
     */
    cancel(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
}
