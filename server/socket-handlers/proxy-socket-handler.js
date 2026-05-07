const { Proxy } = require("../proxy");
const { sendProxyList } = require("../client");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const { onAuthed } = require("../utils/authed-event");
const server = UptimeKumaServer.getInstance();

/**
 * Handlers for proxy
 * @param {Socket} socket Socket.io instance
 * @returns {void}
 */
module.exports.proxySocketHandler = (socket) => {
    onAuthed(socket, "addProxy", async (socket, proxy, proxyID, callback) => {
        const proxyBean = await Proxy.save(proxy, proxyID, socket.userID);
        await sendProxyList(socket);

        if (proxy.applyExisting) {
            await Proxy.reloadProxy();
            await server.sendMonitorList(socket);
        }

        callback({
            ok: true,
            msg: "Saved.",
            msgi18n: true,
            id: proxyBean.id,
        });
    }, { fallbackMsg: "Failed to save proxy" });

    onAuthed(socket, "deleteProxy", async (socket, proxyID, callback) => {
        await Proxy.delete(proxyID, socket.userID);
        await sendProxyList(socket);
        await Proxy.reloadProxy();

        callback({
            ok: true,
            msg: "successDeleted",
            msgi18n: true,
        });
    }, { fallbackMsg: "Failed to delete proxy" });
};
