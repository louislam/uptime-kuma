const SYSTEM_TWINGATE_PROXY_URL = "http://127.0.0.1:9999";
const DEFAULT_TWINGATE_STATUS_REQUEST_TIMEOUT_MS = 10000;
const MIN_TWINGATE_STATUS_REQUEST_TIMEOUT_MS = 1000;
const MAX_TWINGATE_STATUS_REQUEST_TIMEOUT_MS = 30000;
const DEFAULT_TWINGATE_TUN_MODE = "off";
const TWINGATE_CONTAINER_STARTING_MESSAGE =
    "Twingate runner container is starting or provisioning. Refresh in a few seconds.";
const TWINGATE_ENV_INPUTS = [
    "TWINGATE_SERVICE_KEY_B64",
    "TWINGATE_SERVICE_KEY_JSON",
    "TWINGATE_PRIVATE_KEY",
    "TWINGATE_PRIVATE_KEY_B64",
    "TWINGATE_NETWORK",
    "TWINGATE_SERVICE_ACCOUNT_ID",
    "TWINGATE_KEY_ID",
];

/**
 * Detect whether Twingate has any service-key material configured in Worker env.
 * @param {object} env Worker environment bindings.
 * @returns {boolean} True when any Twingate service-key field is present.
 */
function hasTwingateServiceKeyInput(env = {}) {
    return TWINGATE_ENV_INPUTS.some((name) => Boolean(env?.[name]));
}

/**
 * Detect the transient Cloudflare Container startup race/provisioning message.
 * @param {string} message Runner/container error text.
 * @returns {boolean} True when the container is still attaching or starting.
 */
function isTransientContainerStartupError(message = "") {
    const text = String(message);
    return (
        /container is not running,\s*consider calling start\(\)/i.test(text)
        || /failed to start (?:runner )?container:.*operation was aborted/i.test(text)
    );
}

/**
 * Build the sanitized status shape sent to the settings UI.
 * @param {object} status Raw runner status.
 * @returns {object} Sanitized runner status.
 */
function sanitizeRunnerStatus(status = {}) {
    return {
        configured: Boolean(status.configured),
        starting: Boolean(status.starting),
        running: Boolean(status.running),
        proxyUrl: status.proxyUrl || null,
        tunMode: status.tunMode || DEFAULT_TWINGATE_TUN_MODE,
        lastError: status.lastError || null,
    };
}

/**
 * Resolve the maximum time a Twingate status request may wait on the runner.
 * @param {object} env Worker environment bindings.
 * @returns {number} Timeout in milliseconds.
 */
function resolveTwingateStatusTimeoutMs(env = {}) {
    const parsed = Number(env?.TWINGATE_STATUS_REQUEST_TIMEOUT_MS);
    if (!Number.isFinite(parsed)) {
        return DEFAULT_TWINGATE_STATUS_REQUEST_TIMEOUT_MS;
    }
    return Math.min(
        MAX_TWINGATE_STATUS_REQUEST_TIMEOUT_MS,
        Math.max(MIN_TWINGATE_STATUS_REQUEST_TIMEOUT_MS, Math.round(parsed))
    );
}

/**
 * Build a status payload for transient Cloudflare Container startup.
 * @param {object} env Worker environment bindings.
 * @param {string} lastError Optional sanitized startup message.
 * @returns {object} Sanitized starting status.
 */
function buildStartingTwingateStatus(env = {}, lastError = TWINGATE_CONTAINER_STARTING_MESSAGE) {
    return sanitizeRunnerStatus({
        configured: hasTwingateServiceKeyInput(env),
        starting: true,
        running: false,
        proxyUrl: SYSTEM_TWINGATE_PROXY_URL,
        tunMode: env.TWINGATE_TUN || DEFAULT_TWINGATE_TUN_MODE,
        lastError,
    });
}

/**
 * Build a status payload when the runner container cannot provide its own status.
 * @param {object} env Worker environment bindings.
 * @param {string} lastError Sanitized runner status error.
 * @returns {object} Sanitized unavailable status.
 */
function buildUnavailableTwingateStatus(env = {}, lastError) {
    return sanitizeRunnerStatus({
        configured: hasTwingateServiceKeyInput(env),
        starting: false,
        running: false,
        proxyUrl: SYSTEM_TWINGATE_PROXY_URL,
        tunMode: env.TWINGATE_TUN || DEFAULT_TWINGATE_TUN_MODE,
        lastError,
    });
}

/**
 * Classify a runner failure and build the matching sanitized status.
 * @param {object} env Worker environment bindings.
 * @param {string} lastError Sanitized runner status error.
 * @returns {object} Sanitized status.
 */
function buildTwingateStatusFromRunnerFailure(env = {}, lastError) {
    if (isTransientContainerStartupError(lastError)) {
        return buildStartingTwingateStatus(env);
    }
    return buildUnavailableTwingateStatus(env, lastError);
}

export {
    SYSTEM_TWINGATE_PROXY_URL,
    DEFAULT_TWINGATE_TUN_MODE,
    TWINGATE_CONTAINER_STARTING_MESSAGE,
    buildStartingTwingateStatus,
    buildTwingateStatusFromRunnerFailure,
    buildUnavailableTwingateStatus,
    hasTwingateServiceKeyInput,
    isTransientContainerStartupError,
    resolveTwingateStatusTimeoutMs,
    sanitizeRunnerStatus,
};
