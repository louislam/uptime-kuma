const { log } = require("../../src/util");
const { Settings } = require("../settings");
const { sendInfo } = require("../client");
const { checkLogin } = require("../util-server");
const { games } = require("gamedig");
const { testChrome } = require("../monitor-types/real-browser-monitor-type");
const fsAsync = require("fs").promises;
const path = require("path");
const process = require("process");
const { execFile } = require("child_process");

/**
 * Get a game list via GameDig
 * @returns {object} list of games supported by GameDig
 */
function getGameList() {
    let gameList = [];
    gameList = Object.keys(games).map((key) => {
        const item = games[key];
        return {
            keys: [key],
            pretty: item.name,
            options: item.options,
            extra: item.extra || {},
        };
    });
    gameList.sort((a, b) => {
        if (a.pretty < b.pretty) {
            return -1;
        }
        if (a.pretty > b.pretty) {
            return 1;
        }
        return 0;
    });
    return gameList;
}

/**
 * Handler for general events
 * @param {Socket} socket Socket.io instance
 * @param {UptimeKumaServer} server Uptime Kuma server
 * @returns {void}
 */
module.exports.generalSocketHandler = (socket, server) => {
    socket.on("initServerTimezone", async (timezone) => {
        try {
            checkLogin(socket);
            log.debug("generalSocketHandler", "Timezone: " + timezone);
            await Settings.set("initServerTimezone", true);
            await server.setTimezone(timezone);
            await sendInfo(socket);
        } catch (e) {
            log.warn("initServerTimezone", e.message);
        }
    });

    socket.on("getGameList", async (callback) => {
        try {
            checkLogin(socket);
            callback({
                ok: true,
                gameList: getGameList(),
            });
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("getPM2ProcessList", async (callback) => {
        try {
            checkLogin(socket);

            const isWindows = process.platform === "win32";
            const command = isWindows ? (process.env.ComSpec || "cmd.exe") : "pm2";
            const args = isWindows ? ["/d", "/s", "/c", "pm2 jlist"] : ["jlist"];

            execFile(command, args, { timeout: 5000 }, (error, stdout, stderr) => {
                if (error) {
                    callback({
                        ok: false,
                        msg: "Unable to query PM2 process list.",
                    });
                    return;
                }

                try {
                    const parsed = JSON.parse((stdout || "").toString());
                    if (!Array.isArray(parsed)) {
                        throw new Error("Unexpected PM2 output");
                    }

                    const processList = parsed.map((item) => {
                        const id = item.pm_id != null ? String(item.pm_id) : (item.name || "");
                        const name = item.name || id;
                        const status = item.pm2_env?.status || "unknown";
                        return {
                            id,
                            name,
                            status,
                        };
                    }).filter((item) => item.id !== "");

                    callback({
                        ok: true,
                        processList,
                    });
                } catch (parseError) {
                    let output = (stderr || "").toString().trim();
                    if (output.length > 200) {
                        output = output.substring(0, 200) + "...";
                    }
                    callback({
                        ok: false,
                        msg: output || "Unable to parse PM2 process list output.",
                    });
                }
            });
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("testChrome", (executable, callback) => {
        try {
            checkLogin(socket);
            // Just noticed that await call could block the whole socket.io server!!! Use pure promise instead.
            testChrome(executable)
                .then((version) => {
                    callback({
                        ok: true,
                        msg: {
                            key: "foundChromiumVersion",
                            values: [version],
                        },
                        msgi18n: true,
                    });
                })
                .catch((e) => {
                    callback({
                        ok: false,
                        msg: e.message,
                    });
                });
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
        }
    });

    socket.on("getPushExample", async (language, callback) => {
        try {
            checkLogin(socket);
            if (!/^[a-z-]+$/.test(language)) {
                throw new Error("Invalid language");
            }
        } catch (e) {
            callback({
                ok: false,
                msg: e.message,
            });
            return;
        }

        try {
            let dir = path.join("./extra/push-examples", language);
            let files = await fsAsync.readdir(dir);

            for (let file of files) {
                if (file.startsWith("index.")) {
                    callback({
                        ok: true,
                        code: await fsAsync.readFile(path.join(dir, file), "utf8"),
                    });
                    return;
                }
            }
        } catch (e) {}

        callback({
            ok: false,
            msg: "Not found",
        });
    });

    // Disconnect all other socket clients of the user
    socket.on("disconnectOtherSocketClients", async () => {
        try {
            checkLogin(socket);
            server.disconnectAllSocketClients(socket.userID, socket.id);
        } catch (e) {
            log.warn("disconnectAllSocketClients", e.message);
        }
    });
};
