const { log } = require("../../src/util");
const { Settings } = require("../settings");
const { sendInfo } = require("../client");
const { checkLogin } = require("../util-server");
const { games } = require("gamedig");
const { testChrome } = require("../monitor-types/real-browser-monitor-type");

/**
 * Get a game list via GameDig
 * @returns {Object[]} list of games supported by GameDig
 */
function getGameList() {
    let gamelist = [];
    gamelist = Object.keys(games).map(key => {
        const item = games[key];
        return {
            keys: [key ],
            pretty: item.name,
            options: item.options,
            extra: item.extra || {}
        };
    });
    gamelist.sort((a, b) => {
        if ( a.pretty < b.pretty ) {
            return -1;
        }
        if ( a.pretty > b.pretty ) {
            return 1;
        }
        return 0;
    });
    return gamelist;
}

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

    socket.on("testChrome", (executable, callback) => {
        try {
            checkLogin(socket);
            // Just noticed that await call could block the whole socket.io server!!! Use pure promise instead.
            testChrome(executable).then((version) => {
                callback({
                    ok: true,
                    msg: "Found Chromium/Chrome. Version: " + version,
                });
            }).catch((e) => {
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
