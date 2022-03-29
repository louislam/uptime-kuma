const { checkLogin, setSetting, setting } = require("../util-server");
const { CloudflaredTunnel } = require("node-cloudflared-tunnel");
const { io } = require("../server");

const prefix = "cloudflared_";
const cloudflared = new CloudflaredTunnel();

let isRunning;

cloudflared.change = (running, message) => {
    io.to("cloudflared").emit(prefix + "running", running);
    io.to("cloudflared").emit(prefix + "message", message);
    isRunning = running;

};

cloudflared.error = (errorMessage) => {
    io.to("cloudflared").emit(prefix + "errorMessage", errorMessage);
};

module.exports.cloudflaredSocketHandler = (socket) => {

    socket.on(prefix + "join", async () => {
        try {
            checkLogin(socket);
            socket.join("cloudflared");
            io.to(socket.userID).emit(prefix + "installed", cloudflared.checkInstalled());
            io.to(socket.userID).emit(prefix + "running", isRunning);
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
                token = token.trim();

                // try to strip out "cloudflared.exe service install"
                let array = token.split(" ");
                if (array.length > 1) {
                    for (let i = 0; i < array.length - 1; i++) {
                        if (array[i] === "install") {
                            token = array[i + 1];
                        }
                    }
                }

                await setSetting("cloudflaredTunnelToken", token);
                cloudflared.token = token;
            } else {
                cloudflared.token = null;
            }
            cloudflared.start();
        } catch (error) { }
    });

    socket.on(prefix + "stop", async () => {
        try {
            checkLogin(socket);
            cloudflared.stop();
        } catch (error) { }
    });

};
