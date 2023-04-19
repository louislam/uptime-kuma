const { checkLogin } = require("../util-server");
const Database = require("../database");

/**
 * Handlers for database
 * @param {Socket} socket Socket.io instance
 */
module.exports = (socket) => {

    // Post or edit incident
    socket.on("getDatabaseSize", async (callback) => {

        log.debug("server/socket-handlers/database-socket-handler.js/(socket)/socket.on(getDatabaseSize)","");

        try {
            checkLogin(socket);
            callback({
                ok: true,
                size: Database.getSize(),
            });
        } catch (error) {
            callback({
                ok: false,
                msg: error.message,
            });
        }
    });

    socket.on("shrinkDatabase", async (callback) => {

        log.debug("server/socket-handlers/database-socket-handler.js/(socket)/socket.on(shrinkDatabase)","");

        try {
            checkLogin(socket);
            Database.shrink();
            callback({
                ok: true,
            });
        } catch (error) {
            callback({
                ok: false,
                msg: error.message,
            });
        }
    });

};
