const { checkLogin, setSetting, setting, doubleCheckPassword } = require("../util-server");
const { CloudflaredTunnel } = require("node-cloudflared-tunnel");
const { UptimeKumaServer } = require("../uptime-kuma-server");
const io = UptimeKumaServer.getInstance().io;

const prefix = "cloudflared_";
const cloudflared = new CloudflaredTunnel();

/**
 * Change running state
 * @param {string} running Is it running?
 * @param {string} message Message to pass
 */
cloudflared.change = (running, message) => {
    io.to("cloudflared").emit(prefix + "running", running);
    io.to("cloudflared").emit(prefix + "message", message);
};

/**
 * Emit an error message
 * @param {string} errorMessage
 */
cloudflared.error = (errorMessage) => {
    io.to("cloudflared").emit(prefix + "errorMessage", errorMessage);
};

/**
 * Handler for cloudflared
 * @param {Socket} socket Socket.io instance
 */
module.exports.cloudflaredSocketHandler = (socket) => {

    socket.on(prefix + "join", async () => {
        try {
            checkLogin(socket);
            socket.join("cloudflared");
            io.to(socket.userID).emit(prefix + "installed", cloudflared.checkInstalled());
            io.to(socket.userID).emit(prefix + "running", cloudflared.running);
            io.to(socket.userID).emit(prefix + "token", await setting("cloudflaredTunnelToken"));
        } catch (error) { }
    });

    socket.on(prefix + "leave", async () => {
        try {
            checkLogin(socket);
            socket.leave("cloudflared");
        } catch (error) { }
    });

    socket.on(prefix + "start", async (token) => {
        try {
            checkLogin(socket);
            if (token && typeof token === "string") {
                await setSetting("cloudflaredTunnelToken", token);
                cloudflared.token = token;
            } else {
                cloudflared.token = null;
            }
            cloudflared.start();
        } catch (error) { }
    });

    socket.on(prefix + "stop", async (currentPassword, callback) => {
        try {
            checkLogin(socket);
            await doubleCheckPassword(socket, currentPassword);
            cloudflared.stop();
        } catch (error) {
            callback({
                ok: false,
                msg: error.message,
            });
        }
    });

    socket.on(prefix + "removeToken", async () => {
        try {
            checkLogin(socket);
            await setSetting("cloudflaredTunnelToken", "");
        } catch (error) { }
    });

};

/**
 * Automatically start cloudflared
 * @param {string} token Cloudflared tunnel token
 */
module.exports.autoStart = async (token) => {
    if (!token) {
        token = await setting("cloudflaredTunnelToken");
    } else {
        // Override the current token via args or env var
        await setSetting("cloudflaredTunnelToken", token);
        console.log("Use cloudflared token from args or env var");
    }

    if (token) {
        console.log("Start cloudflared");
        cloudflared.token = token;
        cloudflared.start();
    }
};

/** Stop cloudflared */
module.exports.stop = async () => {
    console.log("Stop cloudflared");
    if (cloudflared) {
        cloudflared.stop();
    }
};
