const basicAuth = require("express-basic-auth");
const passwordHash = require("./password-hash");
const { R } = require("redbean-node");
const { setting } = require("./util-server");
const { loginRateLimiter } = require("./rate-limiter");
const { Settings } = require("./settings");
const dayjs = require("dayjs");

/**
 * Login to web app
 * @param {string} username
 * @param {string} password
 * @returns {Promise<(Bean|null)>}
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
 * Validate a provided API key
 * @param {string} key API Key passed by client
 * @returns {Promise<bool>}
 */
async function validateAPIKey(key) {
    if (typeof key !== "string") {
        return false;
    }

    let index = key.substring(0, key.indexOf("-"));
    let clear = key.substring(key.indexOf("-") + 1, key.length);
    console.log(index);
    console.log(clear);

    let hash = await R.findOne("api_key", " id=? ", [ index ]);

    let current = dayjs();
    let expiry = dayjs(hash.expires);
    if (expiry.diff(current) < 0, !hash.active) {
        return false;
    }

    return hash && passwordHash.verify(clear, hash.key);
}

/**
 * Callback for myAuthorizer
 * @callback myAuthorizerCB
 * @param {any} err Any error encountered
 * @param {boolean} authorized Is the client authorized?
 */

/**
 * Custom authorizer for express-basic-auth
 * @param {string} username
 * @param {string} password
 * @param {myAuthorizerCB} callback
 */
function myAuthorizer(username, password, callback) {
    // Login Rate Limit
    loginRateLimiter.pass(null, 0).then((pass) => {
        if (pass) {
            exports.login(username, password).then((user) => {
                callback(null, user != null);

                if (user == null) {
                    loginRateLimiter.removeTokens(1);
                }
            });
        } else {
            callback(null, false);
        }
    });
}

/**
 * Use basic auth if auth is not disabled
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {express.NextFunction} next
 */
exports.basicAuth = async function (req, res, next) {
    const middleware = basicAuth({
        authorizer: myAuthorizer,
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
 * Use X-API-Key header if API keys enabled, else use basic auth
 * @param {express.Request} req Express request object
 * @param {express.Response} res Express response object
 * @param {express.NextFunction} next
 */
exports.apiAuth = async function (req, res, next) {
    if (!await Settings.get("disableAuth")) {
        let usingAPIKeys = await Settings.get("apiKeysEnabled");

        loginRateLimiter.pass(null, 0).then((pass) => {
            if (usingAPIKeys) {
                let pwd = req.get("X-API-Key");
                if (pwd !== null && pwd !== undefined) {
                    validateAPIKey(pwd).then((valid) => {
                        if (valid) {
                            next();
                        } else {
                            res.status(401).send();
                        }
                    });
                } else {
                    res.status(401).send();
                }
            } else {
                exports.basicAuth(req, res, next);
            }
        });
    } else {
        next();
    }
};
