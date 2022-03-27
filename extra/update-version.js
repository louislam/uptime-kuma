const pkg = require("../package.json");
const fs = require("fs");
const rmSync = require("./fs-rmSync.js");
const child_process = require("child_process");
const util = require("../src/util");

util.polyfill();

const newVersion = process.env.VERSION;

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

    commit(newVersion);
    tag(newVersion);

} else {
    console.log("version exists");
}

function commit(version) {
    let msg = "Update to " + version;

    let res = child_process.spawnSync("git", ["commit", "-m", msg, "-a"]);
    let stdout = res.stdout.toString().trim();
    console.log(stdout);

    if (stdout.includes("no changes added to commit")) {
        throw new Error("commit error");
    }
}

function tag(version) {
    let res = child_process.spawnSync("git", ["tag", version]);
    console.log(res.stdout.toString().trim());
}

function tagExists(version) {
    if (! version) {
        throw new Error("invalid version");
    }

    let res = child_process.spawnSync("git", ["tag", "-l", version]);

    return res.stdout.toString().trim() === version;
}

function updateWiki(oldVersion, newVersion) {
    const wikiDir = "./tmp/wiki";
    const howToUpdateFilename = "./tmp/wiki/🆙-How-to-Update.md";

    safeDelete(wikiDir);

    child_process.spawnSync("git", ["clone", "https://github.com/louislam/uptime-kuma.wiki.git", wikiDir]);
    let content = fs.readFileSync(howToUpdateFilename).toString();
    content = content.replaceAll(`git checkout ${oldVersion}`, `git checkout ${newVersion}`);
    fs.writeFileSync(howToUpdateFilename, content);

    child_process.spawnSync("git", ["add", "-A"], {
        cwd: wikiDir,
    });

    child_process.spawnSync("git", ["commit", "-m", `Update to ${newVersion} from ${oldVersion}`], {
        cwd: wikiDir,
    });

    console.log("Pushing to Github");
    child_process.spawnSync("git", ["push"], {
        cwd: wikiDir,
    });

    safeDelete(wikiDir);
}

function safeDelete(dir) {
    if (fs.existsSync(dir)) {
        rmSync(dir, {
            recursive: true,
        });
    }
}
