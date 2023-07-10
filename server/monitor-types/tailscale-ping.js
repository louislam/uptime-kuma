// TODO: Handle Case 5
// In cases where offline peers are not pingable, how should he handle timeout messages? Do we break out of the "ping (ip) timed out" loop and let the server re-call the check function? or do we include the "timed out" string in the expected error messages line and throw the error? (along with "no matching peer" and "is local Tailscale IP")

const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const exec = require('child_process').exec;

// cases accounted for
// 1 calling tailscale ping to local
// CMD: tailscale ping 100.100.100.1
// 100.100.100.1 is local Tailscale IP
// 2 the normal scenario
// CMD: tailscale ping 100.100.100.2
// pong from (hostname) (100.100.100.2) via [2001:1245:1234:1234::abc]:12345 in 123ms
// 3 ping a nonexistent IP or inaccessible node
// CMD: tailscale ping 100.100.100.3
// no matching peer
// 4 ping a peer that you cannot make a outgoing connection to
// CMD: tailscale ping 100.100.100.4
// multiple 'pong from' lines (pong from hostname (100.100.100.4) via DERP(tok) in 123ms) then ends with a 'direct connection not established' line
// We only care about the first 'pong from' line for the purpose of checking uptime. (this is a good example use of "tailscale ping" becasue traditional ICMP pings would not be able to check the uptime of peers if outgoing connections to that specified peer are blocked)
// 5 pinging a offline peer
// CMD: tailscale ping 100.100.100.5
// multiple 'timed out' lines (ping "100.100.100.5" timed out) then ends with a 'no reply' line
// This needs to be worked on

/**
 * A TailscalePing class extends the MonitorType.
 * It runs Tailscale ping to monitor the status of a specific node.
 */
class TailscalePing extends MonitorType {

    name = "tailscale-ping";
    
    /**
     * Checks the ping status of the URL associated with the monitor.
     * It then parses the Tailscale ping command output to update the heatrbeat.
     * 
     * @param {Object} monitor - The monitor object associated with the check.
     * @param {Object} heartbeat - The heartbeat object to update.
     * @throws Will throw an error if checking Tailscale ping encounters any error
     */
    async check(monitor, heartbeat) {
        try {
            let tailscaleOutput = await this.runTailscalePing(monitor.url);
            this.parseTailscaleOutput(tailscaleOutput, heartbeat);
        } catch (err) {
            // trigger log function somewhere to display a notification or alert to the user (but how?)
            throw new Error(`Error checking Tailscale ping: ${err}`);
        }
    }

    /**
     * Runs the Tailscale ping command to the given URL.
     * 
     * @param {string} url - The URL to ping.
     * @returns {Promise<string>} - A Promise that resolves to the output of the Tailscale ping command
     * @throws Will throw an error if the command execution encounters any error.
     */
    async runTailscalePing(url) {
        let cmd = `tailscale ping ${url}`;
        return new Promise((resolve, reject) => {
            let timeout = this.interval * 1000 * 0.8;
            exec(cmd, {timeout: timeout}, (error, stdout, stderr) => {
                // we may need to handle more cases if tailscale reports an error that isn't necessarily an error (such as not-logged in or DERP health-related issues) 
                if (error) {
                    reject(`Execution error: ${error.message}`);
                    return;
                }
                if (stderr) {
                    reject(`Error in output: ${stderr}`);
                    return;
                }
                resolve(stdout);
            });
        });
    }

    /**
     * Parses the output of the Tailscale ping command to update the heartbeat.
     * 
     * @param {string} tailscaleOutput - The output of the Tailscale ping command.
     * @param {Object} heartbeat - The heartbeat object to update.
     * @throws Will throw an eror if the output contains any unexpected string.
     */
    parseTailscaleOutput(tailscaleOutput, heartbeat) {
        let lines = tailscaleOutput.split('\n');

        for (let line of lines) {
            if (line.includes("pong from")) {
                heartbeat.status = UP;
                let time = line.split(" in ")[1].split(" ")[0];
                heartbeat.ping = parseInt(time);
                heartbeat.msg = line;
                break;
            } else if (line.includes("ping timed out")) {
                throw new Error(`Ping timed out: "${line}"`);
            } else if (line.includes("no matching peer")) {
                throw new Error(`Nonexistant or inaccessible due to ACLs: "${line}"`);
            } else if (line.includes("is local Tailscale IP")) {
                throw new Error(`Tailscale only works if used on other machines: "${line}"`);
            } else if (line !== '') {
                throw new Error(`Unexpected output: "${line}"`);
            }
        }
    }
}

module.exports = {
    TailscalePing,
};
