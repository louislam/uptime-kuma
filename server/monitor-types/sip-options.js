const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const { exec } = require("promisify-child-process");

class SIPMonitorType extends MonitorType {
    name = "sip-options";
    supportsConditions = false;

    /**
     * Run the monitoring check on the given monitor
     * @param {Monitor} monitor Monitor to check
     * @param {Heartbeat} heartbeat Monitor heartbeat to update
     * @param {UptimeKumaServer} _server Uptime Kuma server
     * @returns {Promise<void>}
     * @throws Will throw an error if the command execution encounters any error.
     */
    async check(monitor, heartbeat, _server) {
        try {
            let sipsakOutput = await this.runSipSak(monitor.hostname, monitor.port, 3000);
            this.parseSipsakResponse(sipsakOutput, heartbeat);
        } catch (err) {
            throw new Error(`Error checking Sipsak: ${err} ${err.message} ${err.stack}`);
        }
    }

    /**
     * Runs Sipsak options ping
     * @param {string} hostname SIP server address to send options.
     * @param {number} port SIP server port
     * @param {number} timeout timeout of options reply
     * @returns {Promise<string>} A Promise that resolves to the output of the Sipsak options ping
     * @throws Will throw an error if the command execution encounters any error.
     */
    async runSipSak(hostname, port, timeout) {
        const { stdout, stderr } = await exec(`sipsak -s sip:${hostname}:${port} --from sip:sipsak@${hostname} -v`, { timeout: timeout });
        if (!stdout && stderr && stderr.toString()) {
            throw new Error(`Error in output: ${stderr.toString()}`);
        }
        if (stdout && stdout.toString()) {
            return stdout.toString();
        } else {
            throw new Error("No output from sipsak");
        }
    }

    /**
     * @param {string} res response to be parsed
     * @param {object} heartbeat heartbeat object to update
     * @returns {void} returns nothing
     */
    parseSipsakResponse(res, heartbeat) {
        let lines = res.split("\n");
        for (let line of lines) {
            if (line.includes("200 OK")) {
                heartbeat.status = UP;
                heartbeat.msg = line;
                break;
            }
        }
    }
}

module.exports = {
    SIPMonitorType,
};
