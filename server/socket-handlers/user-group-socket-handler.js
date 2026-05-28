const { checkLogin, isAdmin } = require("../util-server");
const { R } = require("redbean-node");
const passwordHash = require("../password-hash");
const { log } = require("../../src/util");
const crypto = require("crypto");

/**
 * Generate a secure random password that meets strength requirements
 * @returns {string}
 */
function generatePassword() {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lower = "abcdefghjkmnpqrstuvwxyz";
    const digits = "23456789";
    const special = "!@#$%&*";
    const all = upper + lower + digits + special;
    const rand = () => crypto.randomInt(0, all.length);

    // Guarantee at least one of each required class
    let pwd = [
        upper[crypto.randomInt(0, upper.length)],
        lower[crypto.randomInt(0, lower.length)],
        digits[crypto.randomInt(0, digits.length)],
        special[crypto.randomInt(0, special.length)],
    ];

    for (let i = pwd.length; i < 16; i++) {
        pwd.push(all[rand()]);
    }

    // Shuffle
    for (let i = pwd.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
    }

    return pwd.join("");
}

/**
 * Throw if the connected user is not an admin
 * @param {object} socket Socket.io instance
 * @returns {Promise<void>}
 */
async function requireAdmin(socket) {
    checkLogin(socket);
    if (!(await isAdmin(socket.userID))) {
        throw new Error("Requires admin privileges.");
    }
}

/**
 * Handlers for user and group management
 * @param {object} socket Socket.io instance
 * @returns {void}
 */
