// Build + asset upload stage of a release:
// 1. Build the frontend dist ONCE (only if ./tmp/dist.tar.gz is missing)
// 2. Create ./tmp/dist.tar.gz from the built dist
// 3. Upload it to the draft GitHub Release (--clobber, so this stage can be re-run)
//
// The docker-images job reuses this built dist, so the frontend is compiled a
// single time per release.
//
// Usage: node extra/release/build-and-upload-assets.mjs

import "dotenv/config";
import * as childProcess from "child_process";
import fs from "fs";
import {
    createDistTarGz,
    getVersionFromEnv,
    releaseExists,
    uploadReleaseAssets,
} from "./lib.mjs";

const distTarGz = "./tmp/dist.tar.gz";

/**
 * Run the build + asset upload stage
 * @returns {Promise<void>}
 */
export async function runBuildAndUploadAssets() {
    const version = getVersionFromEnv();
    const dryRun = process.env.DRY_RUN === "true";

    if (!version) {
        console.error("RELEASE_VERSION or RELEASE_BETA_VERSION is required");
        process.exit(1);
    }

    if (!fs.existsSync(distTarGz)) {
        console.log(`${distTarGz} not found, building...`);
        // Build directly to also work in dry run mode
        childProcess.execSync("npm run build", { stdio: "inherit" });
        await createDistTarGz();
    }

    if (dryRun) {
        console.log("[DRY RUN] Skip uploading assets.");
        return;
    }

    if (!(await releaseExists(version))) {
        console.error(`Release ${version} does not exist. Please run the draft release stage first.`);
        process.exit(1);
    }

    await uploadReleaseAssets(version, [distTarGz]);
}

if (import.meta.main) {
    await runBuildAndUploadAssets();
}
