const { getKnex } = require("./db");

class TwoFA {
    /**
     * Disable 2FA for specified user
     * @param {number} userID ID of user to disable
     * @returns {Promise<void>}
     */
    static async disable2FA(userID) {
        return await getKnex()("user").where("id", userID).update({ twofa_status: false });
    }
}

module.exports = TwoFA;
