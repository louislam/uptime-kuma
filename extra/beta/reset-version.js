const pkg = require("../../package.json");
const fs = require("fs");
const util = require("../../src/util");

util.polyfill();

const oldVersion = pkg.oldVersion;

if (!oldVersion) {
    console.log("Error: no old version?");
    process.exit(1);
}

delete pkg.oldVersion;
pkg.version = oldVersion;
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 4) + "\n");
