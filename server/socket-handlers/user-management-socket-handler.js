const { checkLogin } = require("../util-server");
const { R } = require("redbean-node");
const passwordHash = require("../password-hash");
const { log } = require("../../src/util");
const User = require("../model/user");

/**
 * Handlers for user management
 * @param {Socket} socket Socket.io instance
 * @param {UptimeKumaServer} server Uptime Kuma server
 * @returns {void}
 */
module.exports.userManagementSocketHandler = (socket, server) => {

    /**
     * Check if the current user is an admin
     * @param {Socket} socket Socket.io instance
     * @returns {Promise<boolean>} True if user is admin
     * @throws {Error} If user is not logged in or not an admin
     */
    async function checkAdmin(socket) {
        checkLogin(socket);

        const user = await R.findOne("user", " id = ? ", [ socket.userID ]);
        if (!user || user.role !== User.ROLE_ADMIN) {
            throw new Error("Permission denied. Admin access required.");
        }
        return true;
    }

    // Get all users (admin only)
    socket.on("getUsers", async (callback) => {
        try {
            await checkAdmin(socket);
            const users = await User.getAll();
            callback({
                ok: true,
                users: users,
            });
        } catch (e) {
            log.error("user-management", e.message);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    // Add a new user (admin only)
    socket.on("addUser", async (userData, callback) => {
        try {
            await checkAdmin(socket);

            // Validate input
            if (!userData.username || !userData.password) {
                throw new Error("Username and password are required");
            }

            // Check if username already exists
            const existingUser = await R.findOne("user", " username = ? ", [ userData.username.trim() ]);
            if (existingUser) {
                throw new Error("Username already exists");
            }

            // Create new user
            const user = R.dispense("user");
            user.username = userData.username.trim();
            user.password = await passwordHash.generate(userData.password);
            user.role = userData.role || User.ROLE_USER;
            user.active = 1;

            await R.store(user);

            log.info("user-management", `User ${user.username} created by admin ${socket.userID}`);

            callback({
                ok: true,
                msg: "User created successfully",
                userId: user.id,
            });
        } catch (e) {
            log.error("user-management", e.message);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    // Update user (admin only)
    socket.on("updateUser", async (userId, userData, callback) => {
        try {
            await checkAdmin(socket);

            const user = await R.findOne("user", " id = ? ", [ userId ]);
            if (!user) {
                throw new Error("User not found");
            }

            // Don't allow demoting the last admin
            if (user.role === User.ROLE_ADMIN && userData.role !== User.ROLE_ADMIN) {
                const adminCount = await R.count("user", " role = ? AND active = 1 ", [ User.ROLE_ADMIN ]);
                if (adminCount <= 1) {
                    throw new Error("Cannot change role of the last admin user");
                }
            }

            // Update user fields
            if (userData.username && userData.username.trim() !== user.username) {
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

            if (userData.role) {
                user.role = userData.role;
            }

            if (typeof userData.active !== "undefined") {
                // Don't allow deactivating the last admin
                if (user.role === User.ROLE_ADMIN && !userData.active) {
                    const adminCount = await R.count("user", " role = ? AND active = 1 AND id != ? ", [
                        User.ROLE_ADMIN,
                        userId
                    ]);
                    if (adminCount < 1) {
                        throw new Error("Cannot deactivate the last admin user");
                    }
                }
                user.active = userData.active ? 1 : 0;
            }

            // Update password if provided
            if (userData.password) {
                user.password = await passwordHash.generate(userData.password);
            }

            await R.store(user);

            log.info("user-management", `User ${user.username} updated by admin ${socket.userID}`);

            callback({
                ok: true,
                msg: "User updated successfully",
            });
        } catch (e) {
            log.error("user-management", e.message);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    // Delete user (admin only)
    socket.on("deleteUser", async (userId, callback) => {
        try {
            await checkAdmin(socket);

            const user = await R.findOne("user", " id = ? ", [ userId ]);
            if (!user) {
                throw new Error("User not found");
            }

            // Don't allow deleting yourself
            if (user.id === socket.userID) {
                throw new Error("Cannot delete your own account");
            }

            // Don't allow deleting the last admin
            if (user.role === User.ROLE_ADMIN) {
                const adminCount = await R.count("user", " role = ? AND active = 1 ", [ User.ROLE_ADMIN ]);
                if (adminCount <= 1) {
                    throw new Error("Cannot delete the last admin user");
                }
            }

            // Instead of deleting, deactivate the user to preserve data integrity
            user.active = 0;
            await R.store(user);

            // Disconnect all socket connections for this user
            server.disconnectAllSocketClients(userId);

            log.info("user-management", `User ${user.username} deactivated by admin ${socket.userID}`);

            callback({
                ok: true,
                msg: "User deleted successfully",
            });
        } catch (e) {
            log.error("user-management", e.message);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });
};
