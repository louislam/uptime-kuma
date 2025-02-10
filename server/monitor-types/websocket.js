const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const childProcessAsync = require("promisify-child-process");

class websocket extends MonitorType {
    name = "websocket";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        //let status_code = await this.attemptUpgrade(monitor.url);
        let statusCode = await this.curlTest(monitor.url);
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
     * Checks if status code is 101 and sets status
     * @param {object} heartbeat The heartbeat object to update.
     * @param {string} statusCode Status code from curl
     * @returns {void}
     */
    updateStatus(heartbeat, statusCode) {
        if (statusCode === "101") {
            heartbeat.status = UP;
        }
        heartbeat.msg = statusCode;
    }

    // Attempt at using websocket library. Abandoned this idea because of the lack of control of headers. Certain websocket servers don't return the Sec-WebSocket-Accept, which causes websocket to error out.
    // async attemptUpgrade(hostname) {
    //     return new Promise((resolve) => {
    //         const ws = new WebSocket('wss://' + hostname);

    //         ws.addEventListener("open", (event) => {
    //             ws.close();
    //         });

    //         ws.onerror = (error) => {
    //             console.log(error.message);
    //         };

    //         ws.onclose = (event) => {
    //             if (event.code === 1005) {
    //                 resolve(true);
    //             } else {
    //                 resolve(false);
    //             }
    //         };
    //     })
    // }
}

module.exports = {
    websocket,
};
