const { checkLogin } = require("../util-server");

const prefix = "cloudflared_";

module.exports.cloudflaredSocketHandler = (socket) => {

    socket.on(prefix + "start", async (callback) => {
        try {
            checkLogin(socket);

        } catch (error) {
            callback({
                ok: false,
                msg: error.message,
            });
        }
    });

};
