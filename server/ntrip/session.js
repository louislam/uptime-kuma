const { RtcmFrameReader, isObservationMessage } = require("./rtcm-frames");
const { formatGga } = require("./gga");
const { observationEpochUtc } = require("./correction-age");

/**
 * One persistent NTRIP connection with its own timers, recovery and disposal.
 *
 * The session owns connection state only. It never writes heartbeat rows,
 * sends notifications or touches the database: the monitor adapter reads
 * snapshot() on Uptime Kuma's own heartbeat schedule and reports from there.
 *
 * Every clock, random and I/O dependency is injected so recovery races can be
 * tested with virtual time instead of real sockets.
 */

/** Reconnect delays in milliseconds; the final value repeats. */
const BACKOFF_DELAYS_MS = [5000, 10000, 20000, 40000, 60000];

/** Fraction of the base delay added as positive random jitter. */
const JITTER_FRACTION = 0.2;

/**
 * Minimum wait after a rejection the caster is unlikely to reverse quickly.
 *
 * Covers rejected credentials and refusals such as a concurrent-session limit,
 * where retrying on the short backoff would reproduce the same answer and, for
 * a rate-limiting caster, prolong it.
 */
const REJECTION_COOLDOWN_MS = 60000;

/** Transport failure categories that must wait out the cooldown. */
const COOLDOWN_CODES = new Set(["AUTH", "BUSY"]);

/** Continuous healthy time required before the backoff sequence restarts. */
const HEALTHY_RESET_MS = 60000;

/** Interval between effective-maintenance evaluations. */
const GUARD_INTERVAL_MS = 1000;

/** Assumed gap between epochs until two have been seen. 1 Hz is the common rate. */
const DEFAULT_EPOCH_INTERVAL_MS = 1000;

class NtripSession {
    /**
     * @param {object} config Normalized NTRIP configuration
     * @param {object} dependencies Injected collaborators
     * @param {object} dependencies.clock Monotonic clock with now/utcNow/setTimeout/clearTimeout
     * @param {Function} dependencies.openTransport Transport factory
     * @param {Function} dependencies.isEligible Async predicate; false or rejection disposes the session
     * @param {Function} dependencies.random Random source in [0, 1)
     * @param {Function} dependencies.onDisposed Called exactly once when the session is disposed
     */
    constructor(config, dependencies) {
        this.config = config;
        this.clock = dependencies.clock;
        this.openTransport = dependencies.openTransport;
        this.isEligible = dependencies.isEligible;
        this.random = dependencies.random ?? Math.random;
        this.onDisposed = dependencies.onDisposed ?? (() => {});

        this.frames = new RtcmFrameReader({
            onFrame: (messageType, payload) => this.#onFrame(messageType, payload),
        });
        this.observedTypes = new Set();
        this.lastProgressAt = null;
        this.latestEpochUtcMs = null;
        this.arrivalLatencyMs = null;
        this.arrivalAt = null;
        this.epochIntervalMs = null;

        this.state = "idle";
        this.message = "Not started.";
        this.disposed = false;

        this.transport = null;
        this.transportClosed = true;
        this.attemptCounter = 0;
        this.currentAttemptId = 0;
        this.attemptTerminated = true;
        this.backoffIndex = 0;
        this.healthySince = null;

        this.guardTimer = null;
        this.retryTimer = null;
        this.deadlineTimer = null;
        this.deadlineMessage = null;
        this.ggaTimer = null;
    }

    /**
     * Begin connecting. Safe to call repeatedly; only the first call has effect.
     * @returns {void}
     */
    start() {
        if (this.disposed || this.state !== "idle") {
            return;
        }
        this.state = "connecting";
        this.message = "Connecting to caster.";
        this.#scheduleGuard();
        void this.#attemptConnection();
    }

