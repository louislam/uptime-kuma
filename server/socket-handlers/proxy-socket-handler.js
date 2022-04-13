const { checkLogin } = require("../util-server");
const { Proxy } = require("../proxy");
const { sendProxyList } = require("../client");
const server = require("../server");

module.exports.proxySocketHandler = (socket) => {
    socket.on("addProxy", async (proxy, proxyID, callback) => {
        try {
            checkLogin(socket);

            const proxyBean = await Proxy.save(proxy, proxyID, socket.userID);
            await sendProxyList(socket);

            if (proxy.applyExisting) {
                await Proxy.reloadProxy();
                await server.sendMonitorList(socket);
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
            await Proxy.reloadProxy();

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
