const { BeanModel } = require("redbean-node/dist/bean-model");
const passwordHash = require("../password-hash");
const { R } = require("redbean-node");

class User extends BeanModel {

    /**
     *
     * Fix #1510, as in the context reset-password.js, there is no auto model mapping. Call this static function instead.
     * @param userID
     * @param newPassword
     * @returns {Promise<void>}
     */
    static async resetPassword(userID, newPassword) {
        await R.exec("UPDATE `user` SET password = ? WHERE id = ? ", [
            passwordHash.generate(newPassword),
            userID
        ]);
    }

    /**
     *
     * @param newPassword
     * @returns {Promise<void>}
     */
    async resetPassword(newPassword) {
        await User.resetPassword(this.id, newPassword);
        this.password = newPassword;
    }

}

module.exports = User;
