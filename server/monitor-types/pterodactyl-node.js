const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const axios = require("axios");

class PterodactylNode extends MonitorType {
    name = "pterodactyl-node";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, server) {
        const pingStart = Date.now();
        const url = new URL(monitor.url);
        url.port = monitor.port;
        url.pathname = "/api/system";
        await axios.get(url.href, {
            headers: {
                Authorization: `Bearer ${monitor.apiKey}`
            }
        })
            .then(async res => {
                if (res.status === 200) {
                    heartbeat.msg = `Node is up, Version ${res.data.version}`;
                    heartbeat.status = UP;
                    heartbeat.ping = Date.now() - pingStart;
                } else {
                    throw Error(`Node is down, Status ${res.status}`);
                }
            });

    }

}

module.exports = {
    PterodactylNode,
};
