"use strict";

/**
 * i18n audit + prune script.
 *
 * - en.json is the source of truth.
 * - For every other locale file in src/lang/, computes:
 *     missing keys   (in en, not in locale)
 *     orphan keys    (in locale, not in en)
 *     type mismatches (string in en, non-string in locale, or vice versa)
 *     placeholder mismatches (e.g. en uses {0}/{count}, locale drops or invents one)
 *     in-file duplicate keys (textual scan; JSON.parse silently dedupes)
 *
 * - Prunes orphan keys from each locale file (preserving original key order
 *   and the `languageName` metadata key, which is allowed to be locale-specific).
 * - Does NOT auto-fill missing keys: vue-i18n falls back to en, and auto-filling
 *   would mark genuinely-untranslated strings as translated to Weblate.
 *
 * Usage:
 *     node extra/i18n-audit.js              # prune + write report
 *     node extra/i18n-audit.js --check      # report only (non-zero exit if any orphan)
 *     node extra/i18n-audit.js --json       # emit machine-readable JSON to stdout
 */

const fs = require("fs");
const path = require("path");

const LANG_DIR = path.join(__dirname, "..", "src", "lang");
const REPORT_PATH = path.join(__dirname, "..", "docs", "I18N_AUDIT.md");

const args = new Set(process.argv.slice(2));
const CHECK_ONLY = args.has("--check");
const JSON_OUT = args.has("--json");

/**
 * Extracts vue-i18n-style placeholders: {0}, {1}, {count}, {name}, etc.
 * Returns a sorted, deduplicated array.
 * @param value
 */
function extractPlaceholders(value) {
    if (typeof value !== "string") {
        return [];
    }
    const matches = value.match(/\{[a-zA-Z0-9_]+\}/g) || [];
    return [ ...new Set(matches) ].sort();
}

/**
 * Detects keys that appear more than once at the top level of a JSON object
 * by scanning the raw text. JSON.parse silently keeps the last occurrence,
 * so this is the only way to spot the drift.
 *
 * Assumes flat JSON (no nested objects), which matches en.json's schema.
 * @param rawText
 */
function findDuplicateTopLevelKeys(rawText) {
    const counts = new Map();
    // Match "key": at the start of a line (with leading whitespace).
    // src/lang/* is consistently 4-space-indented one-level JSON.
    const re = /^ {4}"((?:[^"\\]|\\.)*)"\s*:/gm;
    let m;
    while ((m = re.exec(rawText)) !== null) {
        const key = JSON.parse(`"${m[1]}"`);
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    const dups = [];
    for (const [ k, c ] of counts) {
        if (c > 1) {
            dups.push({ key: k, count: c });
        }
    }
    return dups;
}

/**
 * @param file
 */
function loadLocale(file) {
    const raw = fs.readFileSync(path.join(LANG_DIR, file), "utf8");
    const data = JSON.parse(raw);
    return { raw, data };
}

/**
 * @param en
 * @param localeData
 */
function compareLocale(en, localeData) {
    const enKeys = new Set(Object.keys(en));
    const localeKeys = Object.keys(localeData);
    const missing = [];
    const orphans = [];
    const typeMismatches = [];
    const placeholderMismatches = [];

    for (const k of enKeys) {
        if (!(k in localeData)) {
            missing.push(k);
        }
    }
    for (const k of localeKeys) {
        if (k === "languageName") {
            continue; // metadata, allowed to differ
        }
        if (!enKeys.has(k)) {
            orphans.push(k);
            continue;
        }
        const enVal = en[k];
        const locVal = localeData[k];
        if (typeof enVal !== typeof locVal || Array.isArray(enVal) !== Array.isArray(locVal)) {
            typeMismatches.push({
                key: k,
                en: Array.isArray(enVal) ? "array" : typeof enVal,
                locale: Array.isArray(locVal) ? "array" : typeof locVal,
            });
            continue;
        }
        if (typeof enVal === "string") {
            const enPh = extractPlaceholders(enVal);
            const locPh = extractPlaceholders(locVal);
            // Compare as sets — order doesn't matter, presence does.
            const enSet = new Set(enPh);
            const locSet = new Set(locPh);
            const onlyEn = enPh.filter(p => !locSet.has(p));
            const onlyLoc = locPh.filter(p => !enSet.has(p));
            if (onlyEn.length || onlyLoc.length) {
                placeholderMismatches.push({
                    key: k,
                    enPlaceholders: enPh,
                    localePlaceholders: locPh,
                    missingInLocale: onlyEn,
                    extraInLocale: onlyLoc,
                });
            }
        }
    }

    return { missing, orphans, typeMismatches, placeholderMismatches };
}

/**
 * @param localeData
 * @param orphans
 */
function pruneOrphans(localeData, orphans) {
    // Preserve original key order: rebuild the object skipping orphan keys.
    if (orphans.length === 0) {
        return { data: localeData, changed: false };
    }
    const orphanSet = new Set(orphans);
    const out = {};
    for (const k of Object.keys(localeData)) {
        if (!orphanSet.has(k)) {
            out[k] = localeData[k];
        }
    }
    return { data: out, changed: true };
}

/**
 *
 */
