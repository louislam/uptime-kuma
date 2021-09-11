const { BeanModel } = require("redbean-node/dist/bean-model");
const passwordHash = require("../password-hash");
const { R } = require("redbean-node");

class User extends BeanModel {

    /**
     * Direct execute, no need R.store()
     * @param newPassword
     * @returns {Promise<void>}
     */
    async resetPassword(newPassword) {
        await R.exec("UPDATE `user` SET password = ? WHERE id = ? ", [
            passwordHash.generate(newPassword),
            this.id
        ]);
        this.password = newPassword;
    }
}

module.exports = User;
