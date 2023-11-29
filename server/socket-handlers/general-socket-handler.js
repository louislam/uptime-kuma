const { log } = require("../../src/util");
const { Settings } = require("../settings");
const { sendInfo } = require("../client");
const { checkLogin } = require("../util-server");
const GameResolver = require("gamedig/lib/GameResolver");
const { testChrome } = require("../monitor-types/real-browser-monitor-type");
const fs = require("fs");
const path = require("path");

let gameResolver = new GameResolver();
let gameList = null;

/**
 * Get a game list via GameDig
 * @returns {object[]} list of games supported by GameDig
 */
function getGameList() {
    if (gameList == null) {
        gameList = gameResolver._readGames().games.sort((a, b) => {
            if ( a.pretty < b.pretty ) {
                return -1;
            }
            if ( a.pretty > b.pretty ) {
                return 1;
            }
            return 0;
        });
    }
    return gameList;
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
        callback({
            ok: true,
            gameList: getGameList(),
        });
    });

    socket.on("testChrome", (executable, callback) => {
        // Just noticed that await call could block the whole socket.io server!!! Use pure promise instead.
        testChrome(executable).then((version) => {
            callback({
                ok: true,
                msg: {
                    key: "foundChromiumVersion",
                    values: [ version ],
                },
                msgi18n: true,
            });
        }).catch((e) => {
            callback({
                ok: false,
                msg: e.message,
            });
        });
    });

    socket.on("getPushExample", (language, callback) => {

        try {
            let dir = path.join("./extra/push-examples", language);
            let files = fs.readdirSync(dir);

            for (let file of files) {
                if (file.startsWith("index.")) {
                    callback({
                        ok: true,
                        code: fs.readFileSync(path.join(dir, file), "utf8"),
                    });
                    return;
                }
            }
        } catch (e) {

        }

        callback({
            ok: false,
            msg: "Not found",
        });
    });
};
