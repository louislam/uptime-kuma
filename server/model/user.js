const { BaseModel } = require("./base-model");
const passwordHash = require("../password-hash");
const { getKnex } = require("../db");
const jwt = require("jsonwebtoken");
const { shake256, SHAKE256_LENGTH } = require("../util-server");

class User extends BaseModel {
    static tableName = "user";

    /**
     * Reset user password
     * Fix #1510, as in the context reset-password.js, there is no auto model mapping. Call this static function instead.
     * @param {number} userID ID of user to update
     * @param {string} newPassword Users new password
     * @returns {Promise<void>}
     */
    static async resetPassword(userID, newPassword) {
        await getKnex()("user").where("id", userID).update({
            password: await passwordHash.generate(newPassword),
        });
    }

    /**
     * Reset this users password
     * @param {string} newPassword Users new password
     * @returns {Promise<void>}
     */
    async resetPassword(newPassword) {
        const hashedPassword = await passwordHash.generate(newPassword);
        await getKnex()("user").where("id", this.id).update({ password: hashedPassword });
        this.password = hashedPassword;
    }

    /**
     * Create a new JWT for a user
     * @param {User} user The User to create a JsonWebToken for
     * @param {string} jwtSecret The key used to sign the JsonWebToken
     * @returns {string} the JsonWebToken as a string
     */
    static createJWT(user, jwtSecret) {
        return jwt.sign(
            {
                username: user.username,
                h: shake256(user.password, SHAKE256_LENGTH),
            },
            jwtSecret
        );
    }
}

module.exports = User;
