export interface ProgressClock {
    setTimeout(fn: () => void, ms: number): unknown;
    clearTimeout(handle: unknown): void;
    setInterval(fn: () => void, ms: number): unknown;
    clearInterval(handle: unknown): void;
}

/** Progress shown as soon as the dashboard route is reached */
export const ROUTE_PROGRESS = 8;
/** Delay before the overlay appears, to avoid flashing on fast loads */
export const SHOW_DELAY_MS = 150;
/** Never let the overlay outlive a stalled connection */
export const SAFETY_MS = 15000;
export const CREEP_INTERVAL_MS = 100;
/** Delay between filling the bar and hiding it */
export const FINISH_DELAY_MS = 250;
/** The bar crawls up to this value while waiting for the server */
export const MAX_CREEP = 90;

const defaultClock: ProgressClock = {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (handle) => clearTimeout(handle),
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (handle) => clearInterval(handle),
};

/**
 * State machine of the dashboard loading bar.
 * Owns the timers so the behaviour can be tested without mounting the app.
 */
export class DashboardProgress {
    visible = false;
    value = 0;

    private showTimer: unknown = null;
    private finishTimer: unknown = null;
    private safetyTimer: unknown = null;
    private creepTimer: unknown = null;

    constructor(
        private readonly onChange: () => void = () => {},
        private readonly clock: ProgressClock = defaultClock
    ) {}

    /**
     * Progress to use for a route change
     * @param path New route path
     * @param current Current global progress
     * @returns Progress after the route change
     */
    routeProgress(path: string, current: number): number {
        if (path === "/dashboard" && !current) {
            return ROUTE_PROGRESS;
        }
        return current;
    }

    /**
     * Apply a real progress update from the socket events
     * @param progress Progress 0-100
     * @returns void
     */
    update(progress: number): void {
        if (progress >= 100) {
            this.finish();
            return;
        }
        if (progress <= 0) {
            this.reset();
            return;
        }

        this.value = Math.max(this.value, progress);

        if (!this.visible) {
            this.clock.clearTimeout(this.showTimer);
            this.showTimer = this.clock.setTimeout(() => {
                this.visible = true;
                this.startCreep();
                this.clock.clearTimeout(this.safetyTimer);
                this.safetyTimer = this.clock.setTimeout(() => {
                    this.visible = false;
                    this.emit();
                }, SAFETY_MS);
                this.emit();
            }, SHOW_DELAY_MS);
        }

        this.emit();
    }

    /**
     * Crawl toward the maximum while waiting for the server
     * @returns void
     */
    startCreep(): void {
        this.clock.clearInterval(this.creepTimer);
        this.creepTimer = this.clock.setInterval(() => {
            if (this.value < MAX_CREEP) {
                const step = Math.max(0.4, (MAX_CREEP - this.value) * 0.03);
                this.value = Math.min(MAX_CREEP, this.value + step);
                this.emit();
            }
        }, CREEP_INTERVAL_MS);
    }

    /**
     * Fill the bar, then hide it shortly after
     * @returns void
     */
    finish(): void {
        this.clearTimers();
        this.value = 100;
        this.emit();
        this.finishTimer = this.clock.setTimeout(() => {
            this.visible = false;
            this.emit();
        }, FINISH_DELAY_MS);
    }

    /**
     * Hide the overlay and reset the bar
     * @returns void
     */
    reset(): void {
        this.clearTimers();
        this.visible = false;
        this.value = 0;
        this.emit();
    }

    /**
     * Clear all pending timers
     * @returns void
     */
    clearTimers(): void {
        this.clock.clearTimeout(this.showTimer);
        this.clock.clearTimeout(this.finishTimer);
        this.clock.clearTimeout(this.safetyTimer);
        this.clock.clearInterval(this.creepTimer);
        this.showTimer = null;
        this.finishTimer = null;
        this.safetyTimer = null;
        this.creepTimer = null;
    }

    private emit(): void {
        this.onChange();
    }
}
