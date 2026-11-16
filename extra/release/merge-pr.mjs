// Merge stage of a release:
// Squash merge the release PR into master.
// Safe to re-run: skips if the PR is already merged, and records the merge commit SHA
// in ./tmp/merge-sha.txt for the draft release stage.
//
// Usage: node extra/release/merge-pr.mjs

import "dotenv/config";
import * as childProcess from "child_process";
import fs from "fs";
import {
    findOpenPrByHead,
    getPrMergeCommit,
    getVersionFromEnv,
    isPrMerged,
    saveMergeSha,
} from "./lib.mjs";

const version = getVersionFromEnv();
const dryRun = process.env.DRY_RUN === "true";
const prNumberFile = "./tmp/pr-number.txt";

if (!version) {
    console.error("RELEASE_VERSION or RELEASE_BETA_VERSION is required");
    process.exit(1);
}

/**
 * Resolve the PR number from env, file, or by looking it up on GitHub
 * @returns {Promise<number|null>} PR number or null if not found
 */
async function resolvePrNumber() {
    // 1. From PR_NUMBER env var (GitHub Actions output of the prepare job)
    if (process.env.PR_NUMBER) {
        return parseInt(process.env.PR_NUMBER, 10);
    }

    // 2. From the file written during the prepare stage (local usage)
    if (fs.existsSync(prNumberFile)) {
        return parseInt(fs.readFileSync(prNumberFile, "utf-8").trim(), 10);
    }

    // 3. Look up the open PR for the release branch
    return await findOpenPrByHead(`release-${version}`);
}

/**
 * Run the merge stage
 * @returns {Promise<void>}
 */
export async function runMergePR() {
    const prNumber = await resolvePrNumber();

    if (!prNumber) {
        console.error("No open release PR found. Please run the prepare stage first.");
        process.exit(1);
    }

    console.log(`Release PR: #${prNumber}`);

    // Idempotency: skip if the PR is already merged (e.g. a previous run failed afterwards)
    if (await isPrMerged(prNumber)) {
        console.log(`PR #${prNumber} is already merged, skipping.`);
        await saveCurrentMergeSha(prNumber);
        return;
    }

    if (dryRun) {
        console.log(`[DRY RUN] gh pr merge ${prNumber} --squash --delete-branch --subject "Update to ${version}" --admin`);
        return;
    }

    console.log(`Squash merging PR #${prNumber}...`);
    childProcess.execSync(
        `gh pr merge ${prNumber} --squash --delete-branch --subject "Update to ${version}" --admin`,
        {
            stdio: "inherit",
        }
    );

    await saveCurrentMergeSha(prNumber);
}

/**
 * Get the merge commit SHA of the PR and save it to ./tmp/merge-sha.txt
 * @param {number} prNumber PR number
 * @returns {Promise<void>}
 */
async function saveCurrentMergeSha(prNumber) {
    const sha = await getPrMergeCommit(prNumber);
    if (sha) {
        console.log(`Merge commit: ${sha}`);
        saveMergeSha(sha);
    } else {
        console.warn("Could not determine the merge commit SHA.");
    }
}

if (import.meta.main) {
    await runMergePR();
}
