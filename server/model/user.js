const { BeanModel } = require("redbean-node/dist/bean-model");
const passwordHash = require("../password-hash");
const { R } = require("redbean-node");
const jwt = require("jsonwebtoken");
const { shake256, SHAKE256_LENGTH } = require("../util-server");

class User extends BeanModel {
    /**
     * Reset user password
     * Fix #1510, as in the context reset-password.js, there is no auto model mapping. Call this static function instead.
     * @param {number} userID ID of user to update
     * @param {string} newPassword
     * @returns {Promise<void>}
     */
    static async resetPassword(userID, newPassword) {
        await R.exec("UPDATE `user` SET password = ? WHERE id = ? ", [
            passwordHash.generate(newPassword),
            userID
        ]);
    }

    /**
     * Reset this users password
     * @param {string} newPassword
     * @returns {Promise<void>}
     */
    async resetPassword(newPassword) {
        await User.resetPassword(this.id, newPassword);
        this.password = newPassword;
    }

    /**
     * Create a new JWT for a user
     * @param {User} user
     * @param {string} jwtSecret
     * @return {string}
     */
    static createJWT(user, jwtSecret) {
        return jwt.sign({
            username: user.username,
            h: shake256(user.password, SHAKE256_LENGTH),
        }, jwtSecret);
    }

}

module.exports = User;
