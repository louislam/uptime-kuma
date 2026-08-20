import "dotenv/config";
import * as childProcess from "child_process";
import fs from "fs";
import { generateChangelogAI } from "../generate-changelog.mjs";
import { createRelease } from "./lib.mjs";

const version = process.env.RELEASE_VERSION || process.env.RELEASE_BETA_VERSION;
const previousVersion = process.env.RELEASE_PREVIOUS_VERSION;
const dryRun = process.env.DRY_RUN === "true";
const isBeta = !!process.env.RELEASE_BETA_VERSION;
const prNumberFile = "./tmp/pr-number.txt";
const distTarGz = "./tmp/dist.tar.gz";

if (!version) {
    console.error("RELEASE_VERSION is required");
    process.exit(1);
}

if (!previousVersion) {
    console.error("RELEASE_PREVIOUS_VERSION is required");
    process.exit(1);
}

console.log(`Finishing release ${version}...`);

/**
 * @param cmd
 */
function execSync(cmd) {
    if (dryRun) {
        console.log(`[DRY RUN] ${cmd}`);
    } else {
        childProcess.execSync(cmd, { stdio: "inherit" });
    }
}

// Read PR number
if (!fs.existsSync(prNumberFile)) {
    console.error(`PR number file not found: ${prNumberFile}`);
    console.error("The PR must be created by the release script first.");
    process.exit(1);
}
const prNumber = fs.readFileSync(prNumberFile, "utf-8").trim();

console.log("Generating changelog...");
const changelog = await generateChangelogAI(previousVersion);
console.log("Changelog generated.");

// 2. Squash merge the PR
console.log(`Squash merging PR #${prNumber}...`);
execSync(`gh pr merge ${prNumber} --squash --delete-branch --subject "Update to ${version}" --admin`);

await createRelease(version, changelog, isBeta, distTarGz);
