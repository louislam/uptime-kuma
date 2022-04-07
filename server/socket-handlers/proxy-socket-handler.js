const { checkLogin } = require("../util-server");
const { Proxy } = require("../proxy");
const { sendProxyList } = require("../client");

module.exports.proxySocketHandler = (socket) => {
    socket.on("addProxy", async (proxy, proxyID, callback) => {
        try {
            checkLogin(socket);

            const proxyBean = await Proxy.save(proxy, proxyID, socket.userID);
            await sendProxyList(socket);

            if (proxy.applyExisting) {
                // TODO: await restartMonitors(socket.userID);
            }

            callback({
                ok: true,
                msg: "Saved",
                id: proxyBean.id,
            });

        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("deleteProxy", async (proxyID, callback) => {
        try {
            checkLogin(socket);

            await Proxy.delete(proxyID, socket.userID);
            await sendProxyList(socket);
            // TODO: await restartMonitors(socket.userID);

            callback({
                ok: true,
                msg: "Deleted",
            });

        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });
};
