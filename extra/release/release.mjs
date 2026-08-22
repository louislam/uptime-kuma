// Unified release orchestrator for both final and beta releases.
// Beta is enabled with the --beta flag (or RELEASE_IS_BETA=true env var).
//
// Sequence:
//   1. Prepare: validate version, bump it on the release branch, create the draft PR
//   2. Merge: squash merge the PR into master
//   3. Draft release: generate changelog (LLM) and create the draft GitHub Release
//   4. Images: build the frontend dist once, then build and push all docker images
//   5. Assets: upload dist.tar.gz to the draft release
//
// Usage:
//   node extra/release/release.mjs          # final release
//   node extra/release/release.mjs --beta   # beta release

import "dotenv/config";
import { buildDist, checkDocker, getVersionFromEnv } from "./lib.mjs";
import { runPrepare } from "./prepare-release.mjs";
import { runMergePR } from "./merge-pr.mjs";
import { runCreateDraftRelease } from "./create-draft-release.mjs";
import { runBuildImages } from "./build-images.mjs";
import { runBuildAndUploadAssets } from "./build-and-upload-assets.mjs";

if (process.argv.includes("--beta")) {
    process.env.RELEASE_IS_BETA = "true";
}

const version = getVersionFromEnv();
const dryRun = process.env.DRY_RUN === "true";

if (dryRun) {
    console.log("Dry run mode enabled. No images will be pushed.");
}

console.log("RELEASE_VERSION:", version);

// Fail fast if docker is not running
checkDocker();

// 1. Validate the version, bump it on the release branch and create the draft PR
//    (reuses the existing open PR if there is one)
await runPrepare();

// 2. Squash merge the PR into master
await runMergePR();

// 3. Generate changelog (LLM categorization) and create the draft release
await runCreateDraftRelease();

// 4. Build the frontend dist once, then build and push all docker images
buildDist();
await runBuildImages();

// 5. Upload dist.tar.gz to the draft release
await runBuildAndUploadAssets();
