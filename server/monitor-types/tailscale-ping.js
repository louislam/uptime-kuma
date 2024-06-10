const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const childProcessAsync = require("promisify-child-process");

class TailscalePing extends MonitorType {
    name = "tailscale-ping";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        try {
            let tailscaleOutput = await this.runTailscalePing(monitor.hostname, monitor.interval);
            this.parseTailscaleOutput(tailscaleOutput, heartbeat);
        } catch (err) {
            // trigger log function somewhere to display a notification or alert to the user (but how?)
            throw new Error(`Error checking Tailscale ping: ${err}`);
        }
    }

    /**
     * Runs the Tailscale ping command to the given URL.
     * @param {string} hostname The hostname to ping.
     * @param {number} interval Interval to send ping
     * @returns {Promise<string>} A Promise that resolves to the output of the Tailscale ping command
     * @throws Will throw an error if the command execution encounters any error.
     */
    async runTailscalePing(hostname, interval) {
        let timeout = interval * 1000 * 0.8;
        let res = await childProcessAsync.spawn("tailscale", [ "ping", "--c", "1", hostname ], {
            timeout: timeout,
            encoding: "utf8",
        });
        if (res.stderr && res.stderr.toString()) {
            throw new Error(`Error in output: ${res.stderr.toString()}`);
        }
        if (res.stdout && res.stdout.toString()) {
            return res.stdout.toString();
        } else {
            throw new Error("No output from Tailscale ping");
        }
    }

    /**
     * Parses the output of the Tailscale ping command to update the heartbeat.
     * @param {string} tailscaleOutput The output of the Tailscale ping command.
     * @param {object} heartbeat The heartbeat object to update.
     * @returns {void}
     * @throws Will throw an eror if the output contains any unexpected string.
     */
    parseTailscaleOutput(tailscaleOutput, heartbeat) {
        let lines = tailscaleOutput.split("\n");

        for (let line of lines) {
            if (line.includes("pong from")) {
                heartbeat.status = UP;
                let time = line.split(" in ")[1].split(" ")[0];
                heartbeat.ping = parseInt(time);
                heartbeat.msg = "OK";
                break;
            } else if (line.includes("timed out")) {
                throw new Error(`Ping timed out: "${line}"`);
                // Immediately throws upon "timed out" message, the server is expected to re-call the check function
            } else if (line.includes("no matching peer")) {
                throw new Error(`Nonexistant or inaccessible due to ACLs: "${line}"`);
            } else if (line.includes("is local Tailscale IP")) {
                throw new Error(`Tailscale only works if used on other machines: "${line}"`);
            } else if (line !== "") {
                throw new Error(`Unexpected output: "${line}"`);
            }
        }
    }
}

module.exports = {
    TailscalePing,
};
