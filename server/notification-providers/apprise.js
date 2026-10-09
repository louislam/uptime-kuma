const NotificationProvider = require("./notification-provider");
const childProcessAsync = require("promisify-child-process");

class Apprise extends NotificationProvider {
    name = "apprise";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        const args = ["-vv", "-b", msg, notification.appriseURL];
        if (notification.title) {
            args.push("-t");
            args.push(notification.title);
        }
        const s = await childProcessAsync.spawn("apprise", args, {
            encoding: "utf8",
        });

        // A successful run (exit code 0) may legitimately print nothing to
        // stdout, so empty output must not be treated as a failure (#5547).
        const output = s.stdout ? s.stdout.toString() : "";

        if (output.includes("ERROR")) {
            throw new Error(output);
        }

        return okMsg;
    }
}

module.exports = Apprise;
