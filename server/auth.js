const basicAuth = require("express-basic-auth");
const passwordHash = require("./password-hash");
const { R } = require("redbean-node");
const { setting } = require("./util-server");
const { log } = require("../src/util");
const { loginRateLimiter, apiRateLimiter } = require("./rate-limiter");
const { Settings } = require("./settings");
const dayjs = require("dayjs");

/**
 * Login to web app
 * @param {string} username Username to login with
 * @param {string} password Password to login with
 * @returns {Promise<(Bean|null)>} User or null if login failed
 */
exports.login = async function (username, password) {
    if (typeof username !== "string" || typeof password !== "string") {
        return null;
    }

    let user = await R.findOne("user", " username = ? AND active = 1 ", [
        username,
    ]);

    if (user && passwordHash.verify(password, user.password)) {
        // Upgrade the hash to bcrypt
        if (passwordHash.needRehash(user.password)) {
            await R.exec("UPDATE `user` SET password = ? WHERE id = ? ", [
                passwordHash.generate(password),
                user.id,
            ]);
        }
        return user;
    }

    return null;
};

/**
 * uk prefix + key ID is before _
 * @param {string} key API Key
 * @returns {{clear: string, index: string}} Parsed API key
 */
exports.parseAPIKey = function (key) {
    let index = key.substring(2, key.indexOf("_"));
    let clear = key.substring(key.indexOf("_") + 1, key.length);

    return {
        index,
        clear,
    };
};

/**
 * Validate a provided API key
 * @param {string} key API key to verify
 * @returns {Promise<boolean>} API is ok?
 */
async function verifyAPIKey(key) {
    if (typeof key !== "string") {
        return false;
    }

    const { index, clear } = exports.parseAPIKey(key);
    let hash = await R.findOne("api_key", " id=? ", [ index ]);

    if (hash === null) {
        return false;
    }

    let current = dayjs();
    let expiry = dayjs(hash.expires);
    if (expiry.diff(current) < 0 || !hash.active) {
        return false;
    }

    return hash && passwordHash.verify(clear, hash.key);
}

/**
 * @param {string} key API key to verify
 * @returns {Promise<void>}
 * @throws {Error} If API key is invalid or rate limit exceeded
 */
async function verifyAPIKeyWithRateLimit(key) {
    const pass = await apiRateLimiter.pass(null, 0);
    if (pass) {
        await apiRateLimiter.removeTokens(1);
        const valid = await verifyAPIKey(key);
        if (!valid) {
            const errMsg = "Failed API auth attempt: invalid API Key";
            log.warn("api-auth", errMsg);
            throw new Error(errMsg);
        }
    } else {
        const errMsg = "Failed API auth attempt: rate limit exceeded";
        log.warn("api-auth", errMsg);
        throw new Error(errMsg);
    }
}

/**
 * Callback for basic auth authorizers
 * @callback authCallback
 * @param {any} err Any error encountered
 * @param {boolean} authorized Is the client authorized?
 */

/**
 * Custom authorizer for express-basic-auth
 * @param {string} username Username to login with
 * @param {string} password Password to login with
 * @param {authCallback} callback Callback to handle login result
 * @returns {void}
 */
function apiAuthorizer(username, password, callback) {
    verifyAPIKeyWithRateLimit(password).then(() => {
        callback(null, true);
    }).catch(() => {
        callback(null, false);
    });
}

/**
 * Custom authorizer for express-basic-auth
 * @param {string} username Username to login with
 * @param {string} password Password to login with
 * @param {authCallback} callback Callback to handle login result
 * @returns {void}
 */
function userAuthorizer(username, password, callback) {
    // Login Rate Limit
    loginRateLimiter.pass(null, 0).then((pass) => {
        if (pass) {
            exports.login(username, password).then((user) => {
                callback(null, user != null);

                if (user == null) {
                    log.warn("basic-auth", "Failed basic auth attempt: invalid username/password");
                    loginRateLimiter.removeTokens(1);
                }
            });
        } else {
            log.warn("basic-auth", "Failed basic auth attempt: rate limit exceeded");
            callback(null, false);
        }
    });
}

/**
 * Use basic auth if auth is not disabled
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {express.NextFunction} next Next handler in chain
 * @returns {void}
 */
exports.basicAuth = async function (req, res, next) {
    const middleware = basicAuth({
        authorizer: userAuthorizer,
        authorizeAsync: true,
        challenge: true,
    });

    const disabledAuth = await setting("disableAuth");

    if (!disabledAuth) {
        middleware(req, res, next);
    } else {
        next();
    }
};

/**
 * Use use API Key if API keys enabled, else use basic auth
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {express.NextFunction} next Next handler in chain
 * @returns {void}
 */
exports.basicAuthMiddleware = async function (req, res, next) {
    let middleware = basicAuth({
        authorizer: apiAuthorizer,
        authorizeAsync: true,
        challenge: true,
    });
    middleware(req, res, next);
};

// Get the API key from the header Authorization and verify it
exports.headerAuthMiddleware = async function (req, res, next) {
    const authorizationHeader = req.header("Authorization");

    let key = null;

    if (authorizationHeader && typeof authorizationHeader === "string") {
        const arr = authorizationHeader.split(" ");
        if (arr.length === 2) {
            const type = arr[0];
            if (type === "Bearer") {
                key = arr[1];
            }
        }
    }

    if (key) {
        try {
            await verifyAPIKeyWithRateLimit(key);
            res.locals.apiKeyID = exports.parseAPIKey(key).index;
            next();
        } catch (e) {
            res.status(401);
            res.json({
                ok: false,
                msg: e.message,
            });
        }
    } else {
        await apiRateLimiter.removeTokens(1);
        res.status(401);
        res.json({
            ok: false,
            msg: "No API Key provided, please provide an API Key in the \"Authorization\" header",
        });
    }
};
