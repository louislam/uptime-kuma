#!/usr/bin/env node
/**
 * Flexible setup script for Uptime Kuma forks
 * - Attempts to fetch and checkout tag 1.23.16 if present (for dist asset compatibility)
 * - If the tag is not available, it continues on the current branch
 * - Always runs `npm ci --omit dev` and downloads the dist bundle
 *
 * Each line includes a short comment explaining its purpose.
 */

// Import child_process utilities to run shell commands from Node.js
const { spawnSync } = require("child_process");

// Helper to run a command and return its exit code/stdout/stderr
function run(cmd, args, opts = {}) {
    // Spawn a child process synchronously
    const res = spawnSync(cmd, args, { stdio: "inherit", shell: false, ...opts });
    // Return the result object (status, stdout, stderr are available)
    return res;
}

// Helper to log a section header
function header(msg) {
    // Print a highlighted header so users can see progress
    console.log("\n=== " + msg + " ===\n");
}

// Start the setup process
header("Uptime Kuma flexible setup");

// Step 1: Try to ensure tags are available (best-effort)
header("Fetching Git tags (best-effort)");
try {
    // Attempt to fetch tags from the remote so we can checkout the dist-compatible tag
    run("git", ["fetch", "--tags", "--force"]);
} catch (_) {
    // Ignore errors here; we will continue even if fetching tags fails
}

// Step 2: Check if the tag 1.23.16 exists
header("Checking for tag 1.23.16");
let tagExists = false;               // Flag indicating whether the tag exists locally
try {
    // Use `git show-ref` to verify the tag exists without output
    const res = spawnSync("git", ["show-ref", "--verify", "--quiet", "refs/tags/1.23.16"], { shell: false });
    // Status 0 indicates the tag exists
    tagExists = res.status === 0;
} catch (_) {
    // If any error occurs, treat as tag not existing
    tagExists = false;
}

// Step 3: If the tag exists, attempt to checkout; otherwise continue
if (tagExists) {
    header("Checking out tag 1.23.16 (for dist compatibility)");
    const checkout = run("git", ["checkout", "1.23.16"]);
    if (checkout.status !== 0) {
        // If checkout fails for any reason, log a warning but continue
        console.warn("Warning: Could not checkout tag 1.23.16. Continuing on current branch.");
    }
} else {
    // Inform the user we will proceed on the current branch
    console.warn("Tag 1.23.16 not found. Continuing on the current branch.");
}

// Step 4: Install production dependencies only (omit dev) using npm ci
header("Installing production dependencies (npm ci --omit dev)");
const ci = run("npm", ["ci", "--omit", "dev"], { shell: process.platform === "win32" });
if (ci.status !== 0) {
    // If dependency installation fails, exit with error code
    console.error("Error: npm ci failed.");
    process.exit(ci.status || 1);
}

// Step 5: Download the dist bundle required by the server
header("Downloading dist bundle (extra/download-dist.js)");
const dl = run(process.execPath, ["extra/download-dist.js"], { shell: false });
if (dl.status !== 0) {
    // If downloading dist fails, exit with error code
    console.error("Error: Failed to download dist bundle.");
    process.exit(dl.status || 1);
}

// Final message indicating success
header("Setup completed successfully");
