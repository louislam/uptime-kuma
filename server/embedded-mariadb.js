const { log } = require("../src/util");
const childProcess = require("child_process");

class EmbeddedMariaDB {

    static childProcess = null;
    static running = false;

    static init() {

    }

    static start() {
        if (this.childProcess) {
            log.log("mariadb", "Already started");
            return;
        }

        this.running = true;
        this.emitChange("Starting cloudflared");
        this.childProcess = childProcess.spawn(this.cloudflaredPath, args);
        this.childProcess.stdout.pipe(process.stdout);
        this.childProcess.stderr.pipe(process.stderr);

        this.childProcess.on("close", (code) => {
            this.running = false;
            this.childProcess = null;
            this.emitChange("Stopped cloudflared", code);
        });

        this.childProcess.on("error", (err) => {
            if (err.code === "ENOENT") {
                this.emitError(`Cloudflared error: ${this.cloudflaredPath} is not found`);
            } else {
                this.emitError(err);
            }
        });

        this.childProcess.stderr.on("data", (data) => {
            this.emitError(data.toString());
        });
    }

    static stop() {
        if (this.childProcess) {
            this.childProcess.kill("SIGINT");
            this.childProcess = null;
        }
    }

}
