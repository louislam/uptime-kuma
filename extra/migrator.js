// Migrator for upgrading from v1 to v2
// Mainly for Docker users

if (!process.env.UPTIME_KUMA_IS_CONTAINER) {
    console.error("Migrator: Not running in a container");
    process.exit(1);
}

const fs = require("fs");
const path = require("path");
const args = require("args-parser")(process.argv);
const childProcess = require("child_process");

const dryRun = args["dry-run"] || false;

// Change the data directory's (Usually /app/data) owner to `node` user
const dataDir = process.env.DATA_DIR || args["data-dir"] || "./data/";

// Convert the `node` user to uid using `id -u node`
const nodeUID = Number(childProcess.execSync("id -u node").toString().trim());
const nodeGID = Number(childProcess.execSync("id -g node").toString().trim());

if (dryRun) {
    console.log("Dry-run enabled, no changes will be made");
}

console.log("Data directory:", dataDir);
console.log("node's uid:", nodeUID);
console.log("node's gid:", nodeGID);

chownDir(dataDir);

console.log("Done");

/**
 * Chown to node user recursively
 * Only if the data directory is not owned by node user
 * @param {string} dir Directory path
 * @returns {void}
 */
function chownDir(dir) {
    chown(dir);

    fs.readdirSync(dir).forEach((file) => {
        const filePath = path.join(dir, file);
        const fileStat = fs.statSync(filePath);

        if (fileStat.isDirectory()) {
            chownDir(filePath);
        } else {
            chown(filePath);
        }
    });
}

/**
 * @param {string} path File path
 * @returns {void}
 */
function chown(path) {
    const dataDirStat = fs.statSync(dataDir);

    if (dataDirStat.uid !== nodeUID || dataDirStat.gid !== nodeGID) {
        console.log(path, "is owned by", dataDirStat.uid + ":" + dataDirStat.gid);
        console.log(path, ": Changing owner to", nodeUID + ":" + nodeGID);

        if (!dryRun) {
            fs.chownSync(path, nodeUID, nodeGID);
        }
    }
}
