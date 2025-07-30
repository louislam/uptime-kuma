import "dotenv/config";
import * as childProcess from "child_process";
import semver from "semver";

export const dryRun = process.env.RELEASE_DRY_RUN === "1";

if (dryRun) {
    console.info("Dry run enabled.");
}

/**
 * Check if docker is running
 * @returns {void}
 */
export function checkDocker() {
    try {
        childProcess.execSync("docker ps");
    } catch (error) {
        console.error("Docker is not running. Please start docker and try again.");
        process.exit(1);
    }
}

/**
 * Get Docker Hub repository name
 */
export function getRepoNames() {
    if (process.env.RELEASE_REPO_NAMES) {
        // Split by comma
        return process.env.RELEASE_REPO_NAMES.split(",").map((name) => name.trim());
    }
    return [
        "louislam/uptime-kuma",
        "ghcr.io/louislam/uptime-kuma",
    ];
}

/**
 * Build frontend dist
 * @returns {void}
 */
export function buildDist() {
    if (!dryRun) {
        childProcess.execSync("npm run build", { stdio: "inherit" });
    } else {
        console.info("[DRY RUN] npm run build");
    }
}

/**
 * Build docker image and push to Docker Hub
 * @param {string[]} repoNames Docker Hub repository names
 * @param {string[]} tags Docker image tags
 * @param {string} target Dockerfile's target name
 * @param {string} buildArgs Docker build args
 * @param {string} dockerfile Path to Dockerfile
 * @param {string} platform Build platform
 * @returns {void}
 */
export function buildImage(repoNames, tags, target, buildArgs = "", dockerfile = "docker/dockerfile", platform = "linux/amd64,linux/arm64,linux/arm/v7") {
    let args = [
        "buildx",
        "build",
        "-f",
        dockerfile,
        "--platform",
        platform,
    ];

    for (let repoName of repoNames) {
        // Add tags
        for (let tag of tags) {
            args.push("-t", `${repoName}:${tag}`);
        }
    }

    args = [
        ...args,
        "--target",
        target,
    ];

    // Add build args
    if (buildArgs) {
        args.push("--build-arg", buildArgs);
    }

    args = [
        ...args,
        ".",
        "--push",
    ];

    if (!dryRun) {
        childProcess.spawnSync("docker", args, { stdio: "inherit" });
    } else {
        console.log(`[DRY RUN] docker ${args.join(" ")}`);
    }
}

/**
 * Check if the version already exists on Docker Hub
 * TODO: use semver to compare versions if it is greater than the previous?
 * @param {string[]} repoNames repository name (Only check the name with single slash)
 * @param {string} version Version to check
 * @returns {void}
 */
export async function checkTagExists(repoNames, version) {
    // Skip if the tag is not on Docker Hub
    // louislam/uptime-kuma
    let dockerHubRepoNames = repoNames.filter((name) => {
        return name.split("/").length === 2;
    });

    for (let repoName of dockerHubRepoNames) {
        await checkTagExistsSingle(repoName, version);
    }
}

/**
 * Check if the version already exists on Docker Hub
 * @param {string} repoName repository name
 * @param {string} version Version to check
 * @returns {Promise<void>}
 */
export async function checkTagExistsSingle(repoName, version) {
    console.log(`Checking if version ${version} exists on Docker Hub:`, repoName);

    // Get a list of tags from the Docker Hub repository
    let tags = [];

    // It is mainly to check my careless mistake that I forgot to update the release version in .env, so `page_size` is set to 100 is enough, I think.
    const response = await fetch(`https://hub.docker.com/v2/repositories/${repoName}/tags/?page_size=100`);
    if (response.ok) {
        const data = await response.json();
        tags = data.results.map((tag) => tag.name);
    } else {
        console.error("Failed to get tags from Docker Hub");
        process.exit(1);
    }

    // Check if the version already exists
    if (tags.includes(version)) {
        console.error(`Version ${version} already exists`);
        process.exit(1);
    }
}

/**
 * Check the version format
 * @param {string} version Version to check
 * @returns {void}
 */
export function checkVersionFormat(version) {
    if (!version) {
        console.error("VERSION is required");
        process.exit(1);
    }

    // Check the version format, it should be a semver and must be like this: "2.0.0-beta.0"
    if (!semver.valid(version)) {
        console.error("VERSION is not a valid semver version");
        process.exit(1);
    }
}

/**
 * Press any key to continue
 * @returns {Promise<void>}
 */
export function pressAnyKey() {
    console.log("Git Push and Publish the release note on github, then press any key to continue");
    process.stdin.setRawMode(true);
    process.stdin.resume();
    return new Promise(resolve => process.stdin.once("data", data => {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        resolve();
    }));
}

/**
 * Append version identifier
 * @param {string} version Version
 * @param {string} identifier Identifier
 * @returns {string} Version with identifier
 */
export function ver(version, identifier) {
    const obj = semver.parse(version);

    if (obj.prerelease.length === 0) {
        obj.prerelease = [ identifier ];
    } else {
        obj.prerelease[0] = [ obj.prerelease[0], identifier ].join("-");
    }
    return obj.format();
}

/**
 * Upload artifacts to GitHub
 * docker buildx build -f docker/dockerfile --platform linux/amd64 -t louislam/uptime-kuma:upload-artifact --build-arg VERSION --build-arg GITHUB_TOKEN --target upload-artifact . --progress plain
 * @param {string} version Version
 * @param {string} githubToken GitHub token
 * @returns {void}
 */
export function uploadArtifacts(version, githubToken) {
    let args = [
        "buildx",
        "build",
        "-f",
        "docker/dockerfile",
        "--platform",
        "linux/amd64",
        "-t",
        "louislam/uptime-kuma:upload-artifact",
        "--build-arg",
        `VERSION=${version}`,
        "--build-arg",
        "GITHUB_TOKEN",
        "--target",
        "upload-artifact",
        ".",
        "--progress",
        "plain",
    ];

    if (!dryRun) {
        childProcess.spawnSync("docker", args, {
            stdio: "inherit",
            env: {
                ...process.env,
                GITHUB_TOKEN: githubToken,
            },
        });
    } else {
        console.log(`[DRY RUN] docker ${args.join(" ")}`);
    }
}

/**
 * Execute a command
 * @param {string} cmd Command to execute
 * @returns {void}
 */
export function execSync(cmd) {
    if (!dryRun) {
        childProcess.execSync(cmd, { stdio: "inherit" });
    } else {
        console.info(`[DRY RUN] ${cmd}`);
    }
}
