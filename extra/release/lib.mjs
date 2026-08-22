import "dotenv/config";
import * as childProcess from "child_process";
import semver from "semver";
import fs from "fs";
import tar from "tar";

// Support both the legacy RELEASE_DRY_RUN=1 format and DRY_RUN=true used by GitHub Actions workflows
export const dryRun = process.env.RELEASE_DRY_RUN === "1" || process.env.DRY_RUN === "true";

/**
 * Read the release version from environment variables
 * @returns {string|undefined} Release version
 */
export function getVersionFromEnv() {
    return process.env.RELEASE_VERSION || process.env.RELEASE_BETA_VERSION;
}

/**
 * Check if this is a beta release
 * @returns {boolean} Is a beta release
 */
export function isBetaRelease() {
    return process.env.RELEASE_IS_BETA === "true" || !!process.env.RELEASE_BETA_VERSION;
}

/**
 * Save PR number to tmp/pr-number.txt for later stages
 * @param {number} prNumber PR number
 * @returns {void}
 */
export function savePrNumber(prNumber) {
    const tmpDir = "./tmp";
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }
    fs.writeFileSync(`${tmpDir}/pr-number.txt`, String(prNumber));
}

/**
 * Save the squash merge commit SHA to tmp/merge-sha.txt for later stages
 * @param {string} sha Merge commit SHA
 * @returns {void}
 */
export function saveMergeSha(sha) {
    const tmpDir = "./tmp";
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }
    fs.writeFileSync(`${tmpDir}/merge-sha.txt`, sha);
}

/**
 * Read the merge commit SHA from env or tmp/merge-sha.txt
 * @returns {string|null} Merge commit SHA or null
 */
export function readMergeSha() {
    if (process.env.MERGE_SHA) {
        return process.env.MERGE_SHA;
    }
    const file = "./tmp/merge-sha.txt";
    if (fs.existsSync(file)) {
        return fs.readFileSync(file, "utf-8").trim() || null;
    }
    return null;
}

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
 * @returns {string[]} List of repository names
 */
