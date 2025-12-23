const { BeanModel } = require("redbean-node/dist/bean-model");
const passwordHash = require("../password-hash");
const { R } = require("redbean-node");
const jwt = require("jsonwebtoken");
const { shake256, SHAKE256_LENGTH } = require("../util-server");

class User extends BeanModel {
    /**
     * User roles
     */
    static ROLE_ADMIN = "admin";
    static ROLE_USER = "user";
    static ROLE_READONLY = "readonly";
    /**
     * Reset user password
     * Fix #1510, as in the context reset-password.js, there is no auto model mapping. Call this static function instead.
     * @param {number} userID ID of user to update
     * @param {string} newPassword Users new password
     * @returns {Promise<void>}
     */
    static async resetPassword(userID, newPassword) {
        await R.exec("UPDATE `user` SET password = ? WHERE id = ? ", [
            await passwordHash.generate(newPassword),
            userID
        ]);
    }

    /**
     * Reset this users password
     * @param {string} newPassword Users new password
     * @returns {Promise<void>}
     */
    async resetPassword(newPassword) {
        const hashedPassword = await passwordHash.generate(newPassword);

        await R.exec("UPDATE `user` SET password = ? WHERE id = ? ", [
            hashedPassword,
            this.id
        ]);

        this.password = hashedPassword;
    }

    /**
     * Create a new JWT for a user
     * @param {User} user The User to create a JsonWebToken for
     * @param {string} jwtSecret The key used to sign the JsonWebToken
     * @returns {string} the JsonWebToken as a string
     */
    static createJWT(user, jwtSecret) {
        return jwt.sign({
            username: user.username,
            h: shake256(user.password, SHAKE256_LENGTH),
        }, jwtSecret);
    }

    /**
     * Check if user has admin role
     * @returns {boolean} True if user is admin
     */
    isAdmin() {
        return this.role === User.ROLE_ADMIN;
    }

    /**
     * Check if user has readonly role
     * @returns {boolean} True if user is readonly
     */
    isReadOnly() {
        return this.role === User.ROLE_READONLY;
    }

    /**
     * Get all users
     * @returns {Promise<Array>} Array of user objects (without passwords)
     */
    static async getAll() {
        const users = await R.findAll("user");
        return users.map(user => ({
            id: user.id,
            username: user.username,
            active: user.active,
            role: user.role || "user",
            timezone: user.timezone,
        }));
    }

}

module.exports = User;
