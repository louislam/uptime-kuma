const { checkLogin } = require("../util-server");
const { R } = require("redbean-node");
const passwordHash = require("../password-hash");
const { log } = require("../../src/util");

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

            if (typeof userData.active !== "undefined") {
                user.active = userData.active ? 1 : 0;
            }

            // Update password if provided
            if (userData.password) {
                user.password = await passwordHash.generate(userData.password);
            }

            await R.store(user);

            log.info("user-management", `User ${user.username} updated by user ${socket.userID}`);

            callback({
                ok: true,
                msg: "User updated successfully",
                requiresLogout: isEditingSelf && usernameChanged,
            });
        } catch (e) {
            log.error("user-management", e.message);
            callback({
                ok: false,
                msg: e.message,
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

            // Permanently remove the user from the database
            await R.trash(user);

            // Disconnect all socket connections for this user
            server.disconnectAllSocketClients(userId);

            log.info("user-management", `User ${user.username} deleted by user ${socket.userID}`);

            callback({
                ok: true,
                msg: "User deleted successfully",
            });
        } catch (error) {
            callback({
                ok: false,
                msg: error.message,
            });
        }
    });
};
