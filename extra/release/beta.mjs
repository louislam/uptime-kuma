import "dotenv/config";
import {
    ver,
    buildDist,
    buildImage,
    checkDocker,
    checkTagExists,
    checkVersionFormat,
    getRepoNames,
    execSync,
    checkReleaseBranch,
    createDistTarGz,
    createReleasePR,
} from "./lib.mjs";
import semver from "semver";

const repoNames = getRepoNames();
const version = process.env.RELEASE_BETA_VERSION;
const dryRun = process.env.DRY_RUN === "true";
const previousVersion = process.env.RELEASE_PREVIOUS_VERSION;

if (dryRun) {
    console.log("Dry run mode enabled. No images will be pushed.");
}

console.log("RELEASE_BETA_VERSION:", version);

// Check if the current branch is "release"
checkReleaseBranch();

// Check if the version is a valid semver
checkVersionFormat(version);

// Check if the semver identifier is "beta"
const semverIdentifier = semver.prerelease(version);
console.log("Semver identifier:", semverIdentifier);
if (semverIdentifier[0] !== "beta") {
    console.error("VERSION should have a semver identifier of 'beta'");
    process.exit(1);
}

// Check if docker is running
checkDocker();

// Check if the tag exists
await checkTagExists(repoNames, version);

// node extra/beta/update-version.js
execSync("node ./extra/beta/update-version.js");

// Build frontend dist
buildDist();

// TODO: Create Pull Request
await createReleasePR(version, previousVersion, dryRun);

if (!dryRun) {
    // Build slim image (rootless)
    buildImage(
        repoNames,
        ["beta-slim-rootless", ver(version, "slim-rootless")],
        "rootless",
        "BASE_IMAGE=louislam/uptime-kuma:base2-slim"
    );

    // Build full image (rootless)
    buildImage(repoNames, ["beta-rootless", ver(version, "rootless")], "rootless");

    // Build slim image
    buildImage(repoNames, ["beta-slim", ver(version, "slim")], "release", "BASE_IMAGE=louislam/uptime-kuma:base2-slim");

    // Build full image
    buildImage(repoNames, ["beta", version], "release");
} else {
    console.log("Dry run mode - skipping image build and push.");
}

// TODO: Create
await createDistTarGz();
