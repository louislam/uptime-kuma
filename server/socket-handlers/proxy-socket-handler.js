const { checkLogin } = require("../util-server");
const { Proxy } = require("../proxy");
const { sendProxyList } = require("../client");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const server = UptimeKumaServer.getInstance();

/**
 * Handlers for proxy
 * @param {Socket} socket Socket.io instance
 */
module.exports.proxySocketHandler = (socket) => {
    socket.on("addProxy", async (proxy, proxyID, callback) => {

        log.debug("server/socket-handlers/proxy-socket-handler.js/proxySocketHandler(socket)/socket.on(addProxy)","");

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

        log.debug("server/socket-handlers/proxy-socket-handler.js/proxySocketHandler(socket)/socket.on(deleteProxy)","");

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
