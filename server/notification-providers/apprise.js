const NotificationProvider = require("./notification-provider");
const childProcess = require("child_process");

class Apprise extends NotificationProvider {

    name = "apprise";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const args = [ "-vv", "-b", msg, notification.appriseURL ];
        if (notification.title) {
            args.push("-t");
            args.push(notification.title);
        }
        const s = childProcess.spawnSync("apprise", args);

        const output = (s.stdout) ? s.stdout.toString() : "ERROR: maybe apprise not found";

        if (output) {

            if (! output.includes("ERROR")) {
                return "Sent Successfully";
            }

            throw new Error(output);
        } else {
            return "No output from apprise";
        }
    }
}

module.exports = Apprise;
