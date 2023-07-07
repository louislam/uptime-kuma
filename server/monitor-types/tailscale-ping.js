const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");

// child_process
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

class TailscalePing extends MonitorType {

    name = "tailscale-ping";

    async check(monitor, heartbeat) {
        // no let self???? no preserve context (this) for async function...
        // should console.log() be implemented?

        let cmd = `tailscale ping ${monitor.url}`;
       
        // Should we use promise-based code? tp wrap child_process.exec() in a new promise?
        childProcess.exec(cmd, (error, stdout, stderr) => {
            if (error) {
                throw new Error(`Execution error: ${error.message}`);
            }
            if (stderr) {
                throw new Error(`Error in output: ${stderr}`);
            }
            // "pong from" counts as UP, and we update heartbeat status and ping time
            // otherwise if "no matching peer" (nonexistant or inaccessible due to ACLs) or "is local Tailscale IP" (ping self), throw error
            // otherwise throw error and the unexpected output itself
            if (stdout.includes("pong from")) {
                heartbeat.status = UP;
                let time = stdout.split(" in ")[1].split(" ")[0];
                heartbeat.ping = parseInt(time);
                heartbeat.msg = stdout;
            } else if (stdout.includes("no matching peer") || stdout.includes("is local Tailscale IP")) {
                throw new Error(stdout);
            } else {
                throw new Error(`Unexpected output: ${stdout}`);
            }
        });
    }
}

module.exports = {
    TailscalePing,
};
