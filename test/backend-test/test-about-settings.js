const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

describe("About settings page branding and versioning", () => {
    const aboutSource = fs.readFileSync(
        path.join(__dirname, "../../src/components/settings/About.vue"),
        "utf8"
    );
    const packageJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../../package.json"), "utf8")
    );
    const checkVersionSource = fs.readFileSync(
        path.join(__dirname, "../../server/check-version.js"),
        "utf8"
    );
    const workerApiSource = fs.readFileSync(
        path.join(__dirname, "../../cloudflare/worker/api.mjs"),
        "utf8"
    );

    test("uses the Uptime Worker GitHub repository for update links", () => {
        assert.strictEqual(packageJson.repository.url, "https://github.com/esaueng/uptimeworker.git");
        assert.match(aboutSource, /https:\/\/github\.com\/esaueng\/uptimeworker\/releases/);
        assert.match(checkVersionSource, /https:\/\/api\.github\.com\/repos\/esaueng\/uptimeworker\/releases\/latest/);
    });

    test("does not expose beta release update checks", () => {
        assert.doesNotMatch(aboutSource, /checkBeta/);
        assert.doesNotMatch(aboutSource, /Also check beta release/);
        assert.doesNotMatch(checkVersionSource, /res\.data\.beta/);
        assert.doesNotMatch(workerApiSource, /checkBeta/);
    });

    test("shows a single usable app version in Worker mode", () => {
        assert.match(aboutSource, /appVersion\(\)/);
        assert.match(aboutSource, /\$root\.info\.version \|\| \$root\.frontendVersion/);
        assert.doesNotMatch(aboutSource, /frontendVersionIs/);
    });

    test("attributes upstream Uptime Kuma without showing old Twemoji footer", () => {
        assert.match(aboutSource, /https:\/\/github\.com\/louislam\/uptime-kuma/);
        assert.match(aboutSource, /Forked from/);
        assert.doesNotMatch(aboutSource, /Font Twemoji/);
        assert.doesNotMatch(aboutSource, /creativecommons\.org\/licenses\/by\/4\.0/);
    });
});
