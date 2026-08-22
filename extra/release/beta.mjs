import "dotenv/config";
import { checkDocker } from "./lib.mjs";
import { runPrepare } from "./prepare-release.mjs";
import { runMergePR } from "./merge-pr.mjs";
import { runCreateDraftRelease } from "./create-draft-release.mjs";
import { runBuildImages } from "./build-images.mjs";
import { runUploadAssets } from "./upload-assets.mjs";

const version = process.env.RELEASE_BETA_VERSION;
const dryRun = process.env.DRY_RUN === "true";

if (dryRun) {
    console.log("Dry run mode enabled. No images will be pushed.");
}

console.log("RELEASE_BETA_VERSION:", version);

// Fail fast if docker is not running
checkDocker();

// 1. Validate the version, bump it on the release branch and create the draft PR
//    (reuses the existing open PR if there is one)
await runPrepare();

// 2. Squash merge the PR into master
await runMergePR();

// 3. Generate changelog (LLM categorization) and create the draft release
await runCreateDraftRelease();

// 4. Build and push all docker images
await runBuildImages();

// 5. Upload dist.tar.gz to the draft release
await runUploadAssets();
