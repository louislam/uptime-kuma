// Install only the npm packages needed by the release scripts, skipping the
// full project dependency tree (which is slow). Keeps package.json (the release
// scripts read it) but empties its dependency lists, removes the lockfile, then
// installs just dotenv/semver/tar.
//
// Usage: node extra/release/install-deps.mjs

import * as childProcess from "child_process";
import fs from "fs";

const rootPkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
rootPkg.dependencies = {};
rootPkg.devDependencies = {};
fs.writeFileSync("package.json", JSON.stringify(rootPkg, null, 4) + "\n");

fs.rmSync("package-lock.json", { force: true });

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const result = childProcess.spawnSync(
    npm,
    ["install", "--no-save", "--no-fund", "dotenv@~16.0.3", "semver@~7.5.4", "tar@~6.2.1"],
    { stdio: "inherit" }
);
if (result.status !== 0) {
    process.exit(result.status ?? 1);
}