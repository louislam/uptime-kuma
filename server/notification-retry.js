/**
 * Transport-level error codes that are safe to retry.
 * Deliberately excludes anything that could duplicate an alert for a
 * reachable-but-erroring endpoint (HTTP 4xx/5xx, DNS failures, etc.).
 * @type {string[]}
 */
const RETRYABLE_NOTIFICATION_ERROR_CODES = ["EHOSTUNREACH", "ENETUNREACH", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT"];

/**
 * Default retry delays in milliseconds, applied in order after the 1st and
 * 2nd failed attempts. Total attempts = delays.length + 1.
 * @type {number[]}
 */
const NOTIFICATION_RETRY_DELAYS_MS = [15000, 25000];

/**
 * Extracts a `code=XXXX` token from an error message, as produced by
 * NotificationProvider.throwGeneralAxiosError().
 * @param {any} message The message to parse
 * @returns {?string} The extracted code, or null if not found
 */
function extractCodeFromMessage(message) {
    if (typeof message !== "string") {
        return null;
    }

    const match = message.match(/\(code=([^)]+)\)/);
    return match ? match[1] : null;
}

/**
 * Best-effort extraction of a machine-readable error code from a
 * notification send failure. Looks in order at: `error.code`,
 * `error.cause.code`, the first `code` found among the sub-errors of an
 * `AggregateError` (whether on `error` or `error.cause`), and finally a
 * `(code=XXXX)` token inside `error.message`.
 * @param {any} error The error thrown while sending a notification
 * @returns {?string} The error code, or null if none could be determined
 */
function getNotificationErrorCode(error) {
    if (!error) {
        return null;
    }

    if (error.code) {
        return error.code;
    }

    if (error.cause && error.cause.code) {
        return error.cause.code;
    }

    let aggregateErrors = null;
    if (Array.isArray(error.errors)) {
        aggregateErrors = error.errors;
    } else if (error.cause && Array.isArray(error.cause.errors)) {
        aggregateErrors = error.cause.errors;
    }

    if (aggregateErrors) {
        for (let subError of aggregateErrors) {
            if (!subError) {
                continue;
            }

            if (subError.code) {
                return subError.code;
            }

            let codeFromMessage = extractCodeFromMessage(subError.message);
            if (codeFromMessage) {
                return codeFromMessage;
            }
        }
    }

    return extractCodeFromMessage(error.message);
}

/**
 * Best-effort extraction of an HTTP status code from a notification send
 * failure. Looks at `error.httpStatus` first, then parses a leading
 * `(HTTP 123` token out of `error.message`.
 * @param {any} error The error thrown while sending a notification
 * @returns {?number} The HTTP status code, or null if none could be determined
 */
function getNotificationHttpStatus(error) {
    if (!error) {
        return null;
    }

    if (error.httpStatus) {
        return error.httpStatus;
    }

    let message = error.message;
    if (typeof message !== "string") {
        return null;
    }

    let match = message.match(/\(HTTP (\d+)/);
    return match ? Number(match[1]) : null;
}

/**
 * Decides whether a notification send failure should be retried. Transport
 * errors (the endpoint could not be reached at all) are retryable. Anything
 * that carries an HTTP status is never retryable, since the endpoint was
 * reached and a retry would just duplicate the alert.
 * @param {any} error The error thrown while sending a notification
 * @returns {boolean} True if the failure is a retryable transport error
 */
function isRetryableNotificationError(error) {
    if (getNotificationHttpStatus(error) !== null) {
        return false;
    }

    let code = getNotificationErrorCode(error);
    return RETRYABLE_NOTIFICATION_ERROR_CODES.includes(code);
}

/**
 * Callback invoked before each wait between retry attempts.
 * @callback notificationRetryCallback
 * @param {object} info Details about the attempt that just failed
 * @param {number} info.attempt The 1-based number of the attempt that just failed
 * @param {any} info.error The error thrown by that attempt
 * @param {number} info.delayMs The delay that will be waited before the next attempt
 * @returns {void}
 */

/**
 * Calls `sendFn`, retrying on retryable transport errors with the delays
 * given in `options.delaysMs`. Non-retryable errors are rethrown
 * immediately without waiting. Once all delays have been used up, the last
 * error is rethrown.
 * @param {() => Promise<void>} sendFn Function that performs the actual send, called with no arguments
 * @param {object} options - Retry options
 * @param {number[]} options.delaysMs - Delays in ms to wait between attempts, in order
 * @param {(ms: number) => Promise<void>} options.sleep - Function used to wait between attempts
 * @param {?notificationRetryCallback} options.onRetry - Called before each wait
 * @returns {Promise<{ attempts: number }>} The number of attempts it took to succeed
 * @throws {any} The last error, if every attempt fails or the error is not retryable
 */
async function sendNotificationWithRetry(sendFn, options = {}) {
    const {
        delaysMs = NOTIFICATION_RETRY_DELAYS_MS,
        sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        onRetry = null,
    } = options;

    const maxAttempts = delaysMs.length + 1;
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await sendFn();
            return { attempts: attempt };
        } catch (error) {
            lastError = error;

            if (!isRetryableNotificationError(error)) {
                throw error;
            }

            const delayMs = delaysMs[attempt - 1];
            if (delayMs === undefined) {
                throw error;
            }

            if (onRetry) {
                onRetry({ attempt, error, delayMs });
            }

            await sleep(delayMs);
        }
    }

    throw lastError;
}

module.exports = {
    RETRYABLE_NOTIFICATION_ERROR_CODES,
    NOTIFICATION_RETRY_DELAYS_MS,
    getNotificationErrorCode,
    getNotificationHttpStatus,
    isRetryableNotificationError,
    sendNotificationWithRetry,
};
