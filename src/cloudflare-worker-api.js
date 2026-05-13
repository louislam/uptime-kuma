const WORKER_ADMIN_TOKEN_KEYS = [
    "token",
    "uptimeWorkerAdminToken",
    "cloudflareWorkerApiToken",
];

/**
 * Build headers for Cloudflare Worker admin API requests.
 * @param {object} headers Existing headers to merge.
 * @returns {object} Headers including the configured bearer token.
 */
export function cloudflareWorkerApiHeaders(headers = {}) {
    const token = getCloudflareWorkerAdminToken();
    return {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
    };
}

/**
 * Fetch JSON from the Cloudflare Worker API with admin auth.
 * @param {string} path API path.
 * @param {object} options Fetch options.
 * @returns {Promise<object>} Parsed JSON response.
 */
export async function requestCloudflareJson(path, options = {}) {
    const response = await fetch(path, {
        ...options,
        headers: cloudflareWorkerApiHeaders(options.headers || {}),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(body.error || body.msg || `HTTP ${response.status}`);
    }
    return body;
}

/**
 * Read the Worker admin token from browser storage.
 * @returns {string} Configured token, or an empty string.
 */
function getCloudflareWorkerAdminToken() {
    for (const storage of [window.localStorage, window.sessionStorage]) {
        for (const key of WORKER_ADMIN_TOKEN_KEYS) {
            const token = storage.getItem(key);
            if (token) {
                return token;
            }
        }
    }
    return "";
}
