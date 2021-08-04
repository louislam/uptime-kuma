/**
 * String.prototype.replaceAll() polyfill
 * https://gomakethings.com/how-to-replace-a-section-of-a-string-with-another-one-with-vanilla-js/
 * @author Chris Ferdinandi
 * @license MIT
 */
if (!String.prototype.replaceAll) {
    String.prototype.replaceAll = function(str, newStr) {

        // If a regex pattern
        if (Object.prototype.toString.call(str).toLowerCase() === "[object regexp]") {
            return this.replace(str, newStr);
        }

        // If a string
        return this.replace(new RegExp(str, "g"), newStr);

    };
}

const pkg = require("../package.json");
const fs = require("fs");
const child_process = require("child_process");
const oldVersion = pkg.version;
const newVersion = process.argv[2];

console.log("Old Version: " + oldVersion);
console.log("New Version: " + newVersion);

if (! newVersion) {
    console.error("invalid version");
    process.exit(1);
}

const exists = tagExists(newVersion);

if (! exists) {
    // Process package.json
    pkg.version = newVersion;
    pkg.scripts.setup = pkg.scripts.setup.replaceAll(oldVersion, newVersion);
    pkg.scripts["build-docker"] = pkg.scripts["build-docker"].replaceAll(oldVersion, newVersion);
    fs.writeFileSync("package.json", JSON.stringify(pkg, null, 4) + "\n");

    // Process README.md
    fs.writeFileSync("README.md", fs.readFileSync("README.md", "utf8").replaceAll(oldVersion, newVersion));

    commit(newVersion);
    tag(newVersion);
} else {
    console.log("version exists")
}

function commit(version) {
    let msg = "update to " + version;
    child_process.spawnSync("git", ["commit", "-m", msg]);
}

function tag(version) {
    child_process.spawnSync("git", ["tag", version]);
}

function tagExists(version) {
    if (! version) {
        throw new Error("invalid version");
    }

    let res = child_process.spawnSync("git", ["tag", "-l", version]);

    return res.stdout.toString().trim() === version;
}
