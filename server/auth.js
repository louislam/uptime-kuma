const basicAuth = require("express-basic-auth");
const passwordHash = require("./password-hash");
const { R } = require("redbean-node");
const { setting } = require("./util-server");
const { debug } = require("../src/util");

const remoteUserHeader = process.env.REMOTE_USER_HEADER;

/**
 *
 * @param username : string
 * @param password : string
 * @returns {Promise<Bean|null>}
 */
exports.login = async function (username, password) {
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

function basicAuthHandler(username, password, callback) {
    setting("disableAuth").then((result) => {
        if (result) {
            callback(null, true);
        } else {
            exports.login(username, password).then((user) => {
                callback(null, user != null);
            });
        }
    });
}

async function authMiddleware(req, res, next) {
    if (remoteUserHeader !== undefined) {
        const remoteUser = req.headers[remoteUserHeader.toLowerCase()];
        if (remoteUser !== undefined) {
            let user = await R.findOne("user", " username = ? AND active = 1 ", [
                remoteUser,
            ]);
            if (user) {
                next();
                return;
            }
        }
    }
    return basicAuth({
        authorizer: basicAuthHandler,
        authorizeAsync: true,
        challenge: true,
    })(req, res, next);
}

exports.basicAuth = authMiddleware;
