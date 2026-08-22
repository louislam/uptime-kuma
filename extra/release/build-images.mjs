// Image build stage of a release:
// 1. Check the version tag does not exist on Docker Hub yet (double-release guard)
// 2. Build the frontend dist
// 3. Build and push all docker images (skipped in dry run)
//
// Usage: node extra/release/build-images.mjs

import "dotenv/config";
import {
    buildAllImages,
    buildDist,
    checkDocker,
    checkTagExists,
    checkVersionFormat,
    getRepoNames,
    getVersionFromEnv,
    isBetaRelease,
} from "./lib.mjs";

/**
 * Run the image build stage
 * @returns {Promise<void>}
 */
export async function runBuildImages() {
    const version = getVersionFromEnv();
    const dryRun = process.env.DRY_RUN === "true";
    const isBeta = isBetaRelease();
    const repoNames = getRepoNames();

    if (!version) {
        console.error("RELEASE_VERSION or RELEASE_BETA_VERSION is required");
        process.exit(1);
    }

    // Check if the version is a valid semver
    checkVersionFormat(version);

    // Check if docker is running
    checkDocker();

    // Check if the tag exists on Docker Hub
    await checkTagExists(repoNames, version);

    if (!dryRun) {
        // Build frontend dist (bundled into the images)
        buildDist();

        buildAllImages(repoNames, version, isBeta);
    } else {
        console.log("Dry run mode - skipping dist and image build and push.");
    }
}

if (import.meta.main) {
    await runBuildImages();
}
