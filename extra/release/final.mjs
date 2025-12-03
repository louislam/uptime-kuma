import "dotenv/config";
import {
    ver,
    buildDist,
    buildImage,
    checkDocker,
    checkTagExists,
    checkVersionFormat,
    getRepoNames,
    pressAnyKey, execSync, uploadArtifacts, checkReleaseBranch
} from "./lib.mjs";

const repoNames = getRepoNames();
const version = process.env.RELEASE_VERSION;
const githubToken = process.env.RELEASE_GITHUB_TOKEN;

console.log("RELEASE_VERSION:", version);

if (!githubToken) {
    console.error("GITHUB_TOKEN is required");
    process.exit(1);
}

// Check if the current branch is "release"
checkReleaseBranch();

// Check if the version is a valid semver
checkVersionFormat(version);

// Check if docker is running
checkDocker();

// Check if the tag exists
await checkTagExists(repoNames, version);

// node extra/beta/update-version.js
execSync("node extra/update-version.js");

// Build frontend dist
buildDist();

// Build slim image (rootless)
buildImage(repoNames, [ "2-slim-rootless", ver(version, "slim-rootless") ], "rootless", "BASE_IMAGE=louislam/uptime-kuma:base2-slim");

// Build full image (rootless)
buildImage(repoNames, [ "2-rootless", ver(version, "rootless") ], "rootless");

// Build slim image
buildImage(repoNames, [ "next-slim", "2-slim", ver(version, "slim") ], "release", "BASE_IMAGE=louislam/uptime-kuma:base2-slim");

// Build full image
buildImage(repoNames, [ "next", "2", version ], "release");

await pressAnyKey();

// npm run upload-artifacts
uploadArtifacts(version, githubToken);

// node extra/update-wiki-version.js
execSync("node extra/update-wiki-version.js");
