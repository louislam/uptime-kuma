const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const { normalizeNtripConfig } = require("../ntrip/config");
const { NtripSession } = require("../ntrip/session");
const { openNtripTransport } = require("../ntrip/transport");

/**
 * Adapter between Uptime Kuma's heartbeat loop and a persistent NTRIP session.
 *
 * Unlike every other monitor type, this one does not perform the check. A
 * session runs continuously on its own deadlines, so a 30-second stream outage
 * is detected in 30 seconds even when the heartbeat interval is five minutes.
 * check() only reports what the session has already observed, so it does no
 * I/O. In place of a response time it reports the age of the latest correction.
 *
 * The registered type object is shared by every NTRIP monitor, so session
 * ownership is keyed on the running monitor instance rather than on the type or
 * on the monitor id. Two monitor objects therefore stay independent even when
 * their ids match, as they briefly do while an edited monitor is being replaced.
 */
class NtripMonitorType extends MonitorType {
    name = "ntrip";

    /**
     * @param {object} dependencies Injected collaborators, replaced in tests
     * @param {Function} dependencies.createSession Session factory
     * @param {Function} dependencies.isUnderMaintenance Async effective-maintenance lookup by monitor id
     * @param {object} dependencies.clock Monotonic clock with now/utcNow/setTimeout/clearTimeout
     * @param {Function} dependencies.openTransport NTRIP transport factory
     */
    constructor(dependencies = {}) {
        super();

        /**
         * Sessions keyed on the monitor instance that owns them.
         *
         * The weak reference stops a replaced monitor object from pinning its
         * map entry. It is not cleanup: collection closes no socket and cancels
         * no timer, which is what dispose() is for.
         * @type {WeakMap<object, NtripSession>}
         */
        this.sessions = new WeakMap();

        this.createSession =
            dependencies.createSession ??
            ((config, sessionDependencies) => {
                return new NtripSession(config, sessionDependencies);
            });
        this.isUnderMaintenance =
            dependencies.isUnderMaintenance ??
            ((monitorID) => {
                // Required lazily: the monitor model reaches back into the server,
                // which builds this type, so a top-level require would be circular.
                const Monitor = require("../model/monitor");
                return Monitor.isUnderMaintenance(monitorID);
            });
        this.openTransport = dependencies.openTransport ?? openNtripTransport;
        this.clock = dependencies.clock ?? {
            // Monotonic, so a system clock adjustment cannot make a stream look
            // fresh or stale. utcNow() is wall time and is used only for GGA.
            now: () => Math.round(performance.now()),
            utcNow: () => new Date(),
            setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
            clearTimeout: (handle) => clearTimeout(handle),
        };
    }

    /**
     * Report what the session has observed since the previous heartbeat.
     *
     * Starting a session is non-blocking, so the first few heartbeats after a
     * monitor starts report pending or down while the handshake is in flight.
     * That is deliberate: reporting UP during connection would invent a success
     * that has not happened.
     * @param {Monitor} monitor Monitor to check
     * @param {Heartbeat} heartbeat Monitor heartbeat to update
     * @param {UptimeKumaServer} server Uptime Kuma server
     * @returns {Promise<void>}
     * @throws {Error} With a safe message whenever observation messages have stopped
     */
    async check(monitor, heartbeat, server) {
        let session = this.sessions.get(monitor);

        if (!session || session.disposed) {
            session = this.#startSession(monitor);
        }

        const snapshot = session.snapshot();

        if (!snapshot.healthy) {
            throw new Error(snapshot.message);
        }

        heartbeat.status = UP;
        heartbeat.msg = snapshot.message;
        // Correction age stands in for response time, so the ping chart, its
        // averages and Prometheus show how old the corrections are.
        heartbeat.ping = snapshot.correctionAgeMs;
    }

    /**
     * Close this monitor's session and release ownership.
     *
     * Disposal is terminal for a session. The next eligible heartbeat builds a
     * fresh one, which is how a monitor resumes after maintenance ends.
     * @param {Monitor} monitor Monitor being released
     * @param {UptimeKumaServer} server Uptime Kuma server
     * @returns {Promise<void>}
     */
    async dispose(monitor, server) {
        const session = this.sessions.get(monitor);

        if (!session) {
            return;
        }

        this.sessions.delete(monitor);
        session.dispose("Monitor stopped.");
    }

    /**
     * Validate the configuration and start a session for this monitor.
     * @param {Monitor} monitor Monitor to connect for
     * @returns {NtripSession} The started session
     * @throws {Error} With a safe message when the configuration is invalid
     */
    #startSession(monitor) {
        const config = normalizeNtripConfig(monitor);

        const session = this.createSession(config, {
            clock: this.clock,
            openTransport: this.openTransport,
            isEligible: () => this.#isEligible(monitor),
            onDisposed: () => {
                // Only release ownership if this session still holds it. A late
                // callback from a superseded session must not evict its
                // replacement.
                if (this.sessions.get(monitor) === session) {
                    this.sessions.delete(monitor);
                }
            },
        });

        // Ownership is installed before any work starts, so a disposal arriving
        // mid-startup finds a session to dispose.
        this.sessions.set(monitor, session);
        session.start();

        return session;
    }

    /**
     * Decide whether this monitor may currently hold a connection.
     *
     * A rejection is not swallowed. If effective maintenance cannot be
     * determined, the session disposes rather than assuming permission.
     * @param {Monitor} monitor Monitor that owns the session
     * @returns {Promise<boolean>} Whether the connection may continue
     * @throws {Error} When the maintenance lookup fails
     */
    async #isEligible(monitor) {
        if (monitor.isStop || !monitor.active) {
            return false;
        }

        if (await this.isUnderMaintenance(monitor.id)) {
            return false;
        }

        // The monitor can be paused or deleted while the lookup is in flight.
        return !monitor.isStop && Boolean(monitor.active);
    }
}

module.exports = {
    NtripMonitorType,
};
