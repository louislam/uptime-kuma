import "dotenv/config";
import {
    ver,
    buildDist,
    buildImage,
    checkDocker,
    checkTagExists,
    checkVersionFormat,
    getRepoName,
    pressAnyKey, execSync, uploadArtifacts
} from "./lib.mjs";

const repoName = getRepoName();
const version = process.env.RELEASE_VERSION;
const githubToken = process.env.RELEASE_GITHUB_TOKEN;

console.log("RELEASE_VERSION:", version);

if (!githubToken) {
    console.error("GITHUB_TOKEN is required");
    process.exit(1);
}

// Check if the version is a valid semver
checkVersionFormat(version);

// Check if docker is running
checkDocker();

// Check if the tag exists
await checkTagExists(repoName, version);

// node extra/beta/update-version.js
execSync("node extra/update-version.js");

// Build frontend dist
buildDist();

// Build slim image (rootless)
buildImage(repoName, [ "2-slim-rootless", ver(version, "slim-rootless") ], "rootless", "BASE_IMAGE=louislam/uptime-kuma:base2-slim");

// Build full image (rootless)
buildImage(repoName, [ "2-rootless", ver(version, "rootless") ], "rootless");

// Build slim image
buildImage(repoName, [ "next-slim", "2-slim", ver(version, "slim") ], "release", "BASE_IMAGE=louislam/uptime-kuma:base2-slim");

// Build full image
buildImage(repoName, [ "next", "2", version ], "release");

await pressAnyKey();

// npm run upload-artifacts
uploadArtifacts(version, githubToken);

// node extra/update-wiki-version.js
execSync("node extra/update-wiki-version.js");
