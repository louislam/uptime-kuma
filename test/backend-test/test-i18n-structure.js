"use strict";

const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const LANG_DIR = path.join(__dirname, "..", "..", "src", "lang");

const en = JSON.parse(fs.readFileSync(path.join(LANG_DIR, "en.json"), "utf8"));
const enKeys = new Set(Object.keys(en));

const localeFiles = fs.readdirSync(LANG_DIR)
    .filter((f) => f.endsWith(".json") && f !== "en.json")
    .sort();

/**
 * Extracts vue-i18n placeholder names from a string.
 * Mirrors the regex in extra/i18n-audit.js so the test and the audit agree
 * on what counts as a placeholder.
 * @param {string} value Source or locale string.
 * @returns {Set<string>} Set of `{name}` tokens (with braces) found.
 */
function extractPlaceholders(value) {
    if (typeof value !== "string") {
        return new Set();
    }
    return new Set(value.match(/\{[a-zA-Z0-9_]+\}/g) || []);
}

/**
 * Pre-compute en.json's placeholder set per key — every locale's placeholder
 * set must equal this for the same key (when the locale provides a value).
 */
const enPlaceholdersByKey = new Map();
for (const [ k, v ] of Object.entries(en)) {
    enPlaceholdersByKey.set(k, extractPlaceholders(v));
}

describe("i18n structure", () => {
    test("en.json itself is flat strings (no nested objects/arrays)", () => {
        for (const [ k, v ] of Object.entries(en)) {
            assert.strictEqual(
                typeof v,
                "string",
                `en.json key "${k}" is ${Array.isArray(v) ? "array" : typeof v}; expected string`
            );
        }
    });

    test("found at least 70 non-English locale files", () => {
        // Sanity guard so the suite fails loudly if locale files vanish.
        assert.ok(
            localeFiles.length >= 70,
            `expected >=70 locale files, found ${localeFiles.length}`
        );
    });

    for (const file of localeFiles) {
        describe(file, () => {
            const raw = fs.readFileSync(path.join(LANG_DIR, file), "utf8");
            const data = JSON.parse(raw);

            test("has no orphan keys (all keys exist in en.json, plus optional languageName)", () => {
                const orphans = [];
                for (const k of Object.keys(data)) {
                    if (k === "languageName") {
                        continue; // metadata, allowed to differ
                    }
                    if (!enKeys.has(k)) {
                        orphans.push(k);
                    }
                }
                assert.deepStrictEqual(
                    orphans,
                    [],
                    `${file} has orphan keys not present in en.json: ${orphans.join(", ")}`
                );
            });

            test("every value is a string (no nested objects, since en is flat)", () => {
                for (const [ k, v ] of Object.entries(data)) {
                    assert.strictEqual(
                        typeof v,
                        "string",
                        `${file} key "${k}" is ${Array.isArray(v) ? "array" : typeof v}; expected string`
                    );
                }
            });

            test("no top-level duplicate keys in raw JSON (JSON.parse silently dedupes)", () => {
                // Files are 4-space-indented one-level JSON; match `    "key":` lines.
                const counts = new Map();
                const re = /^ {4}"((?:[^"\\]|\\.)*)"\s*:/gm;
                let m;
                while ((m = re.exec(raw)) !== null) {
                    const key = JSON.parse(`"${m[1]}"`);
                    counts.set(key, (counts.get(key) || 0) + 1);
                }
                const dups = [ ...counts.entries() ].filter(([ , c ]) => c > 1).map(([ k ]) => k);
                assert.deepStrictEqual(
                    dups,
                    [],
                    `${file} has duplicate top-level keys: ${dups.join(", ")}`
                );
            });

            test("placeholder parity with en.json (every translated value uses exactly the en placeholders)", () => {
                // For every key the locale DOES translate, its `{name}` set
                // must equal en.json's `{name}` set for the same key. Locales
                // that omit the key are fine — vue-i18n falls back to en.
                //
                // This locks in the invariant that mechanical i18n fixes
                // (chore/i18n-mechanical-fixes) restored: translators must
                // not rename the placeholder, drop it, or invent new ones.
                const mismatches = [];
                for (const [ k, v ] of Object.entries(data)) {
                    if (k === "languageName") {
                        continue;
                    }
                    if (!enKeys.has(k)) {
                        // orphan keys are caught by the orphan test
                        continue;
                    }
                    if (typeof v !== "string") {
                        continue;
                    }
                    const enPh = enPlaceholdersByKey.get(k);
                    const locPh = extractPlaceholders(v);
                    if (enPh.size === 0 && locPh.size === 0) {
                        continue;
                    }
                    // Set equality
                    let same = enPh.size === locPh.size;
                    if (same) {
                        for (const p of enPh) {
                            if (!locPh.has(p)) {
                                same = false;
                                break;
                            }
                        }
                    }
                    if (!same) {
                        mismatches.push({
                            key: k,
                            en: [ ...enPh ].sort(),
                            locale: [ ...locPh ].sort(),
                        });
                    }
                }
                assert.deepStrictEqual(
                    mismatches,
                    [],
                    `${file} has placeholder mismatches: ${JSON.stringify(mismatches, null, 2)}`
                );
            });
        });
    }
});
