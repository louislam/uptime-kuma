const { R } = require("redbean-node");

class TwoFA {

    /**
     * Disable 2FA for specified user
     * @param {number} userID ID of user to disable
     * @returns {Promise<void>}
     */
    static async disable2FA(userID) {
       log.debug("server/2fa.js/TwoFA/disable2FA","R.exec('UPDATE user SET twofa_status = 0 WHERE id = " + userID);
        return await R.exec("UPDATE `user` SET twofa_status = 0 WHERE id = ? ", [
            userID,
        ]);
    }

}

module.exports = TwoFA;
