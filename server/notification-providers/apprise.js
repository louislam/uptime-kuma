const NotificationProvider = require("./notification-provider");
const childProcessAsync = require("promisify-child-process");

class Apprise extends NotificationProvider {
    name = "apprise";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        // Validate the Apprise URL to prevent argument injection into the
        // apprise CLI. An attacker-controlled value that begins with "-"
        // would otherwise be interpreted by apprise as a command-line option
        // (e.g. --plugin-path) rather than as a notification target URL.
        // Apprise notification URLs are of the form "<scheme>://..." — reject
        // anything that doesn't match that shape.
        const appriseURL = notification.appriseURL;
        if (typeof appriseURL !== "string" || !/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(appriseURL)) {
            throw new Error("Invalid Apprise URL");
        }

        const args = [ "-vv", "-b", msg ];
        if (notification.title) {
            args.push("-t", notification.title);
        }
        // Use "--" so any subsequent value (including the URL) is treated as a
        // positional argument by the apprise CLI rather than an option flag.
        args.push("--", appriseURL);

        const s = await childProcessAsync.spawn("apprise", args, {
            encoding: "utf8",
        });

        const output = s.stdout ? s.stdout.toString() : "ERROR: maybe apprise not found";

        if (output) {
            if (!output.includes("ERROR")) {
                return okMsg;
            }

            throw new Error(output);
        } else {
            return "No output from apprise";
        }
    }
}

module.exports = Apprise;
