const NotificationProvider = require("./notification-provider");
const { execFileAsync } = require("../util");

class Apprise extends NotificationProvider {
    name = "apprise";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        const args = ["-vv", "-b", msg];
        if (notification.title) {
            args.push("-t");
            args.push(notification.title);
        }
        args.push("--", notification.appriseURL);
        const s = await execFileAsync("apprise", args, {
            encoding: "utf8",
            maxBuffer: 1024 * 1024,
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
