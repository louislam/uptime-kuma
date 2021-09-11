const pkg = require("../package.json");
const fs = require("fs");
const child_process = require("child_process");
const util = require("../src/util");

util.polyfill();

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
    pkg.scripts["build-docker-alpine"] = pkg.scripts["build-docker-alpine"].replaceAll(oldVersion, newVersion);
    pkg.scripts["build-docker-debian"] = pkg.scripts["build-docker-debian"].replaceAll(oldVersion, newVersion);
    fs.writeFileSync("package.json", JSON.stringify(pkg, null, 4) + "\n");

    commit(newVersion);
    tag(newVersion);
} else {
    console.log("version exists")
}

function commit(version) {
    let msg = "update to " + version;

    let res = child_process.spawnSync("git", ["commit", "-m", msg, "-a"]);
    let stdout = res.stdout.toString().trim();
    console.log(stdout)

    if (stdout.includes("no changes added to commit")) {
        throw new Error("commit error")
    }
}

function tag(version) {
    let res = child_process.spawnSync("git", ["tag", version]);
    console.log(res.stdout.toString().trim())
}

function tagExists(version) {
    if (! version) {
        throw new Error("invalid version");
    }

    let res = child_process.spawnSync("git", ["tag", "-l", version]);

    return res.stdout.toString().trim() === version;
}
