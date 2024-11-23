const childProcess = require("child_process");
const fs = require("fs");

const newVersion = process.env.RELEASE_VERSION;

if (!newVersion) {
    console.log("Missing version");
    process.exit(1);
}

updateWiki(newVersion);

/**
 * Update the wiki with new version number
 * @param {string} newVersion Version to update to
 * @returns {void}
 */
function updateWiki(newVersion) {
    const wikiDir = "./tmp/wiki";
    const howToUpdateFilename = "./tmp/wiki/🆙-How-to-Update.md";

    safeDelete(wikiDir);

    childProcess.spawnSync("git", [ "clone", "https://github.com/louislam/uptime-kuma.wiki.git", wikiDir ]);
    let content = fs.readFileSync(howToUpdateFilename).toString();

    // Replace the version: https://regex101.com/r/hmj2Bc/1
    content = content.replace(/(git checkout )([^\s]+)/, `$1${newVersion}`);
    fs.writeFileSync(howToUpdateFilename, content);

    childProcess.spawnSync("git", [ "add", "-A" ], {
        cwd: wikiDir,
    });

    childProcess.spawnSync("git", [ "commit", "-m", `Update to ${newVersion}` ], {
        cwd: wikiDir,
    });

    console.log("Pushing to Github");
    childProcess.spawnSync("git", [ "push" ], {
        cwd: wikiDir,
    });

    safeDelete(wikiDir);
}

/**
 * Check if a directory exists and then delete it
 * @param {string} dir Directory to delete
 * @returns {void}
 */
function safeDelete(dir) {
    if (fs.existsSync(dir)) {
        fs.rm(dir, {
            recursive: true,
        });
    }
}
