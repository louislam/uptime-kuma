const childProcess = require("child_process");

class Git {

    static clone(repoURL, cwd, targetDir = ".") {
        let result = childProcess.spawnSync("git", [
            "clone",
            repoURL,
            targetDir,
        ], {
            cwd: cwd,
        });

        if (result.status !== 0) {
            throw new Error(result.stderr.toString("utf-8"));
        } else {
            return result.stdout.toString("utf-8") + result.stderr.toString("utf-8");
        }
    }
}

module.exports = {
    Git,
};
