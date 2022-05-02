const NotificationProvider = require("./notification-provider");
const childProcess = require("child_process");

/**
 * If you use an apprise backend that requires the notification title to
 * be set (such as for example messaging a Zulip Stream), you can use this
 * environment variable to configure the title.
 */
const { APPRISE_NOTIFICATION_TITLE } = process.env;

class Apprise extends NotificationProvider {

    name = "apprise";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const args = [ "-vv", "-b", msg, notification.appriseURL ];
        if (APPRISE_NOTIFICATION_TITLE) {
            args.push("-t");
            args.push(APPRISE_NOTIFICATION_TITLE);
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
