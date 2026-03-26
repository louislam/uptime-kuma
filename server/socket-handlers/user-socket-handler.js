const { checkLogin } = require("../util-server");
const { log } = require("../../src/util");
const { R } = require("redbean-node");
const passwordHash = require("../password-hash");

/**
 * Handlers for user management
 * @param {Socket} socket Socket.io instance
 * @returns {void}
 */
module.exports.userSocketHandler = (socket) => {

    // Get list of all users
    socket.on("getUsers", async (callback) => {
        try {
            checkLogin(socket);
            let users = await R.getAll("SELECT id, username, active, twofa_status FROM user");
            callback({
                ok: true,
                users: users,
            });
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    // Add a new user
    socket.on("addUser", async (user, callback) => {
        try {
            checkLogin(socket);

            if (!user.username || !user.password) {
                throw new Error("Username and password are required.");
            }

            let existingUser = await R.findOne("user", " username = ? ", [user.username]);
            if (existingUser) {
                throw new Error("Username already exists.");
            }

            let bean = R.dispense("user");
            bean.username = user.username;
            bean.password = await passwordHash.generate(user.password);
            bean.active = 1;
            await R.store(bean);

            log.info("user", `Added user: ${user.username}`);

            callback({
                ok: true,
                msg: "successAdded",
                msgi18n: true,
            });
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    // Edit an existing user
    socket.on("editUser", async (user, callback) => {
        try {
            checkLogin(socket);

            let bean = await R.findOne("user", " id = ? ", [user.id]);
            if (!bean) {
                throw new Error("User not found.");
            }

            if (user.username && user.username.trim() !== "") {
                let existingUser = await R.findOne("user", " username = ? AND id != ? ", [user.username, user.id]);
                if (existingUser) {
                    throw new Error("Username already exists.");
                }
                bean.username = user.username;
            }

            if (user.password && user.password.trim() !== "") {
                bean.password = await passwordHash.generate(user.password);
            }

            await R.store(bean);

            log.info("user", `Edited user: ${bean.username}`);

            callback({
                ok: true,
                msg: "successSaved",
                msgi18n: true,
            });
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    // Delete a user
    socket.on("deleteUser", async (userID, callback) => {
        try {
            checkLogin(socket);

            if (Number(userID) === Number(socket.userID)) {
                throw new Error("You cannot delete your own account.");
            }

            await R.exec("DELETE FROM user WHERE id = ? ", [userID]);

            log.info("user", `Deleted user ID: ${userID}`);

            callback({
                ok: true,
                msg: "successDeleted",
                msgi18n: true,
            });
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });
};
