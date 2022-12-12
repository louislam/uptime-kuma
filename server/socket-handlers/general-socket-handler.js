const { log } = require("../../src/util");
const { Settings } = require("../settings");
const { sendInfo } = require("../client");

module.exports.generalSocketHandler = (socket, server) => {

    socket.on("initServerTimezone", async (timezone) => {
        try {
            log.debug("generalSocketHandler", "Timezone: " + timezone);
            await Settings.set("initServerTimezone", true);
            await server.setTimezone(timezone);
            await sendInfo(socket);
        } catch (e) {

        }
    });

};
