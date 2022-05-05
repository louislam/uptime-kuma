const basicAuth = require("express-basic-auth");
const passwordHash = require("./password-hash");
const { R } = require("redbean-node");
const { setting } = require("./util-server");
const { loginRateLimiter } = require("./rate-limiter");

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
