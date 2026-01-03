const { MonitorType } = require("./monitor-type");
const WebSocket = require("ws");
const { UP } = require("../../src/util");
const { checkStatusCode } = require("../util-server");
// Define closing error codes https://www.iana.org/assignments/websocket/websocket.xml#close-code-number
const WS_ERR_CODE = {
    1002: "Protocol error",
    1003: "Unsupported Data",
    1005: "No Status Received",
    1006: "Abnormal Closure",
    1007: "Invalid frame payload data",
    1008: "Policy Violation",
    1009: "Message Too Big",
    1010: "Mandatory Extension Missing",
    1011: "Internal Error",
    1012: "Service Restart",
    1013: "Try Again Later",
    1014: "Bad Gateway",
    1015: "TLS Handshake Failed",
    3000: "Unauthorized",
    3003: "Forbidden",
    3008: "Timeout",
};

class WebSocketMonitorType extends MonitorType {
    name = "websocket-upgrade";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        const [ message, code ] = await this.attemptUpgrade(monitor);

        if (typeof code !== "undefined") {
            // If returned status code matches user controlled accepted status code(default 1000), return success
            if (checkStatusCode(code, JSON.parse(monitor.accepted_statuscodes_json))) {
                heartbeat.status = UP;
                heartbeat.msg = message;
                return; // success at this point
            }

            // Throw an error using friendly name if defined, fallback to generic msg
            throw new Error(WS_ERR_CODE[code] || `Unexpected status code: ${code}`);
        }
        // If no close code, then an error has occurred, display to user
        if (typeof message !== "undefined") {
            throw new Error(`${message}`);
        }
        // Throw generic error if nothing is defined, should never happen
        throw new Error("Unknown Websocket Error");
    }

    /**
     * Uses the ws Node.js library to establish a connection to target server
     * @param {object} monitor The monitor object for input parameters.
     * @returns {[ string, int ]} Array containing a status message and response code
     */
    async attemptUpgrade(monitor) {
        return new Promise((resolve) => {
            const timeoutMs = (monitor.timeout ?? 20) * 1000;
            // If user inputs subprotocol(s), convert to array, set Sec-WebSocket-Protocol header, timeout in ms. Subprotocol Identifier column: https://www.iana.org/assignments/websocket/websocket.xml#subprotocol-name
            const subprotocol = monitor.wsSubprotocol ? monitor.wsSubprotocol.replace(/\s/g, "").split(",") : undefined;
            const ws = new WebSocket(monitor.url, subprotocol, { handshakeTimeout: timeoutMs });

            ws.addEventListener("open", (event) => {
                // Immediately close the connection
                ws.close(1000);
            });

            ws.onerror = (error) => {
                // Give user the choice to ignore Sec-WebSocket-Accept header for non compliant servers
                // Header in HTTP 101 Switching Protocols response from server, technically already upgraded to WS
                if (monitor.wsIgnoreSecWebsocketAcceptHeader && error.message === "Invalid Sec-WebSocket-Accept header") {
                    resolve([ "1000 - OK", 1000 ]);
                    return;
                }
                // Upgrade failed, return message to user
                resolve([ error.message, error.code ]);
            };

            ws.onclose = (event) => {
                // Return the close code, if connection didn't close cleanly, return the reason if present
                resolve([ event.wasClean ? event.code.toString() + " - OK" : event.reason, event.code ]);
            };
        });
    }
}

module.exports = {
    WebSocketMonitorType,
};
