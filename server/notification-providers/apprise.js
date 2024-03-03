const NotificationProvider = require("./notification-provider");
const childProcessAsync = require("promisify-child-process");

class Apprise extends NotificationProvider {
    name = "apprise";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        const args = [ "-vv", "-b", msg, notification.appriseURL ];
        if (notification.title) {
            args.push("-t");
            args.push(notification.title);
        }
        const s = await childProcessAsync.spawn("apprise", args, {
            encoding: "utf8",
        });

        const output = (s.stdout) ? s.stdout.toString() : "ERROR: maybe apprise not found";

        if (output) {

            if (! output.includes("ERROR")) {
                return okMsg;
            }

            throw new Error(output);
        } else {
            return "No output from apprise";
        }
    }
}

module.exports = Apprise;
