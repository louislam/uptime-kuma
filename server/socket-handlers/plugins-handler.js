const { checkLogin } = require("../util-server");
const axios = require("axios");

/**
 * Handlers for plugins
 * @param {Socket} socket Socket.io instance
 * @param {UptimeKumaServer} server
 */
module.exports.pluginsHandler = (socket, server) => {

    // Get Plugin List
    socket.on("getPluginList", async (callback) => {
        try {
            checkLogin(socket);

            let list = server.getPluginManager().getPluginList();
            console.log(list);

            const res = await axios.get("https://uptime.kuma.pet/c/plugins.json");
            callback(res.data);
        } catch (error) {
            callback({
                ok: false,
                msg: error.message,
            });
        }
    });

};