    /**
     * Describe current session state. Performs no network or database work.
     * @returns {object} Snapshot with state, healthy, message, lastProgressAt and correctionAgeMs
     */
    snapshot() {
        // The stale deadline ends streaming as soon as observations stop, so
        // the state alone is the health.
        return {
            state: this.state,
            healthy: this.state === "streaming",
            message: this.message,
            lastProgressAt: this.lastProgressAt,
            correctionAgeMs: this.#correctionAgeMs(),
        };
    }

    /**
     * How old the latest observation was when it arrived, plus any time the
     * next one is overdue.
     *
     * Measuring at arrival keeps the value independent of when a heartbeat
     * reads it within the gap between epochs. Once the next epoch is later
     * than the stream's own interval, the wait is added, so a stream that
     * stalls shows a rising age instead of a gap. The value includes any error
     * in this server's clock and in the base receiver's clock. A negative age
     * can only come from such an error and is reported as 0.
     * @returns {number|null} Age in milliseconds, or null before the first observation
     */
    #correctionAgeMs() {
        if (this.latestEpochUtcMs === null) {
            return null;
        }
        const interval = this.epochIntervalMs ?? DEFAULT_EPOCH_INTERVAL_MS;
        const overdue = Math.max(0, this.clock.now() - this.arrivalAt - interval);
        return Math.max(0, Math.round(this.arrivalLatencyMs + overdue));
    }

    /**
     * Invalidate the session and release every resource. Idempotent.
     *
     * Invalidation happens before teardown so callbacks that are already queued
     * cannot revive the session or schedule new work.
     * @param {string} reason Message reported by later snapshots
     * @returns {void}
     */
    dispose(reason = "Session disposed.") {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.state = "disposed";
        this.message = reason;
        this.currentAttemptId = -1;

        this.#clearTimer("guardTimer");
        this.#clearTimer("retryTimer");
        this.#clearTimer("deadlineTimer");
        this.#clearTimer("ggaTimer");
        this.#closeTransport();
        this.#resetStream();

        try {
            this.onDisposed(this);
        } catch {
            // Ownership cleanup must never prevent the rest of disposal.
        }
    }

    /**
     * Clear a named timer handle if one is pending.
     * @param {string} name Property holding the handle
     * @returns {void}
     */
    #clearTimer(name) {
        if (this[name] !== null) {
            this.clock.clearTimeout(this[name]);
            this[name] = null;
        }
    }

    /**
     * Forget everything observed on the previous connection.
     * @returns {void}
     */
    #resetStream() {
        this.frames.reset();
        this.observedTypes.clear();
        this.lastProgressAt = null;
        this.latestEpochUtcMs = null;
        this.arrivalLatencyMs = null;
        this.arrivalAt = null;
        this.epochIntervalMs = null;
    }

    /**
     * Close the active transport at most once.
     * @returns {void}
     */
    #closeTransport() {
        if (this.transport && !this.transportClosed) {
            this.transportClosed = true;
            try {
                this.transport.close();
            } catch {
                // A transport that fails to close cannot block session teardown.
            }
        }
        this.transport = null;
    }

    /**
     * Schedule the next effective-maintenance evaluation.
     *
     * Exactly one evaluation is outstanding at a time: the next is scheduled
     * only after the previous one completes, so a slow lookup cannot pile up.
     * @returns {void}
     */
    #scheduleGuard() {
        if (this.disposed || this.guardTimer !== null) {
            return;
        }
        this.guardTimer = this.clock.setTimeout(() => {
            this.guardTimer = null;
            void this.#runGuard();
        }, GUARD_INTERVAL_MS);
    }

    /**
     * Evaluate eligibility and dispose the session when it no longer applies.
     * @returns {Promise<void>} Resolves once the evaluation has been handled
     */
    async #runGuard() {
        if (this.disposed) {
            return;
        }

        let eligible;
        try {
            eligible = await this.isEligible();
        } catch {
            // Failure to determine eligibility must never authorize a connection.
            this.dispose("Could not determine maintenance state; disconnected.");
            return;
        }

        if (this.disposed) {
            return;
        }
        if (!eligible) {
            this.dispose("Disconnected for scheduled maintenance.");
            return;
        }
        this.#scheduleGuard();
    }

    /**
     * Open one connection attempt after confirming eligibility.
     * @returns {Promise<void>} Resolves once the attempt has been started or abandoned
     */
    async #attemptConnection() {
        const attemptId = ++this.attemptCounter;
        this.currentAttemptId = attemptId;
        this.attemptTerminated = false;
        this.state = "connecting";
        this.message = "Connecting to caster.";

        let eligible;
        try {
            eligible = await this.isEligible();
        } catch {
            this.dispose("Could not determine maintenance state; not connecting.");
            return;
        }

        // Disposal or a newer attempt may have overtaken this one while awaiting.
        if (this.disposed || attemptId !== this.currentAttemptId) {
            return;
        }
        if (!eligible) {
            this.dispose("Not connecting during scheduled maintenance.");
            return;
        }

        this.#resetStream();
        this.healthySince = null;

        try {
            this.transport = this.openTransport(this.config, {
                onAccepted: () => this.#onAccepted(attemptId),
                onData: (chunk) => this.#onData(attemptId, chunk),
                onFailure: (error) => this.#onTerminal(attemptId, error),
            });
            this.transportClosed = false;
        } catch (error) {
            this.transport = null;
            this.transportClosed = true;
            this.#onTerminal(attemptId, error);
            return;
        }

        this.#setDeadline(
            this.config.handshakeTimeoutMs,
            `Handshake did not complete within ${Math.round(this.config.handshakeTimeoutMs / 1000)}s.`
        );
    }

    /**
     * Arm the current phase deadline, replacing any previous one.
     * @param {number} delayMs Deadline in milliseconds
     * @param {string} message Failure message used when it expires
     * @returns {void}
     */
    #setDeadline(delayMs, message) {
        this.#clearTimer("deadlineTimer");
        this.deadlineMessage = message;
        this.deadlineTimer = this.clock.setTimeout(() => {
            this.deadlineTimer = null;
            this.#onTerminal(this.currentAttemptId, new Error(this.deadlineMessage));
        }, delayMs);
    }

    /**
     * Handle the handshake being accepted by the caster.
     * @param {number} attemptId Attempt that produced the callback
     * @returns {void}
     */
    #onAccepted(attemptId) {
        if (!this.#isCurrent(attemptId)) {
            return;
        }
        this.state = "awaiting";
        this.message = "Connected; waiting for RTCM 3 observation messages.";
        this.#setDeadline(
            this.config.initialTimeoutMs,
            `No RTCM 3 observation messages within ${Math.round(this.config.initialTimeoutMs / 1000)}s of connecting.`
        );
        this.#startGga();
    }

    /**
     * Feed received bytes to the RTCM frame reader.
     * @param {number} attemptId Attempt that produced the callback
     * @param {Buffer} chunk Received bytes
     * @returns {void}
     */
    #onData(attemptId, chunk) {
        if (!this.#isCurrent(attemptId)) {
            return;
        }
        this.frames.write(chunk);
    }

    /**
     * Refresh the staleness deadline when a valid observation frame arrives.
     *
     * Frames that are not observations, such as station and antenna metadata,
     * are ignored: a base that has lost its satellites can keep sending those.
     * @param {number} messageType RTCM 3 message number of a CRC-valid frame
     * @param {Buffer} payload Frame payload
     * @returns {void}
     */
    #onFrame(messageType, payload) {
        if (this.disposed || this.attemptTerminated || !isObservationMessage(messageType)) {
            return;
        }

        const now = this.clock.now();
        this.lastProgressAt = now;
        this.observedTypes.add(messageType);

        // One epoch is usually sent as several messages, one per constellation.
        // Only the first message of a newer epoch marks its arrival.
        const nowUtcMs = this.clock.utcNow().getTime();
        const epochUtcMs = observationEpochUtc(messageType, payload, nowUtcMs);
        if (epochUtcMs !== null && (this.latestEpochUtcMs === null || epochUtcMs > this.latestEpochUtcMs)) {
            if (this.latestEpochUtcMs !== null) {
                this.epochIntervalMs = epochUtcMs - this.latestEpochUtcMs;
            }
            this.latestEpochUtcMs = epochUtcMs;
            this.arrivalLatencyMs = nowUtcMs - epochUtcMs;
            this.arrivalAt = now;
        }

        if (this.state !== "streaming") {
            this.state = "streaming";
            this.healthySince = now;
        }
        this.message = `Receiving RTCM 3 observations (${[...this.observedTypes].sort().join(", ")}).`;

        // A handshake alone never resets backoff; sustained health does.
        if (this.healthySince !== null && now - this.healthySince >= HEALTHY_RESET_MS) {
            this.backoffIndex = 0;
        }

        this.#setDeadline(
            this.config.staleTimeoutMs,
            `No RTCM 3 observation messages for ${Math.round(this.config.staleTimeoutMs / 1000)}s.`
        );
    }

    /**
     * Whether a callback belongs to the live attempt of a live session.
     * @param {number} attemptId Attempt that produced the callback
     * @returns {boolean} True when the callback should be honoured
     */
    #isCurrent(attemptId) {
        return !this.disposed && !this.attemptTerminated && attemptId === this.currentAttemptId;
    }

    /**
     * Single terminal path for every failure: socket errors, close, end and
     * expired deadlines all converge here so only one retry is ever scheduled.
     * @param {number} attemptId Attempt that failed
     * @param {Error} error Failure cause
     * @returns {void}
     */
    #onTerminal(attemptId, error) {
        if (!this.#isCurrent(attemptId)) {
            return;
        }
        this.attemptTerminated = true;

        this.#clearTimer("deadlineTimer");
        this.#clearTimer("ggaTimer");
        this.#closeTransport();

        const base = BACKOFF_DELAYS_MS[Math.min(this.backoffIndex, BACKOFF_DELAYS_MS.length - 1)];
        const needsCooldown = Boolean(error) && COOLDOWN_CODES.has(error.code);
        const delay = needsCooldown ? Math.max(REJECTION_COOLDOWN_MS, base) : base;
        const jittered = delay + Math.floor(delay * JITTER_FRACTION * this.random());

        this.backoffIndex = Math.min(this.backoffIndex + 1, BACKOFF_DELAYS_MS.length - 1);
        this.state = "backoff";
        this.message = error && error.message ? error.message : "Connection failed.";
        this.healthySince = null;

        this.#clearTimer("retryTimer");
        this.retryTimer = this.clock.setTimeout(() => {
            this.retryTimer = null;
            void this.#attemptConnection();
        }, jittered);
    }

    /**
     * Send the first GGA sentence and schedule the periodic ones.
     * @returns {void}
     */
    #startGga() {
        if (!this.config.gga) {
            return;
        }
        this.#sendGga();
        const tick = () => {
            this.ggaTimer = this.clock.setTimeout(() => {
                this.ggaTimer = null;
                if (this.disposed || this.attemptTerminated) {
                    return;
                }
                this.#sendGga();
                tick();
            }, this.config.gga.intervalMs);
        };
        tick();
    }

    /**
     * Write one GGA sentence to the caster.
     * @returns {void}
     */
    #sendGga() {
        if (this.disposed || this.attemptTerminated || !this.transport || this.transportClosed) {
            return;
        }
        try {
            this.transport.write(Buffer.from(formatGga(this.config.gga, this.clock.utcNow()), "ascii"));
        } catch {
            // A rejected GGA write is reported through the transport's own
            // failure callback; it must not throw into a timer.
        }
    }
}

module.exports = {
    NtripSession,
    BACKOFF_DELAYS_MS,
    REJECTION_COOLDOWN_MS,
    COOLDOWN_CODES,
    HEALTHY_RESET_MS,
    GUARD_INTERVAL_MS,
};