function main() {
    const en = JSON.parse(fs.readFileSync(path.join(LANG_DIR, "en.json"), "utf8"));
    const files = fs.readdirSync(LANG_DIR)
        .filter(f => f.endsWith(".json") && f !== "en.json")
        .sort();

    const results = [];
    let totalOrphansPruned = 0;
    let totalMissing = 0;
    let totalPlaceholderMismatches = 0;
    let totalDuplicates = 0;

    for (const file of files) {
        const { raw, data } = loadLocale(file);
        const duplicates = findDuplicateTopLevelKeys(raw);
        const cmp = compareLocale(en, data);

        if (!CHECK_ONLY) {
            const { data: pruned, changed } = pruneOrphans(data, cmp.orphans);
            if (changed || duplicates.length) {
                // Re-serialize to canonical 4-space format with trailing newline.
                // findDuplicateTopLevelKeys reports issues; JSON.parse already
                // collapsed duplicates to last-wins, so re-writing also fixes that.
                const out = JSON.stringify(pruned, null, 4) + "\n";
                fs.writeFileSync(path.join(LANG_DIR, file), out);
            }
        }

        totalOrphansPruned += cmp.orphans.length;
        totalMissing += cmp.missing.length;
        totalPlaceholderMismatches += cmp.placeholderMismatches.length;
        totalDuplicates += duplicates.length;

        results.push({
            file,
            locale: file.replace(/\.json$/, ""),
            languageName: data.languageName || null,
            missingCount: cmp.missing.length,
            orphanCount: cmp.orphans.length,
            orphans: cmp.orphans,
            typeMismatches: cmp.typeMismatches,
            placeholderMismatches: cmp.placeholderMismatches,
            duplicates,
        });
    }

    if (JSON_OUT) {
        process.stdout.write(JSON.stringify({
            totals: {
                locales: files.length,
                orphansPruned: totalOrphansPruned,
                missingKeys: totalMissing,
                placeholderMismatches: totalPlaceholderMismatches,
                duplicateKeys: totalDuplicates,
            },
            results,
        }, null, 2) + "\n");
        return;
    }

    if (!CHECK_ONLY) {
        writeReport(results, {
            totalOrphansPruned,
            totalMissing,
            totalPlaceholderMismatches,
            totalDuplicates,
            localeCount: files.length,
        });
    }

    console.log(
        `i18n audit: ${files.length} locales | ` +
        `${totalOrphansPruned} orphans${CHECK_ONLY ? "" : " pruned"} | ` +
        `${totalMissing} missing | ` +
        `${totalPlaceholderMismatches} placeholder mismatches | ` +
        `${totalDuplicates} duplicate keys`
    );

    if (CHECK_ONLY && (totalOrphansPruned > 0 || totalDuplicates > 0)) {
        process.exit(1);
    }
}

/**
 * @param results
 * @param totals
 */
function writeReport(results, totals) {
    const lines = [];
    lines.push("# i18n audit");
    lines.push("");
    lines.push(`Source of truth: \`src/lang/en.json\``);
    lines.push("");
    lines.push("## Summary");
    lines.push("");
    lines.push(`- Locales audited: **${totals.localeCount}**`);
    lines.push(`- Orphan keys pruned across all locales: **${totals.totalOrphansPruned}**`);
    lines.push(`- Missing keys across all locales (translation gaps; not auto-filled): **${totals.totalMissing}**`);
    lines.push(`- Placeholder mismatches: **${totals.totalPlaceholderMismatches}**`);
    lines.push(`- In-file duplicate keys detected: **${totals.totalDuplicates}**`);
    lines.push("");
    lines.push("Missing keys are *not* auto-filled with English. vue-i18n falls back to en at runtime, and auto-filling would mark untranslated strings as translated, which would confuse Weblate sync.");
    lines.push("");
    lines.push("## Top offenders by missing-key count");
    lines.push("");
    const top = [ ...results ].sort((a, b) => b.missingCount - a.missingCount).slice(0, 15);
    lines.push("| Locale | Language | Missing | Orphans pruned | Placeholder mismatches |");
    lines.push("|---|---|---:|---:|---:|");
    for (const r of top) {
        lines.push(`| \`${r.locale}\` | ${r.languageName || ""} | ${r.missingCount} | ${r.orphanCount} | ${r.placeholderMismatches.length} |`);
    }
    lines.push("");
    lines.push("## Per-locale detail");
    lines.push("");
    for (const r of results) {
        lines.push(`### \`${r.locale}\` — ${r.languageName || "(no languageName)"}`);
        lines.push("");
        lines.push(`- Missing keys: **${r.missingCount}**`);
        lines.push(`- Orphan keys pruned: **${r.orphanCount}**`);
        lines.push(`- Type mismatches: **${r.typeMismatches.length}**`);
        lines.push(`- Placeholder mismatches: **${r.placeholderMismatches.length}**`);
        lines.push(`- In-file duplicates: **${r.duplicates.length}**`);
        if (r.orphans.length) {
            lines.push("");
            lines.push("<details><summary>Orphan keys removed</summary>");
            lines.push("");
            for (const k of r.orphans) {
                lines.push(`- \`${k}\``);
            }
            lines.push("");
            lines.push("</details>");
        }
        if (r.typeMismatches.length) {
            lines.push("");
            lines.push("Type mismatches:");
            for (const tm of r.typeMismatches) {
                lines.push(`- \`${tm.key}\`: en=\`${tm.en}\`, locale=\`${tm.locale}\``);
            }
        }
        if (r.placeholderMismatches.length) {
            lines.push("");
            lines.push("Placeholder mismatches:");
            for (const pm of r.placeholderMismatches) {
                const en = pm.enPlaceholders.join(" ") || "(none)";
                const loc = pm.localePlaceholders.join(" ") || "(none)";
                lines.push(`- \`${pm.key}\` — en: \`${en}\` · locale: \`${loc}\``);
            }
        }
        if (r.duplicates.length) {
            lines.push("");
            lines.push("Duplicate keys (last-wins on parse):");
            for (const d of r.duplicates) {
                lines.push(`- \`${d.key}\` (×${d.count})`);
            }
        }
        lines.push("");
    }

    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, lines.join("\n"));
}

main();
