const { describe, it } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

/**
 * Recursively walks a directory and yields file paths.
 * @param {string} dir The directory to walk.
 * @yields {string} The path to a file.
 * @returns {Generator<string>} A generator that yields file paths.
 */
function* walk(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        if (file.isDirectory()) {
            yield* walk(path.join(dir, file.name));
        } else {
            yield path.join(dir, file.name);
        }
    }
}

describe("Check Translations", () => {
    it("should not have missing translation keys", () => {
        const enTranslations = JSON.parse(fs.readFileSync("src/lang/en.json", "utf-8"));

        // this is a resonably crude check, you can get around this trivially
        /// this check is just to save on maintainer energy to explain this on every review ^^
        const translationRegex = /\$t\(['"](?<key1>.*?)['"]\s*[,)]|i18n-t[^>]*\s+keypath="(?<key2>[^"]+)"/gd;

        const missingKeys = [];

        for (const filePath of walk("src")) {
            if (filePath.endsWith(".vue") || filePath.endsWith(".js")) {
                const lines = fs.readFileSync(filePath, "utf-8").split("\n");
                lines.forEach((line, lineNum) => {
                    let match;
                    while ((match = translationRegex.exec(line)) !== null) {
                        const key = match.groups.key1 || match.groups.key2;
                        if (key && !enTranslations[key]) {
                            const [ start, end ] = match.groups.key1 ? match.indices.groups.key1 : match.indices.groups.key2;
                            missingKeys.push({
                                filePath,
                                lineNum: lineNum + 1,
                                key,
                                line: line,
                                start,
                                end,
                            });
                        }
                    }
                });
            }
        }

        if (missingKeys.length > 0) {
            let report = "Missing translation keys found:\n";
            missingKeys.forEach(({ filePath, lineNum, key, line, start, end }) => {
                report += `\nerror: Missing translation key: '${key}'`;
                report += `\n   --> ${filePath}:${lineNum}:${start}`;
                report += "\n     |";
                report += `\n${String(lineNum).padEnd(5)}| ${line}`;
                const arrow = " ".repeat(start) + "^".repeat(end - start);
                report += `\n     | ${arrow} unrecognized translation key`;
                report += "\n     |";
                report += `\n     = note: please register the translation key '${key}' in en.json so that our awesome team of translators can translate them`;
                report += "\n     = tip: if you want to contribute translations, please visit https://weblate.kuma.pet\n";
            });
            report += "\n===============================";
            const fileCount = new Set(missingKeys.map(item => item.filePath)).size;
            report += `\nFound a total of ${missingKeys.length} missing keys in ${fileCount} files.`;
            assert.fail(report);
        }
    });
});
