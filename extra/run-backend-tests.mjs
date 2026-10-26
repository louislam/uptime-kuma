import { spawnSync } from "node:child_process";
import { globSync, readFileSync } from "node:fs";

const PATTERNS = [
    "test/backend-test/**/*.ts",
    "test/backend-test/**/*.js",
    "test/frontend-test/**/*.ts",
    "test/frontend-test/**/*.js",
];
const CONTAINER_MARKER = "testcontainers";
const NODE_ARGS = ["--import=tsx", "--test"];
const extraArgs = process.argv.slice(2);

const files = PATTERNS.flatMap((pattern) => globSync(pattern, { exclude: ["**/node_modules/**"] })).sort();

const containerFiles = [];
const otherFiles = [];
for (const file of files) {
    const target = readFileSync(file, "utf8").includes(CONTAINER_MARKER) ? containerFiles : otherFiles;
    target.push(file);
}

/**
 * Run one phase of the test suite
 * @param {string} name Phase name
 * @param {string[]} phaseFiles Files to run
 * @param {string[]} concurrencyArgs Extra node arguments
 * @returns {number} Exit code of the phase
 */
function runPhase(name, phaseFiles, concurrencyArgs = []) {
    if (phaseFiles.length === 0) {
        return 0;
    }
    console.log(`\n=== ${name}: ${phaseFiles.length} files ===`);
    const result = spawnSync(process.execPath, [...NODE_ARGS, ...concurrencyArgs, ...extraArgs, ...phaseFiles], {
        stdio: "inherit",
    });
    return result.status ?? 1;
}

// Containers are heavy, so its files run one at a time; everything else keeps the default parallelism
const otherStatus = runPhase("Other tests", otherFiles);
const containerStatus = runPhase("Testcontainers tests", containerFiles, ["--test-concurrency=1"]);

process.exit(otherStatus || containerStatus);
