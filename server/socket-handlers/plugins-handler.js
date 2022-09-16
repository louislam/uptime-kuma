const { checkLogin } = require("../util-server");
const axios = require("axios");

/**
 * Handlers for plugins
 * @param {Socket} socket Socket.io instance
 */
module.exports.pluginsHandler = (socket) => {

    // Get Plugin List
    socket.on("getPluginList", async (callback) => {
        try {
            checkLogin(socket);
            const res = await axios.get("https://uptime.kuma.pet/c/plugins.json");
            callback(res.data);
        } catch (error) {
            console.log(error);
            callback({
                ok: false,
                msg: error.message,
            });
        }
    });

};
