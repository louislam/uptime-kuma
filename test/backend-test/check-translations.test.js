const { describe, it } = require("node:test");
const assert = require("node:assert");
const fs = require("fs/promises");
const path = require("path");

/**
 * Recursively walks a directory and yields file paths.
 * @param {string} dir The directory to walk.
 * @yields {string} The path to a file.
 * @returns {AsyncGenerator<string>} A generator that yields file paths.
 */
async function* walk(dir) {
    const files = await fs.readdir(dir, { withFileTypes: true });
    for (const file of files) {
        if (file.isDirectory()) {
            yield* walk(path.join(dir, file.name));
        } else {
            yield path.join(dir, file.name);
        }
    }
}

const UPSTREAM_EN_JSON = "https://raw.githubusercontent.com/louislam/uptime-kuma/refs/heads/master/src/lang/en.json";

/**
 * Extract `{placeholders}` from a translation string.
 * @param {string} value The translation string to extract placeholders from.
 * @returns {Set<string>} A set of placeholder names.
 */
function extractParams(value) {
    if (typeof value !== "string") {
        return new Set();
    }

    const regex = /\{([^}]+)\}/g;
    const params = new Set();

    let match;
    while ((match = regex.exec(value)) !== null) {
        params.add(match[1]);
    }

    return params;
}

/**
 * Fallback to get start/end indices of a key within a line.
 * @param {string} line - Line of text to search in.
 * @param {string} key - Key to find.
 * @returns {[number, number]} Array [start, end] representing the indices of the key in the line.
 */
function getStartEnd(line, key) {
    let start = line.indexOf(key);
    if (start === -1) {
        start = 0;
    }
    return [start, start + key.length];
}

describe("Check Translations", () => {
    it("should not have missing translation keys", async () => {
        const enTranslations = JSON.parse(await fs.readFile("src/lang/en.json", "utf-8"));

        // this is a resonably crude check, you can get around this trivially
        /// this check is just to save on maintainer energy to explain this on every review ^^
        const translationRegex = /\$t\(['"](?<key1>.*?)['"]\s*[,)]|i18n-t[^>]*\s+keypath="(?<key2>[^"]+)"/dg;

        // detect server-side TranslatableError usage: new TranslatableError("key")
        const translatableErrorRegex = /new\s+TranslatableError\(\s*['"](?<key3>[^'"]+)['"]\s*\)/g;

        const missingKeys = [];

        const roots = ["src", "server"];

        for (const root of roots) {
            for await (const filePath of walk(root)) {
                if (filePath.endsWith(".vue") || filePath.endsWith(".js")) {
                    const lines = (await fs.readFile(filePath, "utf-8")).split("\n");
                    lines.forEach((line, lineNum) => {
                        let match;
                        // front-end style keys ($t / i18n-t)
                        while ((match = translationRegex.exec(line)) !== null) {
                            const key = match.groups.key1 || match.groups.key2;
                            if (key && !enTranslations[key]) {
                                const [start, end] = getStartEnd(line, key);
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

                        // server-side TranslatableError usage
                        let m;
                        while ((m = translatableErrorRegex.exec(line)) !== null) {
                            const key3 = m.groups.key3;
                            if (key3 && !enTranslations[key3]) {
                                const [start, end] = getStartEnd(line, key3);
                                missingKeys.push({
                                    filePath,
                                    lineNum: lineNum + 1,
                                    key: key3,
                                    line: line,
                                    start,
                                    end,
                                });
                            }
                        }
                    });
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
                report +=
                    "\n     = tip: if you want to contribute translations, please visit https://weblate.kuma.pet\n";
            });
            report += "\n===============================";
            const fileCount = new Set(missingKeys.map((item) => item.filePath)).size;
            report += `\nFound a total of ${missingKeys.length} missing keys in ${fileCount} files.`;
            assert.fail(report);
        }
    });

    it("en.json translations must not change placeholder parameters", async () => {
        // Load local reference (the one translators are synced against)
        const enTranslations = JSON.parse(await fs.readFile("src/lang/en.json", "utf-8"));

        // Fetch upstream version
        const res = await fetch(UPSTREAM_EN_JSON);
        assert.equal(res.ok, true, "Failed to fetch upstream en.json");

        const upstreamEn = await res.json();

        for (const [key, upstreamValue] of Object.entries(upstreamEn)) {
            if (!(key in enTranslations)) {
                // deleted keys are fine
                continue;
            }

            const localParams = extractParams(enTranslations[key]);
            const upstreamParams = extractParams(upstreamValue);

            assert.deepEqual(
                localParams,
                upstreamParams,
                [
                    `Translation key "${key}" changed placeholder parameters.`,
                    `This is a breaking change for existing translations.`,
                    `Please rename the translation key instead of changing placeholders.`,
                    ``,
                    `your version: ${[...localParams].join(", ")}`,
                    `on master:    ${[...upstreamParams].join(", ")}`,
                ].join("\n")
            );
        }
    });
});
