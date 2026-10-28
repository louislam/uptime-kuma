export interface DeferredListsOptions {
    /** Send the heavy lists once */
    send: () => Promise<void>;
    /** Report a failed send */
    onError: (error: Error) => void;
    /** Fallback delay for clients that never signal */
    fallbackMs?: number;
    setTimer?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
    clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
}

/**
 * Sends the heartbeat/stats lists after the client painted the dashboard,
 * with a timer fallback for clients that never signal. Runs at most once.
 */
export class DeferredListsSender {
    private sent = false;
    private fallback: ReturnType<typeof setTimeout> | null = null;

    constructor(private readonly options: DeferredListsOptions) {
        const setTimer = options.setTimer ?? setTimeout;
        this.fallback = setTimer(() => this.run(), options.fallbackMs ?? 5000);
    }

    /** Client signalled that the dashboard was painted */
    onRendered = (): void => {
        this.run();
    };

    /**
     * Cancel the fallback timer, e.g. when the socket disconnects
     * @returns void
     */
    dispose(): void {
        if (this.fallback) {
            const clearTimer = this.options.clearTimer ?? clearTimeout;
            clearTimer(this.fallback);
            this.fallback = null;
        }
    }

    private run(): void {
        if (this.sent) {
            return;
        }
        this.sent = true;
        this.dispose();
        this.options.send().catch((error) => this.options.onError(error));
    }
}
