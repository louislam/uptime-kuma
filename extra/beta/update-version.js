const pkg = require("../../package.json");
const fs = require("fs");
const childProcess = require("child_process");
const util = require("../../src/util");

util.polyfill();

const version = process.env.RELEASE_BETA_VERSION;

console.log("Beta Version: " + version);

if (!version || !version.includes("-beta.")) {
    console.error("invalid version, beta version only");
    process.exit(1);
}

const exists = tagExists(version);

if (! exists) {
    // Process package.json
    pkg.version = version;
    fs.writeFileSync("package.json", JSON.stringify(pkg, null, 4) + "\n");

    // Also update package-lock.json
    const npm = /^win/.test(process.platform) ? "npm.cmd" : "npm";
    childProcess.spawnSync(npm, [ "install" ]);
    commit(version);

} else {
    console.log("version tag exists, please delete the tag or use another tag");
    process.exit(1);
}

/**
 * Commit updated files
 * @param {string} version Version to update to
 * @returns {void}
 * @throws Error committing files
 */
function commit(version) {
    let msg = "Update to " + version;

    let res = childProcess.spawnSync("git", [ "commit", "-m", msg, "-a" ]);
    let stdout = res.stdout.toString().trim();
    console.log(stdout);

    if (stdout.includes("no changes added to commit")) {
        throw new Error("commit error");
    }

    res = childProcess.spawnSync("git", [ "push", "origin", "master" ]);
    console.log(res.stdout.toString().trim());
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
