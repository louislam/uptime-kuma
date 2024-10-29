import "dotenv/config";
import { execSync, spawnSync } from "child_process";

/**
 * Check if docker is running
 * @returns {void}
 */
export function checkDocker() {
    try {
        execSync("docker ps");
    } catch (error) {
        console.error("Docker is not running. Please start docker and try again.");
        process.exit(1);
    }
}

/**
 * Get Docker Hub repository name
 */
export function getRepoName() {
    return process.env.RELEASE_REPO_NAME || "louislam/uptime-kuma";
}

/**
 * Build frontend dist
 * @returns {void}
 */
export function buildDist() {
    execSync("npm run build", { stdio: "inherit" });
}

/**
 * Build docker image and push to Docker Hub
 * @param {string} repoName Docker Hub repository name
 * @param {string[]} tags Docker image tags
 * @param {string} target Dockerfile's target name
 * @param {string} buildArgs Docker build args
 * @param {string} dockerfile Path to Dockerfile
 * @param {string} platform Build platform
 * @returns {void}
 */
export function buildImage(repoName, tags, target, buildArgs = "", dockerfile = "docker/dockerfile", platform = "linux/amd64,linux/arm64,linux/arm/v7") {
    let args = [
        "buildx",
        "build",
        "-f",
        dockerfile,
        "--platform",
        platform,
    ];

    for (let tag of tags) {
        args.push("-t", `${repoName}:${tag}`);
    }

    args = [
        ...args,
        "--target",
        target,
        ".",
        "--push",
    ];

    spawnSync("docker", args, { stdio: "inherit" });
}
