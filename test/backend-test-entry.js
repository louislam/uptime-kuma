// Check Node.js version
const semver = require("semver");
const childProcess = require("child_process");

const nodeVersion = process.versions.node;
console.log("Node.js version: " + nodeVersion);



// Node.js version >= 18
if (semver.satisfies(nodeVersion, ">= 18")) {
    console.log("Use the native test runner: `node --test`");
    childProcess.execSync("npm run test-backend:18", { stdio: "inherit" });
} else {
    // 14 - 16 here
    console.log("Use `test` package: `node--test`")
    childProcess.execSync("npm run test-backend:14", { stdio: "inherit" });
}


