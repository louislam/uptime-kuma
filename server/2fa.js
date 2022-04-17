const { R } = require("redbean-node");

class TwoFA {

    static async disable2FA(userID) {
        return await R.exec("UPDATE `user` SET twofa_status = 0 WHERE id = ? ", [
            userID,
        ]);
    }

}

module.exports = TwoFA;
