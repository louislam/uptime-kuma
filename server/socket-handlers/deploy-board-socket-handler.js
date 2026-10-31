const { checkLogin } = require("../util-server");
const { deployBoard } = require("../deploy-board");

/**
 * Handlers for the deploy board page (/deploys/:slug). Logged-in only.
 * @param {Socket} socket Socket.io instance
 * @param {object} board Deploy board (injectable for tests)
 * @returns {void}
 */
module.exports.deployBoardSocketHandler = (socket, board = deployBoard) => {
    socket.on("getDeployBoard", (callback) => {
        if (typeof callback !== "function") {
            return;
        }
        try {
            checkLogin(socket);
            callback({
                ok: true,
                board: board.getSnapshot(),
            });
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });
};
