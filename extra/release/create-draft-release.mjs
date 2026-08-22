// Draft release stage of a release:
// 1. Generate the changelog (LLM categorization via opencode, with retries)
// 2. Create the draft GitHub Release (skipped if it already exists, so this stage
//    can be re-run independently when the LLM call fails)
//
// Usage: node extra/release/create-draft-release.mjs

import "dotenv/config";
import {
    createDraftRelease,
    getVersionFromEnv,
    isBetaRelease,
    readMergeSha,
} from "./lib.mjs";
import { generateChangelogAI } from "./generate-changelog.mjs";

/**
 * Run the draft release stage
 * @returns {Promise<void>}
 */
export async function runCreateDraftRelease() {
    const version = getVersionFromEnv();
    const previousVersion = process.env.RELEASE_PREVIOUS_VERSION;
    const dryRun = process.env.DRY_RUN === "true";
    const isBeta = isBetaRelease();

    if (!version) {
        console.error("RELEASE_VERSION or RELEASE_BETA_VERSION is required");
        process.exit(1);
    }

    if (!previousVersion) {
        console.error("RELEASE_PREVIOUS_VERSION is required");
        process.exit(1);
    }

    console.log(`Generating changelog for ${version}...`);
    const changelog = await generateChangelogAI(previousVersion);

    if (dryRun) {
        console.log("[DRY RUN] Skip creating the draft release.");
        console.log("--- Changelog Start ---");
        console.log(changelog);
        console.log("--- Changelog End ---");
        return;
    }

    // Tag the exact merge commit when publishing, even if master moved on in the meantime
    const targetSha = readMergeSha();

    await createDraftRelease(version, changelog, isBeta, targetSha);
}

if (import.meta.main) {
    await runCreateDraftRelease();
}
