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
                const invalidAcceptCodes = [ "WS_ERR_INVALID_SEC_WEBSOCKET_ACCEPT_HEADER" ];
                let message = error?.message || "";

                // Some ws versions may not populate the message even for invalid accept headers
                if (!message && invalidAcceptCodes.includes(error?.code)) {
                    message = "Invalid Sec-WebSocket-Accept header";
                } else if (!message) {
                    message = "Unknown websocket error";
                }

                // Give user the choice to ignore Sec-WebSocket-Accept header
                if (monitor.wsIgnoreSecWebsocketAcceptHeader && (message === "Invalid Sec-WebSocket-Accept header" || invalidAcceptCodes.includes(error?.code))) {
                    resolve([ "101 - OK", 1000 ]);
                    return;
                }
                // Upgrade failed, return message to user
                resolve([ message, error?.code ]);
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
