/**
 * Validate and normalize NTRIP monitor configuration.
 *
 * The monitor form and the database both store user-supplied values that end up
 * inside an HTTP request line and headers, so every protocol-bound field is
 * validated here rather than at the socket. Validation errors are safe to show
 * in the UI and in heartbeat messages: they never contain the password.
 *
 * Durations are configured and persisted in seconds and normalized to
 * milliseconds, which is what the session and transport work in.
 */

/** Default caster port when the monitor does not specify one. */
const DEFAULT_PORT = 2101;

/** Default handshake deadline in seconds. */
const DEFAULT_HANDSHAKE_SECONDS = 15;

/** Default deadline for the first observation after acceptance, in seconds. */
const DEFAULT_INITIAL_SECONDS = 30;

/** Default deadline for continued observation progress, in seconds. */
const DEFAULT_STALE_SECONDS = 30;

/** Default GGA transmission interval in seconds. */
const DEFAULT_GGA_INTERVAL_SECONDS = 10;

/** NTRIP transport revisions this monitor understands. */
const SUPPORTED_REVISIONS = ["1", "2"];

/** Matches any character that would break out of a request line or header. */
const UNSAFE_PROTOCOL_TEXT = /[\r\n\s]/;

/**
 * Coerce a database integer or form boolean into a boolean.
 * @param {*} value Stored value
 * @returns {boolean} Normalized boolean
 */
function toBoolean(value) {
    return value === true || value === 1 || value === "1";
}

/**
 * Read an optional positive whole number of seconds, applying a default.
 * @param {*} value Configured value
 * @param {number} fallback Default in seconds
 * @param {string} label Field name used in error messages
 * @returns {number} Duration in milliseconds
 * @throws {Error} When the value is present but not a positive whole number
 */
function toDurationMs(value, fallback, label) {
    const seconds = value === undefined || value === null || value === "" ? fallback : Number(value);
    if (!Number.isInteger(seconds) || seconds <= 0) {
        throw new Error(`NTRIP ${label} must be a positive whole number of seconds`);
    }
    return seconds * 1000;
}

/**
 * Read a required finite number within an inclusive range.
 * @param {*} value Configured value
 * @param {number} min Lowest allowed value
 * @param {number} max Highest allowed value
 * @param {string} label Field name used in error messages
 * @returns {number} Validated number
 * @throws {Error} When the value is missing or outside the range
 */
function toBoundedNumber(value, min, max, label) {
    const number = Number(value);
    if (
        value === undefined ||
        value === null ||
        value === "" ||
        !Number.isFinite(number) ||
        number < min ||
        number > max
    ) {
        throw new Error(`NTRIP ${label} must be a number between ${min} and ${max}`);
    }
    return number;
}

/**
 * Read an optional credential field, enforcing protocol safety.
 *
 * The value is never echoed back in the error, so a password cannot reach the
 * UI, a heartbeat message or the logs through a validation failure.
 * @param {*} value Configured value
 * @param {string} label Field name used in error messages
 * @param {boolean} rejectColon Whether a colon is disallowed, as in a Basic username
 * @returns {string|null} Credential or null when unset
 * @throws {Error} When the value is unsafe for Basic authentication
 */
function toCredential(value, label, rejectColon) {
    if (value === undefined || value === null || value === "") {
        return null;
    }
    const text = String(value);
    if (UNSAFE_PROTOCOL_TEXT.test(text)) {
        throw new Error(`NTRIP ${label} must not contain line breaks or spaces`);
    }
    if (rejectColon && text.includes(":")) {
        throw new Error(`NTRIP ${label} must not contain a colon`);
    }
    return text;
}

/**
 * Normalize a monitor row or form payload into the configuration the session uses.
 * @param {object} monitor Monitor fields in API camelCase
 * @returns {object} Normalized NTRIP configuration
 * @throws {Error} When any field is missing or invalid
 */
function normalizeNtripConfig(monitor) {
    const hostname = String(monitor.hostname ?? "").trim();
    if (hostname === "" || UNSAFE_PROTOCOL_TEXT.test(hostname) || /[/\\@]/.test(hostname)) {
        throw new Error("NTRIP hostname must be a plain host name or IP address");
    }

    const port =
        monitor.port === undefined || monitor.port === null || monitor.port === ""
            ? DEFAULT_PORT
            : Number(monitor.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error("NTRIP port must be a whole number between 1 and 65535");
    }

    const mountpoint = String(monitor.ntripMountpoint ?? "").trim();
    if (mountpoint === "" || UNSAFE_PROTOCOL_TEXT.test(mountpoint)) {
        throw new Error("NTRIP mountpoint is required and must not contain spaces or line breaks");
    }

    const revision = String(monitor.ntripRevision ?? "2");
    if (!SUPPORTED_REVISIONS.includes(revision)) {
        throw new Error("NTRIP revision must be 1 or 2");
    }

    const username = toCredential(monitor.ntripUsername, "username", true);
    const password = toCredential(monitor.ntripPassword, "password", false);

    let gga = null;
    if (toBoolean(monitor.ntripGgaEnabled)) {
        gga = {
            latitude: toBoundedNumber(monitor.ntripLatitude, -90, 90, "latitude"),
            longitude: toBoundedNumber(monitor.ntripLongitude, -180, 180, "longitude"),
            altitudeMsl: toBoundedNumber(monitor.ntripAltitudeMsl, -11000, 100000, "altitude"),
            intervalMs: toDurationMs(monitor.ntripGgaInterval, DEFAULT_GGA_INTERVAL_SECONDS, "GGA interval"),
        };
    }

    return {
        hostname,
        port,
        tls: toBoolean(monitor.ntripTls),
        mountpoint,
        revision,
        username,
        password,
        handshakeTimeoutMs: toDurationMs(monitor.ntripHandshakeTimeout, DEFAULT_HANDSHAKE_SECONDS, "handshake timeout"),
        initialTimeoutMs: toDurationMs(monitor.ntripInitialTimeout, DEFAULT_INITIAL_SECONDS, "initial timeout"),
        staleTimeoutMs: toDurationMs(monitor.ntripStaleTimeout, DEFAULT_STALE_SECONDS, "stale timeout"),
        gga,
    };
}

module.exports = {
    normalizeNtripConfig,
    DEFAULT_PORT,
    DEFAULT_HANDSHAKE_SECONDS,
    DEFAULT_INITIAL_SECONDS,
    DEFAULT_STALE_SECONDS,
    DEFAULT_GGA_INTERVAL_SECONDS,
    SUPPORTED_REVISIONS,
};
