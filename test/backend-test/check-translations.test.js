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

        const translationRegex = /\$t\(['"](?<key1>.*?)['"]\s*[,)]|i18n-t\s+keypath=\x22(?<key2>[^\x22]+)\x22/g;

        const missingKeys = [];

        for (const filePath of walk("src")) {
            if (filePath.endsWith(".vue") || filePath.endsWith(".js")) {
                try {
                    const lines = fs.readFileSync(filePath, "utf-8").split("\n");
                    lines.forEach((line, lineNum) => {
                        let match;
                        while ((match = translationRegex.exec(line)) !== null) {
                            const key = match.groups.key1 || match.groups.key2;
                            if (key && !enTranslations[key]) {
                                const start = match.index;
                                const end = start + key.length;
                                missingKeys.push({
                                    filePath,
                                    lineNum: lineNum + 1,
                                    key,
                                    line: line.trim(),
                                    start,
                                    end,
                                });
                            }
                        }
                    });
                } catch (e) {
                    if (e instanceof TypeError && e.message.includes("is not a function")) {
                        // Ignore errors from binary files
                    } else {
                        console.error(`Error processing file: ${filePath}`, e);
                    }
                }
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
                report += "\n     = tip: if you want to contribute translations, please visit our https://weblate.kuma.pet\n";
            });
            report += "\n===============================";
            const fileCount = new Set(missingKeys.map(item => item.filePath)).size;
            report += `\nFound a total of ${missingKeys.length} missing keys in ${fileCount} files.`;
            assert.fail(report);
        }
    });
});
