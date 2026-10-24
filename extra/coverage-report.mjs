import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CoverageReport } from "monocart-coverage-reports";

const root = process.cwd();
const outDir = path.join(root, "private", "coverage");
const backendRaw = path.join(outDir, "raw", "backend");

/**
 * Whether a source file belongs to the app (not dependencies or tests)
 * @param {string} sourcePath Source path
 * @returns {boolean} True when the file should be reported
 */
function isAppSource(sourcePath) {
    const normalized = sourcePath.replaceAll("\\", "/");
    if (normalized.includes("/node_modules/")) {
        return false;
    }
    if (normalized.includes("/test/")) {
        return false;
    }
    return normalized.includes("/server/") || normalized.includes("/src/");
}

/**
 * Read Node's NODE_V8_COVERAGE files and attach source text to every file entry
 * @param {string} dir Raw coverage directory
 * @returns {Array} V8 coverage entries with source
 */
function readNodeCoverage(dir) {
    const entries = [];
    for (const file of fs.readdirSync(dir)) {
        if (!file.endsWith(".json")) {
            continue;
        }
        const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
        for (const entry of data.result || []) {
            // Only project files: skip node internals, npm/npx and everything in node_modules
            if (!entry.url.startsWith("file://")) {
                continue;
            }
            let sourcePath;
            try {
                sourcePath = fileURLToPath(entry.url);
            } catch {
                continue;
            }
            if (!isAppSource(sourcePath)) {
                continue;
            }
            if (!entry.source) {
                try {
                    entry.source = fs.readFileSync(sourcePath, "utf8");
                } catch {
                    continue;
                }
            }
            entries.push(entry);
        }
    }
    return entries;
}

if (!fs.existsSync(backendRaw)) {
    console.log("No backend coverage data found. Run `npm run coverage:backend` first.");
    process.exit(0);
}

const report = new CoverageReport({
    name: "Backend Coverage",
    outputDir: path.join(outDir, "backend"),
    reports: [["html", { subdir: "." }], "json-summary"],
    lcov: true,
    sourceFilter: isAppSource,
});
await report.add(readNodeCoverage(backendRaw));
const result = await report.generate();

const lines = result?.summary?.lines?.pct;
console.log(`Backend coverage report written to ${path.relative(root, path.join(outDir, "backend", "index.html"))}`);
if (lines) {
    console.log(`- lines ${lines}%`);
}
