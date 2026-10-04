// Install only the npm packages needed by the release scripts, skipping the
// full project dependency tree (which is slow). Temporarily empties the
// dependency lists of package.json and removes package-lock.json so `npm install`
// only fetches dotenv/semver/tar, then restores both files before the release
// scripts run (they commit package.json, so the originals must be intact).
//
// Usage: node extra/release/install-deps.mjs

import * as childProcess from "child_process";
import fs from "fs";

const pkgBackup = "package.json.bak";
const lockBackup = "package-lock.json.bak";

// Back up the original files
fs.copyFileSync("package.json", pkgBackup);
const hadLock = fs.existsSync("package-lock.json");
if (hadLock) {
    fs.copyFileSync("package-lock.json", lockBackup);
}

// Strip deps so npm install only fetches the packages below
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

// Restore the original files before the release scripts run
fs.copyFileSync(pkgBackup, "package.json");
fs.rmSync(pkgBackup, { force: true });
if (hadLock) {
    fs.copyFileSync(lockBackup, "package-lock.json");
    fs.rmSync(lockBackup, { force: true });
}

if (result.status !== 0) {
    process.exit(result.status ?? 1);
}