module.exports.userGroupSocketHandler = (socket) => {

    // --- User management ---

    socket.on("getUserList", async (callback) => {
        try {
            await requireAdmin(socket);
            const users = await R.getAll("SELECT id, username, active, admin FROM `user` ORDER BY id");
            callback({ ok: true, userList: users });
        } catch (e) {
            callback({ ok: false, msg: e.message });
        }
    });

    socket.on("addUser", async (data, callback) => {
        try {
            await requireAdmin(socket);

            const { username, active = true } = data;

            if (!username) {
                throw new Error("Username is required.");
            }

            const existing = await R.findOne("user", " username = ? ", [username]);
            if (existing) {
                throw new Error("Username already exists.");
            }

            const tempPassword = generatePassword();

            let user = R.dispense("user");
            user.username = username;
            user.password = await passwordHash.generate(tempPassword);
            user.active = active ? 1 : 0;
            user.admin = 0;
            user.force_password_reset = 1;
            await R.store(user);

            log.info("user-group", `Admin ${socket.userID} added user ${username}`);

            callback({ ok: true, msg: "User added.", id: user.id, tempPassword });
        } catch (e) {
            callback({ ok: false, msg: e.message });
        }
    });

    // Force password change — no old password needed, only valid when force_password_reset is set
    socket.on("forceChangePassword", async (newPassword, callback) => {
        try {
            checkLogin(socket);

            const user = await R.findOne("user", " id = ? ", [socket.userID]);
            if (!user) {
                throw new Error("User not found.");
            }

            if (!user.force_password_reset) {
                throw new Error("No forced reset pending.");
            }

            if (!newPassword || newPassword.length < 6) {
                throw new Error("Password is too short.");
            }

            await user.resetPassword(newPassword);
            await R.exec("UPDATE `user` SET force_password_reset = 0 WHERE id = ?", [socket.userID]);

            callback({ ok: true });
        } catch (e) {
            callback({ ok: false, msg: e.message });
        }
    });

    socket.on("editUser", async (data, callback) => {
        try {
            await requireAdmin(socket);

            const { id, username, password, active } = data;

            if (id === socket.userID) {
                throw new Error("Use the Security settings to change your own account.");
            }

            let user = await R.findOne("user", " id = ? ", [id]);
            if (!user) {
                throw new Error("User not found.");
            }

            if (username) {
                const conflict = await R.findOne("user", " username = ? AND id != ? ", [username, id]);
                if (conflict) {
                    throw new Error("Username already exists.");
                }
                user.username = username;
            }

            if (password) {
                user.password = await passwordHash.generate(password);
            }

            if (active !== undefined) {
                user.active = active ? 1 : 0;
            }

            await R.store(user);

            log.info("user-group", `Admin ${socket.userID} edited user ${id}`);

            callback({ ok: true, msg: "User updated." });
        } catch (e) {
            callback({ ok: false, msg: e.message });
        }
    });

    socket.on("deleteUser", async (userID, callback) => {
        try {
            await requireAdmin(socket);

            if (userID === socket.userID) {
                throw new Error("You cannot delete your own account.");
            }

            const user = await R.findOne("user", " id = ? ", [userID]);
            if (!user) {
                throw new Error("User not found.");
            }

            if (user.admin) {
                throw new Error("Cannot delete admin users.");
            }

            await R.exec("DELETE FROM `user` WHERE id = ?", [userID]);

            log.info("user-group", `Admin ${socket.userID} deleted user ${userID}`);

            callback({ ok: true, msg: "User deleted." });
        } catch (e) {
            callback({ ok: false, msg: e.message });
        }
    });

    // --- Group management ---

    socket.on("getUserGroupList", async (callback) => {
        try {
            await requireAdmin(socket);
            const groups = await R.getAll("SELECT * FROM user_group ORDER BY id");
            callback({ ok: true, groupList: groups });
        } catch (e) {
            callback({ ok: false, msg: e.message });
        }
    });

    socket.on("addUserGroup", async (data, callback) => {
        try {
            await requireAdmin(socket);

            const { name, description = "" } = data;
            if (!name) {
                throw new Error("Group name is required.");
            }

            const result = await R.knex("user_group").insert({ name, description });
            const id = result[0];

            log.info("user-group", `Admin ${socket.userID} created group ${name}`);

            callback({ ok: true, msg: "Group created.", id });
        } catch (e) {
            callback({ ok: false, msg: e.message });
        }
    });

    socket.on("editUserGroup", async (data, callback) => {
        try {
            await requireAdmin(socket);

            const { id, name, description } = data;
            const update = {};
            if (name !== undefined) {
                update.name = name;
            }
            if (description !== undefined) {
                update.description = description;
            }

            await R.knex("user_group").where("id", id).update(update);

            log.info("user-group", `Admin ${socket.userID} edited group ${id}`);

            callback({ ok: true, msg: "Group updated." });
        } catch (e) {
            callback({ ok: false, msg: e.message });
        }
    });

    socket.on("deleteUserGroup", async (groupID, callback) => {
        try {
            await requireAdmin(socket);
            await R.knex("user_group").where("id", groupID).delete();
            log.info("user-group", `Admin ${socket.userID} deleted group ${groupID}`);
            callback({ ok: true, msg: "Group deleted." });
        } catch (e) {
            callback({ ok: false, msg: e.message });
        }
    });

    // --- Group membership ---

    socket.on("getUserGroupMembers", async (groupID, callback) => {
        try {
            await requireAdmin(socket);
            const members = await R.getAll(
                `SELECT u.id, u.username, u.active FROM user_group_member ugm
                 INNER JOIN \`user\` u ON u.id = ugm.user_id
                 WHERE ugm.group_id = ?`,
                [groupID]
            );
            callback({ ok: true, members });
        } catch (e) {
            callback({ ok: false, msg: e.message });
        }
    });

    socket.on("addUserToGroup", async (data, callback) => {
        try {
            await requireAdmin(socket);
            const { userID, groupID } = data;
            await R.knex("user_group_member").insert({ user_id: userID, group_id: groupID }).onConflict(["user_id", "group_id"]).ignore();
            callback({ ok: true, msg: "User added to group." });
        } catch (e) {
            callback({ ok: false, msg: e.message });
        }
    });

    socket.on("removeUserFromGroup", async (data, callback) => {
        try {
            await requireAdmin(socket);
            const { userID, groupID } = data;
            await R.knex("user_group_member").where({ user_id: userID, group_id: groupID }).delete();
            callback({ ok: true, msg: "User removed from group." });
        } catch (e) {
            callback({ ok: false, msg: e.message });
        }
    });

    // --- Group permissions ---

    socket.on("getGroupPermissions", async (groupID, callback) => {
        try {
            await requireAdmin(socket);
            const rows = await R.getAll(
                "SELECT permission FROM user_group_permission WHERE group_id = ?",
                [groupID]
            );
            callback({ ok: true, permissions: rows.map((r) => r.permission) });
        } catch (e) {
            callback({ ok: false, msg: e.message });
        }
    });

    socket.on("setGroupPermissions", async (data, callback) => {
        try {
            await requireAdmin(socket);
            const { groupID, permissions } = data;

            await R.knex("user_group_permission").where("group_id", groupID).delete();

            if (permissions && permissions.length > 0) {
                const rows = permissions.map((p) => ({ group_id: groupID, permission: p }));
                await R.knex("user_group_permission").insert(rows);
            }

            log.info("user-group", `Admin ${socket.userID} set permissions for group ${groupID}`);

            callback({ ok: true, msg: "Permissions updated." });
        } catch (e) {
            callback({ ok: false, msg: e.message });
        }
    });
};