export function getRepoNames() {
    if (process.env.RELEASE_REPO_NAMES) {
        // Split by comma
        return process.env.RELEASE_REPO_NAMES.split(",").map((name) => name.trim());
    }
    return ["louislam/uptime-kuma", "ghcr.io/louislam/uptime-kuma"];
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
export function buildImage(
    repoNames,
    tags,
    target,
    buildArgs = "",
    dockerfile = "docker/dockerfile",
    platform = "linux/amd64,linux/arm64,linux/arm/v7"
) {
    let args = ["buildx", "build", "-f", dockerfile, "--platform", platform];

    for (let repoName of repoNames) {
        // Add tags
        for (let tag of tags) {
            args.push("-t", `${repoName}:${tag}`);
        }
    }

    args = [...args, "--target", target];

    // Add build args
    if (buildArgs) {
        args.push("--build-arg", buildArgs);
    }

    args = [...args, ".", "--push"];

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
 * Find an open pull request by its head branch
 * @param {string} branchName Head branch name
 * @returns {Promise<number|null>} PR number or null if not found
 */
export async function findOpenPrByHead(branchName) {
    const result = childProcess.spawnSync(
        "gh",
        ["pr", "list", "--head", branchName, "--state", "open", "--json", "number", "--limit", "1"],
        {
            encoding: "utf-8",
        }
    );

    if (result.status !== 0) {
        console.error(result.stderr);
        console.error("Failed to list pull requests");
        process.exit(1);
    }

    const prs = JSON.parse(result.stdout);
    return prs.length > 0 ? prs[0].number : null;
}

/**
 * Check whether a pull request has been merged
 * @param {number} prNumber PR number
 * @returns {Promise<boolean>} Is the PR merged
 */
export async function isPrMerged(prNumber) {
    const result = childProcess.spawnSync("gh", ["pr", "view", String(prNumber), "--json", "state"], {
        encoding: "utf-8",
    });

    if (result.status !== 0) {
        console.error(result.stderr);
        console.error(`Failed to get state of PR #${prNumber}`);
        process.exit(1);
    }

    return JSON.parse(result.stdout).state === "MERGED";
}

/**
 * Get the squash merge commit SHA of a merged pull request
 * @param {number} prNumber PR number
 * @returns {Promise<string|null>} Merge commit SHA or null if not merged
 */
export async function getPrMergeCommit(prNumber) {
    const result = childProcess.spawnSync("gh", ["pr", "view", String(prNumber), "--json", "mergeCommit"], {
        encoding: "utf-8",
    });

    if (result.status !== 0) {
        console.error(result.stderr);
        console.error(`Failed to get merge commit of PR #${prNumber}`);
        process.exit(1);
    }

    const obj = JSON.parse(result.stdout);
    return obj.mergeCommit ? obj.mergeCommit.oid : null;
}

/**
 * Check whether a GitHub release already exists (draft or published)
 * @param {string} version Version tag
 * @returns {Promise<boolean>} Does the release exist
 */
export async function releaseExists(version) {
    const result = childProcess.spawnSync("gh", ["release", "view", version, "--json", "tagName"], {
        encoding: "utf-8",
    });

    if (result.status === 0) {
        return true;
    }

    // gh exits with a non-zero code both when the release is missing and on real errors
    if ((result.stderr || "").includes("not found")) {
        return false;
    }

    console.error(result.stderr);
    console.error(`Failed to check if release ${version} exists`);
    process.exit(1);
}

/**
 * Create a draft GitHub Release without assets
 * Skips creation if the release already exists, so it can be safely re-run
 * @param {string} version Version tag
 * @param {string} changelog Changelog content
 * @param {boolean} isBeta Mark as pre-release
 * @param {string|null} targetSha Commit SHA the tag should point to when published
 * @returns {Promise<boolean>} true if created, false if it already existed
 */
export async function createDraftRelease(version, changelog, isBeta = false, targetSha = null) {
    if (await releaseExists(version)) {
        console.log(`Release ${version} already exists, skipping creation.`);
        return false;
    }

    console.log(`Creating draft release ${version}...`);

    const releaseBody = `## ${version}

${changelog}`;

    let releaseArgs = ["release", "create", version];

    if (targetSha) {
        releaseArgs.push("--target", targetSha);
    }

    releaseArgs = releaseArgs.concat(["--draft", "--title", version, "--notes", releaseBody]);

    if (isBeta) {
        releaseArgs.push("--prerelease");
    }

    const result = childProcess.spawnSync("gh", releaseArgs, {
        encoding: "utf-8",
    });

    if (result.status !== 0) {
        console.error(result.stderr);
        console.error("Failed to create release");
        process.exit(1);
    }

    console.log(`Draft release ${version} created.`);
    console.log("Next steps:");
    console.log(`  1. Review the draft release: https://github.com/louislam/uptime-kuma/releases/tag/${version}`);
    console.log("  2. Edit if needed and publish.");
    return true;
}

/**
 * Upload asset files to an existing GitHub release
 * Uses --clobber, so it can be safely re-run
 * @param {string} version Version tag
 * @param {string[]} files File paths to upload
 * @returns {Promise<void>}
 */
export async function uploadReleaseAssets(version, files) {
    if (dryRun) {
        console.log(`[DRY RUN] gh release upload ${version} --clobber ${files.join(" ")}`);
        return;
    }

    const args = ["release", "upload", version, "--clobber", ...files];

    const result = childProcess.spawnSync("gh", args, {
        stdio: "inherit",
    });

    if (result.status !== 0) {
        console.error("Failed to upload assets");
        process.exit(1);
    }

    console.log("Assets uploaded.");
}

/**
 * Build and push all docker images for a release
 * @param {string[]} repoNames Docker repository names
 * @param {string} version Version tag
 * @param {boolean} isBeta Beta tags instead of final ones
 * @returns {void}
 */
export function buildAllImages(repoNames, version, isBeta) {
    if (isBeta) {
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
        buildImage(
            repoNames,
            ["beta-slim", ver(version, "slim")],
            "release",
            "BASE_IMAGE=louislam/uptime-kuma:base2-slim"
        );

        // Build full image
        buildImage(repoNames, ["beta", version], "release");
    } else {
        // Build slim image (rootless)
        buildImage(
            repoNames,
            ["2-slim-rootless", ver(version, "slim-rootless")],
            "rootless",
            "BASE_IMAGE=louislam/uptime-kuma:base2-slim"
        );

        // Build full image (rootless)
        buildImage(repoNames, ["next-rootless", "2-rootless", ver(version, "rootless")], "rootless");

        // Build slim image
        buildImage(
            repoNames,
            ["next-slim", "2-slim", ver(version, "slim")],
            "release",
            "BASE_IMAGE=louislam/uptime-kuma:base2-slim"
        );

        // Build full image
        buildImage(repoNames, ["next", "2", version], "release");
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
    return new Promise((resolve) =>
        process.stdin.once("data", (data) => {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            resolve();
        })
    );
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
        obj.prerelease = [identifier];
    } else {
        obj.prerelease[0] = [obj.prerelease[0], identifier].join("-");
    }
    return obj.format();
}

/**
 * Upload artifacts to GitHub
 * docker buildx build -f docker/dockerfile --platform linux/amd64 -t louislam/uptime-kuma:upload-artifact --build-arg VERSION --build-arg GITHUB_TOKEN --target upload-artifact . --progress plain
 * @param {string} version Version
 * @param {string} githubToken GitHub token
 * @returns {void}
 * @deprecated
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

/**
 * Check if the current branch matches the expected release branch pattern
 * @param {string} expectedBranch Expected branch name (can be "release" or "release-{version}")
 * @returns {void}
 */
export function checkReleaseBranch(expectedBranch = "release") {
    const res = childProcess.spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
    const branch = res.stdout.toString().trim();
    if (branch !== expectedBranch) {
        console.error(`Current branch is ${branch}, please switch to "${expectedBranch}" branch`);
        process.exit(1);
    }
}

/**
 * Create dist.tar.gz from the dist directory
 * Similar to "tar -zcvf dist.tar.gz dist", but using nodejs
 * @returns {Promise<void>}
 */
export async function createDistTarGz() {
    const distPath = "dist";
    const outputPath = "./tmp/dist.tar.gz";
    const tmpDir = "./tmp";

    // Ensure tmp directory exists
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }

    // Check if dist directory exists
    if (!fs.existsSync(distPath)) {
        console.error("Error: dist directory not found");
        process.exit(1);
    }

    console.log(`Creating ${outputPath} from ${distPath}...`);

    try {
        await tar.create(
            {
                gzip: true,
                file: outputPath,
            },
            [distPath]
        );
        console.log(`Successfully created ${outputPath}`);
    } catch (error) {
        console.error(`Failed to create tarball: ${error.message}`);
        process.exit(1);
    }
}

/**
 * Create a release PR
 * @param {string} version Version
 * @param {string} previousVersion Previous version tag
 * @param {boolean} dryRun Still create the PR, but add "[DRY RUN]" to the title
 * @param {string} branchName The branch name to use for the PR head (defaults to "release")
 * @param {string} githubRunId The GitHub Actions run ID for linking to artifacts
 * @returns {Promise<number>} The PR number
 */
export async function createReleasePR(version, previousVersion, dryRun, branchName = "release", githubRunId = null) {
    // Reuse the existing open PR for this branch, so re-running does not close or duplicate it
    const existingPrNumber = await findOpenPrByHead(branchName);
    if (existingPrNumber) {
        console.log(`Found existing open PR #${existingPrNumber} for branch ${branchName}, reusing it.`);
        savePrNumber(existingPrNumber);
        return existingPrNumber;
    }

    const title = dryRun ? `chore: update to ${version} (dry run)` : `chore: update to ${version}`;

    // Build the artifact link - use direct run link if available, otherwise link to workflow file
    const artifactLink = githubRunId
        ? `https://github.com/louislam/uptime-kuma/actions/runs/${githubRunId}/workflow`
        : `https://github.com/louislam/uptime-kuma/actions/workflows/release.yml`;

    const tmpDir = "./tmp";
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }

    const body = `## Release ${version}

This PR prepares the release for version ${version}.

### Release Artifacts
The \`dist.tar.gz\` archive will be available as an artifact in the [workflow run](${artifactLink}).
`;

    // Create the PR using gh CLI
    const args = ["pr", "create", "--title", title, "--body", body, "--base", "master", "--head", branchName];

    console.log(`Creating PR: ${title}`);

    const result = childProcess.spawnSync("gh", args, {
        encoding: "utf-8",
        stdio: "pipe",
    });

    if (result.status !== 0) {
        console.error(result.stderr);
        console.error("Failed to create pull request");
        process.exit(1);
    }

    const prUrl = result.stdout.trim();
    console.log(prUrl);

    // Extract PR number from URL (e.g., https://github.com/louislam/uptime-kuma/pull/1234)
    const prNumberMatch = prUrl.match(/\/pull\/(\d+)/);
    const prNumber = prNumberMatch ? parseInt(prNumberMatch[1], 10) : null;

    if (prNumber) {
        console.log(`PR number: ${prNumber}`);
        // Save PR number to file for the finish script
        savePrNumber(prNumber);
    } else {
        console.warn("Could not extract PR number from URL, auto-finish will not be possible");
    }

    console.log("Successfully created pull request");
    return prNumber;
}

/**
 * Create a draft release, optionally with dist.tar.gz uploaded as an asset
 * @param {string} version Version tag
 * @param {string} changelog Changelog content
 * @param {boolean} isBeta Mark as pre-release
 * @param {string} distTarGz If empty, it will not be uploaded to the release
 * @returns {Promise<void>}
 */
export async function createRelease(version, changelog, isBeta = false, distTarGz = undefined) {
    await createDraftRelease(version, changelog, isBeta);

    if (distTarGz) {
        if (!fs.existsSync(distTarGz)) {
            console.error(`dist.tar.gz not found: ${distTarGz}`);
            process.exit(1);
        }

        await uploadReleaseAssets(version, [distTarGz]);
    }
}
