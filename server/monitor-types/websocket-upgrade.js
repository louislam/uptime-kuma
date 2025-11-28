const { MonitorType } = require("./monitor-type");
const WebSocket = require("ws");
const { UP } = require("../../src/util");

class WebSocketMonitorType extends MonitorType {
    name = "websocket-upgrade";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        const [ message, code ] = await this.attemptUpgrade(monitor);

        if (code === 1000) {
            heartbeat.status = UP;
            heartbeat.msg = message;
        } else {
            throw new Error(message);
        }
    }

    /**
     * Uses the builtin Websocket API to establish a connection to target server
     * @param {object} monitor The monitor object for input parameters.
     * @returns {[ string, int ]} Array containing a status message and response code
     */
    async attemptUpgrade(monitor) {
        return new Promise((resolve) => {
            let ws;
            //If user selected a subprotocol, sets Sec-WebSocket-Protocol header. Subprotocol Identifier column: https://www.iana.org/assignments/websocket/websocket.xml#subprotocol-name
            ws = monitor.wsSubprotocol === "" ? new WebSocket(monitor.url) : new WebSocket(monitor.url, monitor.wsSubprotocol);

            ws.addEventListener("open", (event) => {
                // Immediately close the connection
                ws.close(1000);
            });

            ws.onerror = (error) => {
                // Give user the choice to ignore Sec-WebSocket-Accept header
                if (monitor.wsIgnoreSecWebsocketAcceptHeader && error.message === "Invalid Sec-WebSocket-Accept header") {
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
