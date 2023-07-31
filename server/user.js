const { TimeLogger } = require("../src/util");
const { R } = require("redbean-node");
const { UptimeKumaServer } = require("./uptime-kuma-server");
const server = UptimeKumaServer.getInstance();
const io = server.io;

/**
 * Send list of users to client
 * @param {Socket} socket Socket.io socket instance
 * @returns {Promise<Bean[]>} list of users
 */
async function sendUserList(socket) {
    const timeLogger = new TimeLogger();
    const userList = await R.getAll("SELECT id, username, active FROM user");

    io.to(socket.userID).emit("userList", userList);
    timeLogger.print("Send User List");

    return userList;
}

/**
 * Fetch specified user
 * @param {number} userID ID of user to retrieve
 * @returns {Promise<Bean[]>} User
 */
async function getUser(userID) {
    const timeLogger = new TimeLogger();

    const user = await R.getRow(
        "SELECT id, username, active FROM user WHERE id = ? ",
        [ userID ]
    );

    if (!user) {
        throw new Error("User not found");
    }

    timeLogger.print(`Get user ${userID}`);

    return user;
}

/**
 * Saves and updates given user entity
 * @param {Socket} socket Socket.io socket instance
 * @param {object} user user to update
 * @returns {Promise<void>}
 */
async function saveUser(socket, user) {
    const timeLogger = new TimeLogger();
    const { id, username, active } = user;

    const bean = await R.findOne("user", " id = ? ", [ id ]);

    if (!bean) {
        throw new Error("User not found");
    }

    if (username) {
        bean.username = username;
    }
    if (active !== undefined) {
        bean.active = active;
    }

    await R.store(bean);

    io.to(socket.userID).emit("saveUser", bean);

    timeLogger.print(`Save user ${user.id}`);
}

module.exports = {
    sendUserList,
    getUser,
    saveUser
};
