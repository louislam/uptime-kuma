const { checkLogin } = require("../util-server");
const { log } = require("../../src/util");
const { R } = require("redbean-node");
const passwordHash = require("../password-hash");
const { sendUserList } = require("../client");

/**
 * Handlers for user management
 * @param {Socket} socket Socket.io instance
 * @returns {void}
 */
module.exports.userSocketHandler = (socket) => {
    socket.on("getUsers", async (callback) => {
        try {
            checkLogin(socket);
            await sendUserList(socket);
            callback({
                ok: true,
            });
        } catch (e) {
            log.error("users", e);
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("addUser", async (user, callback) => {
        try {
            checkLogin(socket);

            if (typeof user.username !== "string" || typeof user.password !== "string") {
                throw new Error("Invalid input.");
            }
            user.username = user.username.trim();
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

            await sendUserList(socket);
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("editUser", async (user, callback) => {
        try {
            checkLogin(socket);

            let bean = await R.findOne("user", " id = ? ", [user.id]);
            if (!bean) {
                throw new Error("User not found.");
            }

            if (user.username && user.username.trim() !== "" && user.username.trim() !== bean.username) {
                let existingUser = await R.findOne("user", " username = ? AND id != ? ", [user.username, user.id]);
                if (existingUser) {
                    throw new Error("Username already exists.");
                }
                bean.username = user.username.trim();
            }

            if (user.password && user.password.trim() !== "") {
                bean.password = await passwordHash.generate(user.password);
            }

            await R.store(bean);

            log.info("user", `Edited user: ${bean.username}`);

            callback({
                ok: true,
                msg: "successEdited",
                msgi18n: true,
            });

            await sendUserList(socket);
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("deleteUser", async (userID, callback) => {
        try {
            checkLogin(socket);

            if (typeof userID !== "number" || !Number.isInteger(userID)) {
                throw new Error("Invalid user ID.");
            }

            if (userID === Number(socket.userID)) {
                throw new Error("You cannot delete your own account.");
            }

            let bean = await R.findOne("user", " id = ? ", [userID]);
            if (!bean) {
                throw new Error("User not found.");
            }

            let userCount = await R.count("user");
            if (userCount <= 1) {
                throw new Error("Cannot delete the last user.");
            }

            await R.exec("DELETE FROM user WHERE id = ? ", [userID]);

            log.info("user", `Deleted user ID: ${userID}`);

            callback({
                ok: true,
                msg: "successDeleted",
                msgi18n: true,
            });

            await sendUserList(socket);
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });
};
