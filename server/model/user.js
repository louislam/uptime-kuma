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
            // Include user_type in the JWT payload if needed for frontend/client-side checks,
            // but remember that JWTs can be decoded by the client.
            // For sensitive authorization, always re-check user_type on the server-side.
            user_type: user.user_type,
            h: shake256(user.password, SHAKE256_LENGTH),
        }, jwtSecret);
    }

    /**
     * Returns the user type.
     * Note: This assumes the 'user_type' field is populated in the bean.
     * If you load a user bean partially, ensure 'user_type' is selected.
     * @returns {string | null} The user type string or null if not set/loaded.
     */
    getUserType() {
        return this.user_type || null;
    }

    /**
     * Sets the user type.
     * Remember to save the bean after setting the type for changes to persist.
     * @param {string} newUserType The new type for the user.
     * @returns {Promise<void>}
     */
    async setUserType(newUserType) {
        // Basic validation can be added here if desired, e.g.,
        // const allowedTypes = ['admin', 'editor', 'viewer'];
        // if (!allowedTypes.includes(newUserType)) {
        //     throw new Error(`Invalid user type: ${newUserType}`);
        // }
        this.user_type = newUserType;
        // Note: This only updates the property on the model instance.
        // You need to call R.store(userBean) to persist the change to the database.
    }
}

module.exports = User;
