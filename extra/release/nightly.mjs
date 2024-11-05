import { buildDist, buildImage, checkDocker, getRepoNames } from "./lib.mjs";

// Docker Hub repository name
const repoNames = getRepoNames();

// Check if docker is running
checkDocker();

// Build frontend dist (it will build on the host machine, TODO: build on a container?)
buildDist();

// Build full image (rootless)
buildImage(repoNames, [ "nightly2-rootless" ], "nightly-rootless");

// Build full image
buildImage(repoNames, [ "nightly2" ], "nightly");
