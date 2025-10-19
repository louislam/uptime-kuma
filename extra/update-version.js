const pkg = require("../package.json");
const fs = require("fs");
const childProcess = require("child_process");
const util = require("../src/util");

util.polyfill();

const newVersion = process.env.RELEASE_VERSION;

console.log("New Version: " + newVersion);

if (! newVersion) {
    console.error("invalid version");
    process.exit(1);
}

const exists = tagExists(newVersion);

if (! exists) {

    // Process package.json
    pkg.version = newVersion;

    // Replace the version: https://regex101.com/r/hmj2Bc/1
    pkg.scripts.setup = pkg.scripts.setup.replace(/(git checkout )([^\s]+)/, `$1${newVersion}`);
    fs.writeFileSync("package.json", JSON.stringify(pkg, null, 4) + "\n");

    // Also update package-lock.json
    const npm = /^win/.test(process.platform) ? "npm.cmd" : "npm";
    childProcess.spawnSync(npm, [ "install" ]);
    commit(newVersion);

} else {
    console.log("version exists");
}

/**
 * Commit updated files
 * @param {string} version Version to update to
 * @returns {void}
 * @throws Error when committing files
 */
function commit(version) {
    let msg = "Update to " + version;

    let res = childProcess.spawnSync("git", [ "commit", "-m", msg, "-a" ]);
    let stdout = res.stdout.toString().trim();
    console.log(stdout);

    if (stdout.includes("no changes added to commit")) {
        throw new Error("commit error");
    }
}

/**
 * Check if a tag exists for the specified version
 * @param {string} version Version to check
 * @returns {boolean} Does the tag already exist
 * @throws Version is not valid
 */
function tagExists(version) {
    if (! version) {
        throw new Error("invalid version");
    }

    let res = childProcess.spawnSync("git", [ "tag", "-l", version ]);

    return res.stdout.toString().trim() === version;
}
