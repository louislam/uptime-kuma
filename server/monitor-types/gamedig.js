const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const { GameDig } = require("gamedig");

class GameDigMonitorType extends MonitorType {
    name = "gamedig";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, server) {
        try {
            const state = await GameDig.query({
                type: monitor.game,
                host: monitor.hostname,
                port: monitor.port,
                givenPortOnly: Boolean(monitor.gamedigGivenPortOnly),
            });

            heartbeat.msg = state.name;
            heartbeat.status = UP;
            heartbeat.ping = state.ping;
        } catch (e) {
            throw new Error(e.message);
        }
    }
}

module.exports = {
    GameDigMonitorType,
};
