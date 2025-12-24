const { checkLogin } = require("../util-server");
const { R } = require("redbean-node");
const passwordHash = require("../password-hash");
const { log } = require("../../src/util");
const { passwordStrength } = require("check-password-strength");
const { validateUsername } = require("../user-validator");

/**
 * Validates password strength
 * @param {string} password Password to validate
 * @returns {void}
 * @throws {Error} If password is too weak
 */
function validatePasswordStrength(password) {
    if (passwordStrength(password).value === "Too weak") {
        throw new Error("Password is too weak. It should contain alphabetic and numeric characters. It must be at least 6 characters in length.");
    }
}

/**
 * Handlers for user management
 * @param {Socket} socket Socket.io instance
 * @param {UptimeKumaServer} server Uptime Kuma server
 * @returns {void}
 */
module.exports.userManagementSocketHandler = (socket, server) => {

    // Get all users
    socket.on("getUsers", async (callback) => {
        try {
            checkLogin(socket);
            const users = await R.findAll("user");
            const userList = users.map(user => ({
                id: user.id,
                username: user.username,
                active: user.active,
                timezone: user.timezone,
            }));
            callback({
                ok: true,
                users: userList,
            });
        } catch (e) {
            log.error("user-management", e.message);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    // Add a new user
    socket.on("addUser", async (userData, callback) => {
        try {
            checkLogin(socket);

            // Validate input
            if (!userData.username || !userData.password) {
                throw new Error("Username and password are required");
            }

            // Validate username format
            validateUsername(userData.username);

            // Validate password strength
            validatePasswordStrength(userData.password);

            // Check if username already exists
            const existingUser = await R.findOne("user", " username = ? ", [ userData.username.trim() ]);
            if (existingUser) {
                throw new Error("Username already exists");
            }

            // Create new user
            const user = R.dispense("user");
            user.username = userData.username.trim();
            user.password = await passwordHash.generate(userData.password);
            user.active = 1;

            await R.store(user);

            log.info("user-management", `User ${user.username} created by user ${socket.userID}`);

            callback({
                ok: true,
                msg: "User created successfully",
                msgi18n: true,
                userId: user.id,
            });
        } catch (e) {
            log.error("user-management", e.message);
            callback({
                ok: false,
                msg: e.message,
                msgi18n: true,
            });
        }
    });

    // Update user
    socket.on("updateUser", async (userId, userData, callback) => {
        try {
            checkLogin(socket);

            const user = await R.findOne("user", " id = ? ", [ userId ]);
            if (!user) {
                throw new Error("User not found");
            }

            // Check if user is editing their own username
            const isEditingSelf = Number(userId) === Number(socket.userID);
            const usernameChanged = userData.username && userData.username.trim() !== user.username;

            // Don't allow deactivating yourself
            if (isEditingSelf && typeof userData.active !== "undefined" && !userData.active) {
                throw new Error("Cannot deactivate your own account");
            }

            // Update user fields
            if (userData.username && userData.username.trim() !== user.username) {
                // Validate username format
                validateUsername(userData.username);

                // Check if new username already exists
                const existingUser = await R.findOne("user", " username = ? AND id != ? ", [
                    userData.username.trim(),
                    userId
                ]);
                if (existingUser) {
                    throw new Error("Username already exists");
                }
                user.username = userData.username.trim();
            }

            if (typeof userData.active !== "undefined") {
                user.active = userData.active ? 1 : 0;
            }

            // Update password if provided
            if (userData.password) {
                // Validate password strength
                validatePasswordStrength(userData.password);
                user.password = await passwordHash.generate(userData.password);
            }

            await R.store(user);

            log.info("user-management", `User ${user.username} updated by user ${socket.userID}`);

            callback({
                ok: true,
                msg: "User updated successfully",
                msgi18n: true,
                requiresLogout: isEditingSelf && usernameChanged,
            });
        } catch (e) {
            log.error("user-management", e.message);
            callback({
                ok: false,
                msg: e.message,
                msgi18n: true,
            });
        }
    });

    // Delete user
    socket.on("deleteUser", async (userId, callback) => {
        try {
            checkLogin(socket);

            const user = await R.findOne("user", " id = ? ", [ userId ]);
            if (!user) {
                throw new Error("User not found");
            }

            // Don't allow deleting yourself
            if (Number(user.id) === Number(socket.userID)) {
                throw new Error("Cannot delete your own account");
            }

            // Explicitly handle related records to ensure database-agnostic behavior
            // Delete API keys (CASCADE behavior)
            await R.exec("DELETE FROM api_key WHERE user_id = ?", [ userId ]);

            // Orphan monitors by setting user_id to NULL (SET NULL behavior)
            await R.exec("UPDATE monitor SET user_id = NULL WHERE user_id = ?", [ userId ]);

            // Orphan maintenance records by setting user_id to NULL (SET NULL behavior)
            await R.exec("UPDATE maintenance SET user_id = NULL WHERE user_id = ?", [ userId ]);

            // Permanently remove the user from the database
            await R.trash(user);

            // Disconnect all socket connections for this user
            server.disconnectAllSocketClients(userId);

            log.info("user-management", `User ${user.username} deleted by user ${socket.userID}`);

            callback({
                ok: true,
                msg: "User deleted successfully",
                msgi18n: true,
            });
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
                msgi18n: true,
            });
        }
    });
};
