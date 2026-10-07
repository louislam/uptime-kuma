// Wiki stage of a release.
//
// The "How to Update" wiki page tells non-Docker users to run
// `git checkout <version> --force`, so it has to be bumped on every release.
// The GitHub wiki is its own git repository (louislam/uptime-kuma.wiki.git), so
// pushing there updates the live page directly. The louislam/uptime-kuma-wiki
// repo mirrors it back through its own sync workflow.
//
// Safe to re-run, it does nothing when the page is already on the target version.
//
// Usage: node extra/release/update-wiki.mjs
//   WIKI_TOKEN (or GITHUB_TOKEN) must have write access to the wiki.
//   WIKI_REMOTE overrides the wiki git URL, e.g. to simulate a release against
//   a test repo (git@github.com:owner/test-wiki.git).

import "dotenv/config";
import * as childProcess from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { getVersionFromEnv } from "./lib.mjs";

const WIKI_REPO = "louislam/uptime-kuma.wiki";
const WIKI_FILE = "🆙-How-to-Update.md";

// Only the non-Docker `git checkout <version> --force` line carries the version
const CHECKOUT_PATTERN = /(git checkout )\S+( --force)/;

/**
 * Update the wiki page to the release version and push the change
 * @returns {Promise<void>}
 */
export async function runUpdateWiki() {
    const version = getVersionFromEnv();
    const dryRun = process.env.DRY_RUN === "true";

    if (!version) {
        console.error("RELEASE_VERSION is required");
        process.exit(1);
    }

    if (dryRun) {
        console.log(`[DRY RUN] Would set ${WIKI_FILE} in ${WIKI_REPO} to ${version}`);
        return;
    }

    // Clone into a fresh temp dir so a re-run never trips over a previous clone
    const cloneDir = fs.mkdtempSync(path.join(os.tmpdir(), "uptime-kuma-wiki-"));

    try {
        run("git", ["clone", "--depth", "1", getCloneUrl(), cloneDir]);

        const wikiFile = path.join(cloneDir, WIKI_FILE);
        const content = fs.readFileSync(wikiFile, "utf-8");

        if (!CHECKOUT_PATTERN.test(content)) {
            console.error(`Could not find the "git checkout <version> --force" line in ${WIKI_FILE}`);
            process.exit(1);
        }

        const updated = content.replace(CHECKOUT_PATTERN, (match, before, after) => `${before}${version}${after}`);

        if (updated === content) {
            console.log(`Wiki is already on ${version}, nothing to update.`);
            return;
        }

        fs.writeFileSync(wikiFile, updated);

        run("git", ["-C", cloneDir, "config", "user.name", "github-actions[bot]"]);
        run("git", ["-C", cloneDir, "config", "user.email", "github-actions[bot]@users.noreply.github.com"]);
        run("git", ["-C", cloneDir, "commit", "-am", `chore: update to ${version}`]);
        run("git", ["-C", cloneDir, "push", "origin", "HEAD:master"]);

        console.log(`Wiki updated to ${version}.`);
    } finally {
        try {
            fs.rmSync(cloneDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
        } catch {
            // Best effort: a locked temp dir must not fail an otherwise successful release
        }
    }
}

/**
 * Build the git URL to clone the wiki from.
 * WIKI_REMOTE overrides it (used to simulate a release against a test repo);
 * otherwise the release token is embedded to authenticate over HTTPS.
 * @returns {string} The clone URL
 */
function getCloneUrl() {
    if (process.env.WIKI_REMOTE) {
        return process.env.WIKI_REMOTE;
    }

    const token = process.env.WIKI_TOKEN || process.env.GITHUB_TOKEN;
    if (!token) {
        console.error("WIKI_TOKEN or GITHUB_TOKEN is required to update the wiki");
        process.exit(1);
    }

    return `https://x-access-token:${token}@github.com/${WIKI_REPO}.git`;
}

/**
 * Run a command, exiting on failure
 * @param {string} command The command to run
 * @param {string[]} args The command arguments
 * @returns {void}
 */
function run(command, args) {
    const result = childProcess.spawnSync(command, args, { stdio: "inherit" });
    if (result.status !== 0) {
        console.error(`Command failed: ${command} ${args.join(" ")}`);
        process.exit(result.status ?? 1);
    }
}

if (import.meta.main) {
    await runUpdateWiki();
}
