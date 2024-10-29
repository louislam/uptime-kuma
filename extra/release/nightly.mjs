import { buildDist, buildImage, checkDocker, getRepoName } from "./lib.mjs";

// Docker Hub repository name
const repoName = getRepoName();

// Check if docker is running
checkDocker();

// Build frontend dist (it will build on the host machine, TODO: build on a container?)
buildDist();

// Build full image (rootless)
buildImage(repoName, [ "nightly2-rootless" ], "nightly-rootless");

// Build full image
buildImage(repoName, [ "nightly2" ], "nightly");
