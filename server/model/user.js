const { BeanModel } = require("redbean-node/dist/bean-model");
const passwordHash = require("../password-hash");
const { R } = require("redbean-node");

class User extends BeanModel {
    /**
     * Reset user password
     * Fix #1510, as in the context reset-password.js, there is no auto model mapping. Call this static function instead.
     * @param {number} userID ID of user to update
     * @param {string} newPassword
     * @returns {Promise<void>}
     */
    static async resetPassword(userID, newPassword) {

        log.debug("server/model/user.js/User/resetPassword(userID, newPassword)",``);

        const password = passwordHash.generate(newPassword);
        await R.exec("UPDATE `user` SET password = ? WHERE id = ? ", [
            password,
            userID
        ]);
        log.debug("server/model/user.js/User/resetPassword(userID, newPassword)",
        `R.exec("UPDATE user SET password = ${password} WHERE id = ${userID} ")`);
    }

    /**
     * Reset this users password
     * @param {string} newPassword
     * @returns {Promise<void>}
     */
    async resetPassword(newPassword) {

        log.debug("server/model/user.js/User/resetPassword(newPassword)",``);

        await User.resetPassword(this.id, newPassword);
        this.password = newPassword;
    }

}

module.exports = User;
