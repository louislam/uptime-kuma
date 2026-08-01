import "dotenv/config";
import * as childProcess from "child_process";
import fs from "fs";
import { generateChangelog, getPrompt } from "../generate-changelog.mjs";

const version = process.env.RELEASE_VERSION || process.env.RELEASE_BETA_VERSION;
const previousVersion = process.env.RELEASE_PREVIOUS_VERSION;
const dryRun = process.env.DRY_RUN === "true";
const isBeta = !!process.env.RELEASE_BETA_VERSION;
const prNumberFile = "./tmp/pr-number.txt";
const distTarGz = "./tmp/dist.tar.gz";

if (!version) {
    console.error("RELEASE_VERSION is required");
    process.exit(1);
}

if (!previousVersion) {
    console.error("RELEASE_PREVIOUS_VERSION is required");
    process.exit(1);
}

console.log(`Finishing release ${version}...`);

/**
 * @param cmd
 */
function execSync(cmd) {
    if (dryRun) {
        console.log(`[DRY RUN] ${cmd}`);
    } else {
        childProcess.execSync(cmd, { stdio: "inherit" });
    }
}

// Read PR number
if (!fs.existsSync(prNumberFile)) {
    console.error(`PR number file not found: ${prNumberFile}`);
    console.error("The PR must be created by the release script first.");
    process.exit(1);
}
const prNumber = fs.readFileSync(prNumberFile, "utf-8").trim();

// 1. Generate changelog
let categorizedMap = null;

console.log("Running opencode to categorize PRs...");
const llmPrompt = await getPrompt(previousVersion);
try {
    const result = childProcess.spawnSync(
        "opencode",
        ["run", "-m", "opencode/big-pickle", "--format", "json", llmPrompt],
        {
            encoding: "utf-8",
            timeout: 120000,
            cwd: process.cwd(),
            env: process.env,
        }
    );

    if (result.status === 0 && result.stdout) {
        // Parse NDJSON output: find "type":"text" line
        for (const line of result.stdout.trim().split("\n")) {
            try {
                const obj = JSON.parse(line);
                if (obj.type === "text" && obj.part?.text) {
                    const jsonMatch = obj.part.text.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        categorizedMap = JSON.parse(jsonMatch[0]);
                        console.log("LLM categorization applied.");
                        break;
                    }
                }
            } catch {
                // skip unparseable lines
            }
        }

        if (!categorizedMap) {
            console.warn("No JSON found in opencode response.");
            console.warn("Last 500 chars:", result.stdout.slice(-500));
        }
    } else {
        console.warn("opencode failed or returned no output (status:", result.status, ")");
        if (result.stderr) {
            console.warn("stderr:", result.stderr.slice(0, 500));
        }
    }
} catch (e) {
    console.warn("Failed to run opencode:", e.message);
}

if (!categorizedMap) {
    categorizedMap = {};
    console.log("OpenCode unavailable, using uncategorized fallback.");
}

console.log("Generating changelog...");
const changelog = await generateChangelog(previousVersion, categorizedMap);
console.log("Changelog generated.");

// 2. Squash merge the PR
console.log(`Squash merging PR #${prNumber}...`);
execSync(`gh pr merge ${prNumber} --squash --delete-branch --subject "Update to ${version}" --admin`);

// 3. Create draft release with changelog and dist.tar.gz
console.log(`Creating draft release ${version}...`);
if (!fs.existsSync(distTarGz)) {
    console.error(`dist.tar.gz not found: ${distTarGz}`);
    process.exit(1);
}

const releaseBody = `## ${version}

${changelog}`;

const releaseArgs = ["release", "create", version, distTarGz, "--draft", "--title", version, "--notes", releaseBody];

if (isBeta) {
    releaseArgs.push("--prerelease");
}

const result = childProcess.spawnSync("gh", releaseArgs, {
    encoding: "utf-8",
    stdio: "inherit",
});

if (result.status !== 0) {
    console.error("Failed to create release");
    process.exit(1);
}

console.log(`Release ${version} is ready (draft).`);
console.log("Next steps:");
console.log(`  1. Review the draft release: https://github.com/louislam/uptime-kuma/releases/tag/${version}`);
console.log(`  2. Edit if needed and publish.`);
