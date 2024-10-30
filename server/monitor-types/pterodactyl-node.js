const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const axios = require("axios");

class PterodactylNode extends MonitorType {
    name = "pterodactyl-node";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, server) {

        await axios.get(`${monitor.nodeHost}/api/system`, {
            headers: {
                Authorization: `Bearer ${monitor.apiKey}`
            }
        })
            .then(async res => {
                if (res.status === 200) {
                    const data = await res.json();
                    heartbeat.msg = `Node is up, Version ${data.version}`;
                    heartbeat.status = UP;
                } else {
                    throw Error(`Node is down, Status ${res.status}`);
                }
            });

    }

}

module.exports = {
    PterodactylNode,
};
