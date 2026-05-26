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
    const packageLockJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../../package-lock.json"), "utf8")
    );
    const checkVersionSource = fs.readFileSync(
        path.join(__dirname, "../../server/check-version.js"),
        "utf8"
    );
    const workerApiSource = fs.readFileSync(
        path.join(__dirname, "../../cloudflare/worker/api.mjs"),
        "utf8"
    );
    const statusPageSource = fs.readFileSync(
        path.join(__dirname, "../../src/pages/StatusPage.vue"),
        "utf8"
    );
    const layoutSource = fs.readFileSync(
        path.join(__dirname, "../../src/layouts/Layout.vue"),
        "utf8"
    );
    const licenseSource = fs.readFileSync(
        path.join(__dirname, "../../LICENSE"),
        "utf8"
    );
    const readmeSource = fs.readFileSync(
        path.join(__dirname, "../../README.md"),
        "utf8"
    );

    test("uses the Uptime Worker GitHub repository for update links", () => {
        assert.strictEqual(packageJson.repository.url, "https://github.com/esaueng/uptimeworker.git");
        assert.match(aboutSource, /https:\/\/github\.com\/esaueng\/uptimeworker\/releases/);
        assert.match(checkVersionSource, /https:\/\/api\.github\.com\/repos\/esaueng\/uptimeworker\/releases\/latest/);
    });

    test("declares the first Uptime Worker repo release version", () => {
        assert.strictEqual(packageJson.version, "1.0.0");
        assert.strictEqual(packageLockJson.version, "1.0.0");
        assert.strictEqual(packageLockJson.packages[""].version, "1.0.0");
        assert.match(packageJson.scripts.setup, /git checkout 1\.0\.0/);
    });

    test("does not expose beta release update checks", () => {
        assert.doesNotMatch(aboutSource, /checkBeta/);
        assert.doesNotMatch(aboutSource, /Also check beta release/);
        assert.doesNotMatch(checkVersionSource, /res\.data\.beta/);
        assert.doesNotMatch(workerApiSource, /checkBeta/);
    });

    test("shows a single usable app version in Worker mode", () => {
        assert.match(aboutSource, /appVersion\(\)/);
        assert.match(aboutSource, /this\.\$root\.info\.version \|\| this\.\$root\.frontendVersion/);
        assert.doesNotMatch(aboutSource, /frontendVersionIs/);
    });

    test("attributes upstream Uptime Kuma without showing old Twemoji footer", () => {
        assert.match(aboutSource, /https:\/\/github\.com\/louislam\/uptime-kuma/);
        assert.match(aboutSource, /Forked from/);
        assert.doesNotMatch(aboutSource, /Font Twemoji/);
        assert.doesNotMatch(aboutSource, /creativecommons\.org\/licenses\/by\/4\.0/);
    });

    test("shows Esau Engineering on the project license surfaces", () => {
        assert.match(aboutSource, /MIT License/);
        assert.match(aboutSource, /Copyright \(c\) 2026 Esau Engineering/);
        assert.match(licenseSource, /Copyright \(c\) 2026 Esau Engineering/);
        assert.match(licenseSource, /Copyright \(c\) 2021 Louis Lam/);
        assert.match(readmeSource, /Esau Engineering/);
    });

    test("links the public powered-by footer to the Uptime Worker fork", () => {
        assert.match(statusPageSource, /data-testid="powered-by"/);
        assert.match(statusPageSource, /href="https:\/\/github\.com\/esaueng\/uptimeworker"/);
    });

    test("links account menu help to the Uptime Worker wiki", () => {
        assert.match(layoutSource, /href="https:\/\/github\.com\/esaueng\/uptimeworker\/wiki\/Uptime-Worker-Help"/);
        assert.doesNotMatch(layoutSource, /https:\/\/github\.com\/louislam\/uptime-kuma\/wiki/);
    });
});
