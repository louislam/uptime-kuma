const { MonitorType } = require("./monitor-type");
const WebSocket = require("ws");
const { UP, DOWN } = require("../../src/util");

class WebSocketMonitorType extends MonitorType {
    name = "websocket-upgrade";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        const [ message, code ] = await this.attemptUpgrade(monitor);
        heartbeat.status = code === 1000 ? UP : DOWN;
        heartbeat.msg = message;
    }

    /**
     * Uses the builtin Websocket API to establish a connection to target server
     * @param {object} monitor The monitor object for input parameters.
     * @returns {[ string, int ]} Array containing a status message and response code
     */
    async attemptUpgrade(monitor) {
        return new Promise((resolve) => {
            const ws = new WebSocket(monitor.wsurl);

            ws.addEventListener("open", (event) => {
                // Immediately close the connection
                ws.close(1000);
            });

            ws.onerror = (error) => {
                // Give user the choice to ignore Sec-WebSocket-Accept header
                if (monitor.wsIgnoreHeaders && error.message === "Invalid Sec-WebSocket-Accept header") {
                    resolve([ "101 - OK", 1000 ]);
                }
                // Upgrade failed, return message to user
                resolve([ error.message, error.code ]);
            };

            ws.onclose = (event) => {
                // Upgrade success, connection closed successfully
                resolve([ "101 - OK", event.code ]);
            };
        });
    }
}

module.exports = {
    WebSocketMonitorType,
};
