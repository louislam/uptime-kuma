/** The deploy sources the server reads. Kuma itself is read by the browser, not here. */
const SOURCE_IDS = ["cluster", "bitbucket", "github", "amplify"];

/**
 * Situation of a source:
 * - unconfigured: nothing to read from (no config, no credential); never an alarm;
 * - active: reading normally;
 * - stale: configured, but the last read failed or is too old; the screen must not vouch for it.
 */
const SOURCE_STATES = ["unconfigured", "active", "stale"];

/** At most one broadcast per this many milliseconds. */
const EMIT_INTERVAL_MS = 1000;

/**
 * Fields of a deploy that may reach the browser. Anything else stays on the server, so a field
 * added to the internal record never leaks by default.
 */
const DEPLOY_PUBLIC_FIELDS = [];

/**
 * In-memory state of the deploy board, and the single place the browser payload is built from.
 */
class DeployBoardStore {
    /**
     * @param {object} options Options.
     * @param {Function} options.now Clock, in milliseconds (injectable for tests).
     * @param {number} options.emitIntervalMs Minimum time between broadcasts.
     */
    constructor({ now = () => Date.now(), emitIntervalMs = EMIT_INTERVAL_MS } = {}) {
        this.now = now;
        this.emitIntervalMs = emitIntervalMs;
        this.sources = {};
        for (const id of SOURCE_IDS) {
            this.sources[id] = { state: "unconfigured", lastDataAt: null, detail: null };
        }
        this.deploys = [];
        this.history = [];
        this.listeners = new Set();
        this.lastEmitAt = null;
        this.emitTimer = null;
    }

    /**
     * Set the situation of a source.
     * @param {string} id Source id.
     * @param {string} state One of SOURCE_STATES.
     * @param {string|null} detail Short human-readable reason (e.g. which namespace was denied).
     * @returns {void}
     * @throws {Error} Unknown source or state.
     */
    setSource(id, state, detail = null) {
        const source = this.requireSource(id);
        if (!SOURCE_STATES.includes(state)) {
            throw new Error(`Unknown source state: ${state}`);
        }
        if (source.state === state && source.detail === detail) {
            return;
        }
        source.state = state;
        source.detail = detail;
        this.changed();
    }

    /**
     * Record that a source delivered data now. A stale source becomes active again.
     * @param {string} id Source id.
     * @returns {void}
     */
    markData(id) {
        const source = this.requireSource(id);
        source.lastDataAt = this.now();
        if (source.state === "stale") {
            source.state = "active";
            source.detail = null;
        }
        this.changed();
    }

    /**
     * The payload sent to the browser. Built field by field on purpose.
     * @returns {object} Snapshot.
     */
    snapshot() {
        const sources = {};
        for (const id of SOURCE_IDS) {
            const s = this.sources[id];
            sources[id] = { state: s.state, lastDataAt: s.lastDataAt, detail: s.detail };
        }
        return {
            generatedAt: this.now(),
            sources,
            deploys: this.deploys.map(pickPublic),
            history: this.history.map(pickPublic),
        };
    }

    /**
     * Subscribe to changes. The listener gets the snapshot, at most once per emit interval.
     * @param {Function} listener Called with the snapshot.
     * @returns {Function} Unsubscribe.
     */
    onChange(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Schedule a broadcast: right away if the last one is old enough, otherwise once at the end of
     * the interval, carrying everything that changed in between.
     * @returns {void}
     */
    changed() {
        if (this.emitTimer) {
            return;
        }
        const elapsed = this.lastEmitAt === null ? Infinity : this.now() - this.lastEmitAt;
        if (elapsed >= this.emitIntervalMs) {
            this.emit();
        } else {
            this.emitTimer = setTimeout(() => {
                this.emitTimer = null;
                this.emit();
            }, this.emitIntervalMs - elapsed);
        }
    }

    /**
     * Send the snapshot to every listener. A listener that throws does not stop the others.
     * @returns {void}
     */
    emit() {
        this.lastEmitAt = this.now();
        const snapshot = this.snapshot();
        for (const listener of this.listeners) {
            try {
                listener(snapshot);
            } catch (e) {
                // Broadcasting is best effort; the next change sends the whole state again.
            }
        }
    }

    /**
     * Stop a pending broadcast (used on shutdown and in tests).
     * @returns {void}
     */
    close() {
        clearTimeout(this.emitTimer);
        this.emitTimer = null;
    }

    /**
     * @param {string} id Source id.
     * @returns {object} The source record.
     * @throws {Error} Unknown source.
     */
    requireSource(id) {
        const source = this.sources[id];
        if (!source) {
            throw new Error(`Unknown deploy source: ${id}`);
        }
        return source;
    }
}

/**
 * @param {object} record Internal deploy record.
 * @returns {object} Only the whitelisted fields.
 */
function pickPublic(record) {
    const out = {};
    for (const field of DEPLOY_PUBLIC_FIELDS) {
        if (record[field] !== undefined) {
            out[field] = record[field];
        }
    }
    return out;
}

module.exports = {
    SOURCE_IDS,
    SOURCE_STATES,
    EMIT_INTERVAL_MS,
    DEPLOY_PUBLIC_FIELDS,
    DeployBoardStore,
};
