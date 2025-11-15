const pkg = require("../package.json");
const fs = require("fs");
const util = require("../src/util");
const dayjs = require("dayjs");

util.polyfill();

const oldVersion = pkg.version;
const newVersion = oldVersion + "-nightly-" + dayjs().format("YYYYMMDDHHmmss");

console.log("Old Version: " + oldVersion);
console.log("New Version: " + newVersion);

if (newVersion) {
    // Process package.json
    pkg.version = newVersion;
    pkg.scripts.setup = pkg.scripts.setup.replaceAll(oldVersion, newVersion);
    fs.writeFileSync("package.json", JSON.stringify(pkg, null, 4) + "\n");

    // Process README.md
    if (fs.existsSync("README.md")) {
        fs.writeFileSync("README.md", fs.readFileSync("README.md", "utf8").replaceAll(oldVersion, newVersion));
    }
}
