// Prepare stage of a release:
// 1. Validate version format
// 2. Reuse the existing open release PR if there is one (safe to re-run)
// 3. Otherwise create the release branch (--setup-branch, used by GitHub Actions),
//    bump the version (commit + push), and create a PR
//
// Usage: node extra/release/prepare-release.mjs [--setup-branch]

import "dotenv/config";
import * as childProcess from "child_process";
import semver from "semver";
import {
    checkReleaseBranch,
    checkVersionFormat,
    createReleasePR,
    findOpenPrByHead,
    getVersionFromEnv,
    isBetaRelease,
    savePrNumber,
} from "./lib.mjs";

/**
 * Run the prepare stage
 * @param {object} options Options
 * @param {boolean} options.setupBranch Delete and recreate the release branch (GitHub Actions only)
 * @returns {Promise<number>} The PR number
 */
export async function runPrepare({ setupBranch = false } = {}) {
    const version = getVersionFromEnv();
    const previousVersion = process.env.RELEASE_PREVIOUS_VERSION;
    const dryRun = process.env.DRY_RUN === "true";
    const isBeta = isBetaRelease();
    const branchName = `release-${version}`;
    const githubRunId = process.env.GITHUB_RUN_ID;

    console.log("VERSION:", version);

    // Check if the version is a valid semver
    checkVersionFormat(version);

    // Check the semver identifier
    const semverIdentifier = semver.prerelease(version);
    console.log("Semver identifier:", semverIdentifier);
    if (isBeta) {
        if (!semverIdentifier || semverIdentifier[0] !== "beta") {
            console.error("VERSION should have a semver identifier of 'beta'");
            process.exit(1);
        }
    } else {
        if (semverIdentifier) {
            console.error("VERSION should not have a semver identifier for final release");
            process.exit(1);
        }
    }

    // Resume support: reuse the existing open PR instead of recreating the branch
    const existingPrNumber = await findOpenPrByHead(branchName);
    if (existingPrNumber) {
        console.log(`Found existing open PR #${existingPrNumber} for ${branchName}, skipping branch setup.`);
        savePrNumber(existingPrNumber);
        return existingPrNumber;
    }

    if (setupBranch) {
        exec(`git push origin --delete "${branchName}"`, true);
        exec(`git branch -D "${branchName}"`, true);
        exec(`git checkout -b "${branchName}"`);
    } else {
        // Local usage: the developer must be on the release branch already
        checkReleaseBranch(branchName);
    }

    // Bump the version, commit and force push the branch
    await import("./update-version.mjs");

    // Create Pull Request (gh pr create will handle pushing the branch)
    return await createReleasePR(version, previousVersion, dryRun, branchName, githubRunId);
}

/**
 * Execute a shell command
 * @param {string} cmd Command to execute
 * @param {boolean} ignoreFailure Do not exit on failure
 * @returns {void}
 */
function exec(cmd, ignoreFailure = false) {
    const result = childProcess.spawnSync(cmd, {
        shell: true,
        stdio: "inherit",
    });

    if (result.status !== 0 && !ignoreFailure) {
        console.error(`Command failed: ${cmd}`);
        process.exit(1);
    }
}

if (import.meta.main) {
    const setupBranch = process.argv.includes("--setup-branch");
    await runPrepare({ setupBranch });
}
