const { MonitorType } = require("./monitor-type");
const WebSocket = require("ws");
const { UP, DOWN } = require("../../src/util");
const childProcessAsync = require("promisify-child-process");

class websocket extends MonitorType {
    name = "websocket";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        let statusCode = await this.attemptUpgrade(monitor);
        //let statusCode = await this.curlTest(monitor.url);
        this.updateStatus(heartbeat, statusCode);
    }

    /**
     * Attempts to upgrade HTTP/HTTPs connection to Websocket. Use curl to send websocket headers to server and returns response code. Close the connection after 1 second and wrap command in bash to return exit code 0 instead of 28.
     * @param {string} url Full URL of Websocket server
     * @returns {string} HTTP response code
     */
    async curlTest(url) {
        let res = await childProcessAsync.spawn("bash", [ "-c", "curl -s -o /dev/null -w '%{http_code}' --http1.1 -N --max-time 1 -H 'Upgrade: websocket' -H 'Sec-WebSocket-Key: test' -H 'Sec-WebSocket-Version: 13' " + url + " || true" ], {
            timeout: 5000,
            encoding: "utf8",
        });
        return res.stdout.toString();
    }

    /**
     * Checks if status code is 1000(Normal Closure) and sets status and message
     * @param {object} heartbeat The heartbeat object to update.
     * @param {[ string, int ]} status Array containing a status message and response code
     * @returns {void}
     */
    updateStatus(heartbeat, [ message, code ]) {
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
                ws.close(1000);
            });

            ws.onerror = (error) => {
                // console.log(error.message);
                // Give user the choice to ignore Sec-WebSocket-Accept header
                if (monitor.wsIgnoreHeaders && error.message === "Invalid Sec-WebSocket-Accept header") {
                    resolve([ "101 - OK", 1000 ]);
                }
                resolve([ error.message, error.code ]);
            };

            ws.onclose = (event) => {
                // console.log(event.message);
                // console.log(event.code);
                resolve([ "101 - OK", event.code ]);
            };
        });
    }
}

module.exports = {
    websocket,
};
