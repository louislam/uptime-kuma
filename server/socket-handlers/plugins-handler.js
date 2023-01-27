const { checkLogin } = require("../util-server");
const axios = require("axios");

/**
 * Handlers for plugins
 * @param {Socket} socket Socket.io instance
 * @param {UptimeKumaServer} server
 */
module.exports.pluginsHandler = (socket, server) => {

    const pluginManager = server.getPluginManager();

    // Get Plugin List
    socket.on("getPluginList", async (callback) => {
        try {
            checkLogin(socket);
            let pluginList = await pluginManager.fetchPluginList();
            callback({
                ok: true,
                pluginList,
            });
        } catch (error) {
            callback({
                ok: false,
                msg: error.message,
            });
        }
    });

    socket.on("installPlugin", async (repoURL, name, callback) => {
        try {
            checkLogin(socket);
            pluginManager.downloadPlugin(repoURL, name);
            pluginManager.loadPlugin(name);
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

    socket.on("uninstallPlugin", async (repoURL, callback) => {
        try {
            checkLogin(socket);
            //TODO
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
