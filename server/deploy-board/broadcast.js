/** Socket event that carries the whole board state on every change. */
const UPDATE_EVENT = "deployBoardUpdate";

/**
 * Send the board state to every logged-in socket, and to nobody else.
 *
 * `io.emit` would also reach the anonymous sockets of public status pages; the deploy board names
 * repositories, commits and releases, which only a logged-in user may see.
 * @param {object} io Socket.io server.
 * @param {object} snapshot Board state.
 * @returns {number} How many sockets received it.
 */
function broadcastToLoggedIn(io, snapshot) {
    let sent = 0;
    for (const socket of io.sockets.sockets.values()) {
        if (socket.userID) {
            socket.emit(UPDATE_EVENT, snapshot);
            sent++;
        }
    }
    return sent;
}

module.exports = {
    UPDATE_EVENT,
    broadcastToLoggedIn,
};
