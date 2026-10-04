// Image build stage of a release:
// 1. Check the version tag does not exist on Docker Hub yet (double-release guard)
// 2. Build and push all docker images (skipped in dry run)
//
// The frontend dist is built once by the build-and-upload-assets job (or the
// local orchestrator) and is expected to already exist in ./dist.
//
// Usage: node extra/release/build-images.mjs

import "dotenv/config";
import fs from "fs";
import {
    buildAllImages,
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
        // dist must be built by the build-and-upload-assets job before this stage
        if (!fs.existsSync("dist")) {
            console.error("dist directory not found. Run the build-and-upload-assets job first.");
            process.exit(1);
        }

        buildAllImages(repoNames, version, isBeta);
    } else {
        console.log("Dry run mode - skipping image build and push.");
    }
}

if (import.meta.main) {
    await runBuildImages();
}
