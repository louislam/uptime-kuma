const basicAuth = require("express-basic-auth")
const passwordHash = require("./password-hash");
const { R } = require("redbean-node");

/**
 *
 * @param username : string
 * @param password : string
 * @returns {Promise<Bean|null>}
 */
exports.login = async function (username, password) {
    let user = await R.findOne("user", " username = ? AND active = 1 ", [
        username,
    ])

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
}

function myAuthorizer(username, password, callback) {
    exports.login(username, password).then((user) => {
        callback(null, user != null)
    })
}

exports.basicAuth = basicAuth({
    authorizer: myAuthorizer,
    authorizeAsync: true,
    challenge: true,
});
