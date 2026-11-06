const CachePolicy = require("http-cache-semantics");
const ms = require("ms");

/** Proxy headers can reach a body when trustProxy is on, so they are keyed by default */
const defaultVary = ["x-forwarded-host", "x-forwarded-proto"];

/** Headers that must not be replayed from a stored response */
const skippedHeaders = ["cache-control", "set-cookie", "connection", "transfer-encoding", "content-length"];

/** Bounded store, oldest entry evicted first */
const store = new Map();
const maxEntries = 1000;

/**
 * Key: method + authority + path + whitelisted request headers
 * @param {object} req Request
 * @param {string[]} varyHeaders Lowercased header names
 * @returns {string} Key
 */
function cacheKey(req, varyHeaders) {
    let key = `${req.method} ${req.headers.host}${req.originalUrl || req.url}`;
    for (const header of varyHeaders) {
        key += `\n${header}: ${req.headers[header] ?? ""}`;
    }
    return key;
}

/**
 * Normalised request view, so the policy sees the same URL whatever router mounted it
 * @param {object} req Request
 * @returns {object} Request-like object
 */
function toPolicyRequest(req) {
    return {
        url: req.originalUrl || req.url,
        method: req.method,
        headers: req.headers,
    };
}

/**
 * Store an entry, evicting the oldest when full
 * @param {string} key Key
 * @param {object} entry Entry
 * @returns {void}
 */
function remember(key, entry) {
    store.delete(key);
    store.set(key, entry);
    while (store.size > maxEntries) {
        store.delete(store.keys().next().value);
    }
}

/**
 * Express / node:http middleware
 * @param {string|number} duration Cache duration
 * @param {object} options Options
 * @param {string[]} options.vary Request headers that also shape the body
 * @returns {Function} Middleware
 * @throws {Error} If the duration cannot be parsed
 */
function middleware(duration, options = {}) {
    const ttl = ms(duration);
    if (!Number.isFinite(ttl) || ttl <= 0) {
        throw new Error(`Invalid duration: ${duration}`);
    }
    const ttlSeconds = Math.max(1, Math.round(ttl / 1000));
    const varyHeaders = (options.vary ?? defaultVary).map((header) => header.toLowerCase());

    return (req, res, next) => {
        if (req.method !== "GET") {
            return next();
        }

        const key = cacheKey(req, varyHeaders);
        const policyRequest = toPolicyRequest(req);
        const entry = store.get(key);

        if (entry && entry.policy.satisfiesWithoutRevalidation(policyRequest)) {
            res.statusCode = entry.status;
            for (const [name, value] of Object.entries(entry.headers)) {
                res.setHeader(name, value);
            }
            res.setHeader("cache-control", "no-store");
            res.setHeader("x-cache", "hit");

            if (entry.etag && req.headers["if-none-match"] === entry.etag) {
                res.statusCode = 304;
                res.removeHeader("content-length");
                res.removeHeader("content-type");
                res.end();
                return;
            }

            res.end(entry.body);
            return;
        }

        const chunks = [];
        const originalEnd = res.end;

        res.write = function (chunk, encoding) {
            if (chunk) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
            }
            return true;
        };

        res.end = (chunk, encoding) => {
            if (chunk && typeof chunk !== "function") {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
            }

            if (!res.headersSent && res.statusCode === 200) {
                const storedHeaders = {};
                for (const [name, value] of Object.entries(res.getHeaders())) {
                    if (!skippedHeaders.includes(name)) {
                        storedHeaders[name] = value;
                    }
                }

                const policy = new CachePolicy(
                    policyRequest,
                    {
                        status: res.statusCode,
                        headers: { ...storedHeaders, "cache-control": `max-age=${ttlSeconds}` },
                    },
                    { shared: false }
                );

                if (policy.storable()) {
                    remember(key, {
                        policy,
                        status: res.statusCode,
                        headers: storedHeaders,
                        body: Buffer.concat(chunks),
                        etag: res.getHeader("etag"),
                    });
                }
            }

            res.setHeader("cache-control", "no-store");
            res.setHeader("x-cache", "miss");
            return originalEnd.call(res, Buffer.concat(chunks));
        };

        next();
    };
}

/** @returns {void} */
function clear() {
    store.clear();
}

module.exports = {
    middleware,
    clear,
};
