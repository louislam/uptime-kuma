"use strict";

/**
 * i18n mechanical fixes — applies the safe, automatable fixes flagged
 * by docs/I18N_AUDIT.md so we don't need to hand-edit dozens of locale files.
 *
 * Categories handled (anything requiring translator judgement is OUT OF SCOPE):
 *
 *   A. Renamed-placeholder fixes. A locale value translated the placeholder
 *      NAME (e.g. `{Dokumentation}`, `{documentazione}`) instead of leaving
 *      it byte-identical to en.json. We rewrite the placeholder name back to
 *      the en name. Surrounding prose is untouched.
 *
 *   B. Positional → named placeholder corrections. `wayToGetClickSendSMSToken`
 *      uses `{here}` in en, but 19 locales used `{0}`. We rewrite `{0}` →
 *      `{here}` in those locales. Two locales (es-ES, sv-SE) renamed `{here}`
 *      to a translated word — we DELETE their value so vue-i18n falls back to
 *      en (a working link beats a broken-name placeholder that never resolves).
 *
 *   C. Extra-placeholder removals. A locale invented a placeholder en doesn't
 *      have (e.g. `be.json`'s SMTP-hostname helptext slipped in `{Hostname}`).
 *      We strip just the placeholder braces, leaving the inner word as prose.
 *
 *   D. Dropped-placeholder strings. A locale value lost the placeholder
 *      entirely (e.g. `"{0} ago"` → `"előtt"`). Such strings render broken at
 *      runtime — we DELETE the locale value so vue-i18n falls back to en.
 *
 *   E. The upstream typo `{issuetackerURL}`. en.json, the Vue call site, and
 *      many locales carry the typo. Some locales "corrected" the spelling and
 *      now break. We rename the placeholder to `{issueTrackerURL}` everywhere
 *      (en.json + Vue call site + all locales).
 *
 *   F. `pa_PK.json` `languageName` typo: `"ਅੰਗਰੇਜ਼ੀ"` (means "English") →
 *      `"ਪੰਜਾਬੀ"` (Punjabi).
 *
 * The script preserves key order and writes files with the canonical
 * 4-space indent + final newline format (see extra/check-lang-json.js).
 *
 * Usage:
 *     node extra/i18n-mechanical-fixes.js
 *     node extra/i18n-mechanical-fixes.js --dry   # report without writing
 */

const fs = require("fs");
const path = require("path");

const LANG_DIR = path.join(__dirname, "..", "src", "lang");
const SRC_ROOT = path.join(__dirname, "..", "src");

const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry");

// ----- Configuration --------------------------------------------------------

/**
 * Category A & "hidden A" (renamed placeholder).
 *
 * Each entry: { locale, key, renames: { wrongName: correctName } }.
 * `wrongName` and `correctName` include surrounding braces — we do an exact
 * substring replace on the locale value. Multiple renames per value supported.
 *
 * Generated from the I18N_AUDIT report: every (locale, key) where the locale
 * has a placeholder en doesn't have AND the placeholder is missing. We map
 * one-to-one in source order (the audit confirmed each case is unambiguous).
 */
const RENAME_FIXES = [
    // ar / ar-SY — webhookFormDataDesc lowercased the f in decodeFunction
    { locale: "ar", key: "webhookFormDataDesc", renames: { "{decodefunction}": "{decodeFunction}" } },
    { locale: "ar-SY", key: "webhookFormDataDesc", renames: { "{decodefunction}": "{decodeFunction}" } },

    // ar / ar-SY — defaultNotificationName: {الإخطار} stands for {notification}
    { locale: "ar", key: "defaultNotificationName", renames: { "{الإخطار}": "{notification}" } },
    { locale: "ar-SY", key: "defaultNotificationName", renames: { "{الإخطار}": "{notification}" } },

    // bn — translated placeholder names
    { locale: "bn", key: "defaultNotificationName", renames: { "{বিজ্ঞপ্তি}": "{notification}" } },
    { locale: "bn", key: "Mention group", renames: { "{গ্রুপ}": "{group}" } },
    { locale: "bn", key: "Invalid mobile", renames: { "{মোবাইল}": "{mobile}" } },
    { locale: "bn", key: "mongodbCommandDescription", renames: { "{ডকুমেন্টেশন}": "{documentation}" } },
    { locale: "bn", key: "wayToGetHeiiOnCallDetails", renames: { "{ডকুমেন্টেশন}": "{documentation}" } },
    { locale: "bn", key: "time ago", renames: { "{০}": "{0}" } },

    // ca — wsSubprotocolDescription, shrinkDatabaseDescriptionSqlite
    { locale: "ca", key: "wsSubprotocolDescription", renames: { "{documentació}": "{documentation}" } },
    { locale: "ca", key: "shrinkDatabaseDescriptionSqlite", renames: { "{auto.vacuum}": "{auto_vacuum}" } },

    // cs-CZ
    { locale: "cs-CZ", key: "mongodbCommandDescription", renames: { "{dokumentaci}": "{documentation}" } },
    { locale: "cs-CZ", key: "defaultNotificationName", renames: { "{číslo}": "{number}" } },
    { locale: "cs-CZ", key: "Mention group", renames: { "{skupině}": "{group}" } },

    // de-CH
    { locale: "de-CH", key: "wayToGetHeiiOnCallDetails", renames: { "{Dokumentation}": "{documentation}" } },

    // es-ES
    { locale: "es-ES", key: "wayToGetHeiiOnCallDetails", renames: { "{documentación}": "{documentation}" } },
    { locale: "es-ES", key: "mongodbCommandDescription", renames: { "{documentación}": "{documentation}" } },
    { locale: "es-ES", key: "wayToGetClickSMSIRTemplateID", renames: { "{aquí}": "{here}" } },

    // fr-FR
    { locale: "fr-FR", key: "Mention group", renames: { "{groupe}": "{group}" } },
    { locale: "fr-FR", key: "systemServiceCommandHint", renames: { "{commande}": "{command}" } },
    { locale: "fr-FR", key: "You can divide numbers with commas or semicolons", renames: { "{virgule}": "{comma}", "{point-virgule}": "{semicolon}" } },
    { locale: "fr-FR", key: "aliyun-template-requirements-and-parameters", renames: { "{paramètres}": "{parameters}" } },

    // hr-HR
    { locale: "hr-HR", key: "wayToGetClickSMSIRTemplateID", renames: { "{ovdje}": "{here}" } },

    // hu
    { locale: "hu", key: "Mention group", renames: { "{csoport}": "{group}" } },
    { locale: "hu", key: "wayToGetHeiiOnCallDetails", renames: { "{dokumentáció}": "{documentation}" } },

    // it-IT
    { locale: "it-IT", key: "Could not clear events", renames: { "{falliti}": "{failed}", "{totali}": "{total}" } },
    { locale: "it-IT", key: "mongodbCommandDescription", renames: { "{documentazione}": "{documentation}" } },
    { locale: "it-IT", key: "wayToGetHeiiOnCallDetails", renames: { "{documentazione}": "{documentation}" } },
    { locale: "it-IT", key: "wayToGetClickSMSIRTemplateID", renames: { "{qui}": "{here}" } },
    { locale: "it-IT", key: "wsSubprotocolDescription", renames: { "{documentazione}": "{documentation}" } },
    { locale: "it-IT", key: "createdAt", renames: { "{data}": "{date}" } },

    // lt
    { locale: "lt", key: "wsSubprotocolDescription", renames: { "{dokumentacijoje}": "{documentation}" } },

    // nl-NL
    { locale: "nl-NL", key: "rabbitmqHelpText", renames: { "{rabitmq_documentatie}": "{rabitmq_documentation}" } },
    { locale: "nl-NL", key: "mqttHostnameTip", renames: { "{hostnaamFormat}": "{hostnameFormat}" } },
    { locale: "nl-NL", key: "Either enter the hostname of the server you want to connect to or localhost if you intend to use a locally configured mail transfer agent", renames: { "{local-mta}": "{local_mta}" } },

    // pl
    { locale: "pl", key: "wayToGetHeiiOnCallDetails", renames: { "{dokumentacji}": "{documentation}" } },

    // pt-BR
    { locale: "pt-BR", key: "Mention group", renames: { "{grupo}": "{group}" } },
    { locale: "pt-BR", key: "wayToGetClickSMSIRTemplateID", renames: { "{aqui}": "{here}" } },
    { locale: "pt-BR", key: "systemServiceCommandHint", renames: { "{comando}": "{command}" } },
    { locale: "pt-BR", key: "Screenshot Delay", renames: { "{miliseconds}": "{milliseconds}" } },
    { locale: "pt-BR", key: "wayToGetHeiiOnCallDetails", renames: { "{documentação}": "{documentation}" } },
    { locale: "pt-BR", key: "mongodbCommandDescription", renames: { "{documentação}": "{documentation}" } },
    { locale: "pt-BR", key: "Badge Link Generator Helptext", renames: { "{documentação}": "{documentation}" } },

    // ro
    { locale: "ro", key: "Mention group", renames: { "{grup}": "{group}" } },
    { locale: "ro", key: "wayToGetHeiiOnCallDetails", renames: { "{documentație}": "{documentation}" } },
    { locale: "ro", key: "mongodbCommandDescription", renames: { "{documentația}": "{documentation}" } },

    // ru-RU
    { locale: "ru-RU", key: "mongodbCommandDescription", renames: { "{документации}": "{documentation}" } },
    { locale: "ru-RU", key: "wayToGetClickSMSIRTemplateID", renames: { "{здесь}": "{here}" } },

    // sk
    { locale: "sk", key: "Mention group", renames: { "{skupinu}": "{group}" } },
    { locale: "sk", key: "wayToGetClickSMSIRTemplateID", renames: { "{tu}": "{here}" } },

    // sv-SE
    { locale: "sv-SE", key: "wayToGetHeiiOnCallDetails", renames: { "{dokumentationen}": "{documentation}" } },
    { locale: "sv-SE", key: "wsSubprotocolDescription", renames: { "{dokumentationen}": "{documentation}" } },
    { locale: "sv-SE", key: "wayToGetClickSMSIRTemplateID", renames: { "{här}": "{here}" } },

    // te
    { locale: "te", key: "defaultNotificationName", renames: { "{నోటిఫికేషన్}": "{notification}", "{సంఖ్య}": "{number}" } },

    // tr-TR
    { locale: "tr-TR", key: "wayToGetHeiiOnCallDetails", renames: { "{dokümantasyon}": "{documentation}" } },
    { locale: "tr-TR", key: "mongodbCommandDescription", renames: { "{dokümantasyona}": "{documentation}" } },

    // vi-VN
    { locale: "vi-VN", key: "wayToGetClickSMSIRTemplateID", renames: { "{tại đây}": "{here}" } },

    // vls
    { locale: "vls", key: "mqttHostnameTip", renames: { "{hostnaamFormat}": "{hostnameFormat}" } },
    { locale: "vls", key: "rabbitmqHelpText", renames: { "{rabitmq_documentatie}": "{rabitmq_documentation}" } },
    { locale: "vls", key: "Either enter the hostname of the server you want to connect to or localhost if you intend to use a locally configured mail transfer agent", renames: { "{local-mta}": "{local_mta}" } },
];

/**
 * Category B — `wayToGetClickSendSMSToken`. en uses `{here}`; 19 locales used
 * positional `{0}` → rewrite to `{here}`. 2 locales (es-ES, sv-SE) renamed
 * `{here}` to `{aquí}` / `{här}` — we DELETE their value (handled by
 * DELETE_KEYS below).
 */
const CLICKSEND_REWRITE_LOCALES = [
    "ar", "ar-SY", "be", "bn", "da-DK", "el-GR", "eu", "fa", "fi", "he-IL",
    "ja", "ko-KR", "lt", "nl-NL", "pl", "ro", "th-TH", "vls", "zh-HK",
];

/**
 * Category C — extra-placeholder removals.
 * Strip the listed placeholder TOKENS (with braces) from the locale value
 * but keep the inner word intact: `{Hostname}` → `Hostname`.
 */
const STRIP_BRACES = [
    { locale: "be", key: "wayToGetPagerTreeIntegrationURL", tokens: [ "{Endpoint}" ] },
    { locale: "be", key: "callMeBotGet", tokens: [ "{endpoint}" ] },
    { locale: "be", key: "cellsyntOriginator", tokens: [ "{originatortype}" ] },
    { locale: "be", key: "Either enter the hostname of the server you want to connect to or localhost if you intend to use a locally configured mail transfer agent", tokens: [ "{Hostname}" ] },
    { locale: "ru-RU", key: "callMeBotGet", tokens: [ "{endpoint}" ] },
    { locale: "ru-RU", key: "cellsyntOriginator", tokens: [ "{originatortype}" ] },
];

/**
 * Category C — extra-placeholder removals where the placeholder is NOT a real
 * word but a leftover positional ref. Drop the whole `{0}` token (no inner
 * word to preserve).
 */
const DROP_TOKENS = [
    { locale: "yue", key: "wayToGetFlashDutyKey", tokens: [ "{0}" ] },
    { locale: "zh-HK", key: "wayToGetFlashDutyKey", tokens: [ "{0}" ] },
];

/**
 * Category B & D — delete the locale's value for these (locale, key) pairs
 * so vue-i18n falls back to en at runtime.
 *
 * Includes:
 *   - es-ES, sv-SE wayToGetClickSendSMSToken (Category B "renamed" variant)
 *   - every locale where the placeholder was completely dropped with no
 *     identifiable rename (Category D pure drops).
 */
const DELETE_KEYS = [
    // Category B — renamed-and-broken
    { locale: "es-ES", key: "wayToGetClickSendSMSToken" },
    { locale: "sv-SE", key: "wayToGetClickSendSMSToken" },

    // Category D pure drops (placeholder gone, no identifiable rename)
    { locale: "ar", key: "needPushEvery" },
    { locale: "ar", key: "pushOptionalParams" },
    { locale: "ar", key: "aboutWebhooks" },
    { locale: "ar", key: "emojiCheatSheet" },
    { locale: "ar-SY", key: "needPushEvery" },
    { locale: "ar-SY", key: "pushOptionalParams" },
    { locale: "ar-SY", key: "aboutWebhooks" },
    { locale: "ar-SY", key: "emojiCheatSheet" },
    { locale: "bar", key: "legacyOctopushEndpoint" },
    { locale: "bar", key: "octopushEndpoint" },
    { locale: "bar", key: "Monitor Setting" },
    { locale: "bar", key: "aboutJiraCloudId" },
    { locale: "bar", key: "Badge Link Generator" },
    { locale: "bar", key: "cacheBusterParam" },
    { locale: "bar", key: "foundChromiumVersion" },
    { locale: "bar", key: "Screenshot Delay" },
    { locale: "bar", key: "systemServiceExpectedOutput" },
    { locale: "bar", key: "documentationOf" },
    { locale: "bar", key: "milliseconds" },
    { locale: "bar", key: "systemServiceCommandHint" },
    { locale: "bn", key: "telegramServerUrlDescription" }, // {1} dropped, {0} kept
    { locale: "ca", key: "statusPageRefreshIn" }, // {0} typoed to {0]
    { locale: "fa", key: "documentationOf" },
    { locale: "fa", key: "wayToGetHeiiOnCallDetails" },
    { locale: "hi", key: "time ago" },
    { locale: "hu", key: "time ago" },
    { locale: "it-IT", key: "time ago" },
    { locale: "it-IT", key: "rabbitmqHelpText" },
    { locale: "it-IT", key: "logoutCurrentUser" },
    { locale: "ja", key: "aboutChannelName" },
    { locale: "my", key: "disableauth.message1" },
    { locale: "nb-NO", key: "needPushEvery" }, // {0] typo
    { locale: "pt-BR", key: "emojiCheatSheet" },
    { locale: "pt-BR", key: "time ago" },
    { locale: "pt-PT", key: "liquidIntroduction" }, // [0] not {0}
    { locale: "pt-PT", key: "statusPageRefreshIn" }, // [0] not {0}
    { locale: "sq", key: "pushOptionalParams" },
    { locale: "th-TH", key: "days" },
    { locale: "th-TH", key: "cloneOf" },
    { locale: "th-TH", key: "wsSubprotocolDescription" },
    { locale: "vi-VN", key: "wayToGetTelegramToken" },
    { locale: "vi-VN", key: "webhookBodyPresetOption" },
];

/**
 * Category E — `{issuetackerURL}` upstream typo. Rename to `{issueTrackerURL}`
 * across the codebase: every locale value that mentions the key, en.json, and
 * the Vue template slot. We list every variant locales used so a single sweep
 * normalises them all.
 */
const ISSUE_TRACKER_VARIANTS = [
    "{issuetackerURL}",   // the original typo (en + most locales)
    "{issuetrackerURL}",  // nl-NL + vls already "corrected" to lowercase t
    "{issuetakerURL}",    // ru-RU's misspelling
    "{issustackerURL}",   // zh-TW's misspelling
];
const ISSUE_TRACKER_CORRECT = "{issueTrackerURL}";

/**
 * Category F — single-key fix in pa_PK.json.
 */
const PA_PK_LANGUAGE_NAME = "ਪੰਜਾਬੀ"; // Punjabi for "Punjabi"

// ----- Helpers --------------------------------------------------------------

/**
 * Read and parse a locale file, preserving raw text for diff reporting.
 * @param {string} file Locale filename (no path).
 * @returns {{ raw: string, data: Record<string, string> }}
 */
function loadLocale(file) {
    const raw = fs.readFileSync(path.join(LANG_DIR, file), "utf8");
    return { raw, data: JSON.parse(raw) };
}

/**
 * Serialise a locale object to the canonical 4-space + final-newline format.
 * @param {Record<string, string>} data Parsed locale data.
 * @returns {string} JSON string ready to write.
 */
function serialise(data) {
    return JSON.stringify(data, null, 4) + "\n";
}

/**
 * Apply a map of `wrongPlaceholder -> correctPlaceholder` substring renames
 * to a string.
 * @param {string} value The locale string to fix.
 * @param {Record<string, string>} renames Mapping of literal substrings.
 * @returns {string} The rewritten string.
 */
function applyRenames(value, renames) {
    let out = value;
    for (const [ wrong, correct ] of Object.entries(renames)) {
        out = out.split(wrong).join(correct);
    }
    return out;
}

/**
 * Strip braces from listed `{token}` substrings, preserving the inner word.
 * Example: tokens=["{Hostname}"] turns "Enter the {Hostname} of the server"
 * into "Enter the Hostname of the server".
 * @param {string} value The locale string to fix.
 * @param {string[]} tokens List of placeholder tokens (including braces).
 * @returns {string} The rewritten string.
 */
function stripBraces(value, tokens) {
    let out = value;
    for (const token of tokens) {
        const inner = token.slice(1, -1);
        out = out.split(token).join(inner);
    }
    return out;
}

/**
 * Drop listed `{token}` substrings entirely (and any leading whitespace before
 * them, to avoid double-spaces).
 * @param {string} value The locale string to fix.
 * @param {string[]} tokens List of placeholder tokens to remove.
 * @returns {string} The rewritten string.
 */
function dropTokens(value, tokens) {
    let out = value;
    for (const token of tokens) {
        // Remove the token and one preceding space if present, to avoid
        // dangling whitespace.
        const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        out = out.replace(new RegExp(" ?" + escaped, "g"), "");
    }
    return out;
}

/**
 * Track per-category change counts for the final report.
 */
const stats = {
    A_renamed: 0,
    B_clicksend_rewrite: 0,
    B_clicksend_delete: 0,
    C_strip: 0,
    C_drop: 0,
    D_delete: 0,
    E_issuetracker_locales: 0,
    E_issuetracker_en: 0,
    E_issuetracker_vue: 0,
    F_pa_pk: 0,
};

/**
 * Index renames/strips/drops/deletes by locale for a single pass per file.
 * @returns {Map<string, object>} Locale → { renames, strips, drops, deletes }.
 */
function buildLocaleIndex() {
    const idx = new Map();
    /**
     * Get-or-create entry for a locale.
     * @param {string} loc Locale code.
     * @returns {object} The entry.
     */
    function entry(loc) {
        if (!idx.has(loc)) {
            idx.set(loc, { renames: [], strips: [], drops: [], deletes: new Set(), clicksendRewrite: false });
        }
        return idx.get(loc);
    }
    for (const r of RENAME_FIXES) {
        entry(r.locale).renames.push(r);
    }
    for (const s of STRIP_BRACES) {
        entry(s.locale).strips.push(s);
    }
    for (const d of DROP_TOKENS) {
        entry(d.locale).drops.push(d);
    }
    for (const d of DELETE_KEYS) {
        entry(d.locale).deletes.add(d.key);
    }
    for (const loc of CLICKSEND_REWRITE_LOCALES) {
        entry(loc).clicksendRewrite = true;
    }
    return idx;
}

/**
 * Apply Category E (issuetackerURL → issueTrackerURL) to a string.
 * @param {string} value Any source/locale string.
 * @returns {{ value: string, changed: boolean }} Rewritten value + flag.
 */
function applyIssueTrackerRename(value) {
    let out = value;
    let changed = false;
    for (const variant of ISSUE_TRACKER_VARIANTS) {
        if (out.includes(variant)) {
            out = out.split(variant).join(ISSUE_TRACKER_CORRECT);
            changed = true;
        }
    }
    return { value: out, changed };
}

/**
 * Process one locale file: rebuild the data preserving key order.
 * @param {string} file Locale filename.
 * @param {object} ops { renames, strips, drops, deletes, clicksendRewrite }.
 * @returns {boolean} True if the file changed.
 */
function processLocale(file, ops) {
    const locale = file.replace(/\.json$/, "");
    const { raw, data } = loadLocale(file);
    let touched = false;

    // Rebuild preserving key order, dropping deleted keys.
    const out = {};
    for (const k of Object.keys(data)) {
        if (ops && ops.deletes && ops.deletes.has(k)) {
            // Skip deleted key
            if (locale === "es-ES" || locale === "sv-SE") {
                if (k === "wayToGetClickSendSMSToken") {
                    stats.B_clicksend_delete++;
                }
            } else {
                stats.D_delete++;
            }
            touched = true;
            continue;
        }
        let value = data[k];

        // Apply per-key fixes from this locale's ops bucket.
        if (ops) {
            for (const r of ops.renames) {
                if (r.key === k) {
                    const before = value;
                    value = applyRenames(value, r.renames);
                    if (value !== before) {
                        stats.A_renamed++;
                    }
                }
            }
            for (const s of ops.strips) {
                if (s.key === k) {
                    const before = value;
                    value = stripBraces(value, s.tokens);
                    if (value !== before) {
                        stats.C_strip++;
                    }
                }
            }
            for (const d of ops.drops) {
                if (d.key === k) {
                    const before = value;
                    value = dropTokens(value, d.tokens);
                    if (value !== before) {
                        stats.C_drop++;
                    }
                }
            }
            if (ops.clicksendRewrite && k === "wayToGetClickSendSMSToken") {
                const before = value;
                value = value.split("{0}").join("{here}");
                if (value !== before) {
                    stats.B_clicksend_rewrite++;
                }
            }
        }

        // Category E — universal across every locale + every key.
        const issueRes = applyIssueTrackerRename(value);
        if (issueRes.changed) {
            stats.E_issuetracker_locales++;
        }
        value = issueRes.value;

        if (value !== data[k]) {
            touched = true;
        }
        out[k] = value;
    }

    // Category F — pa_PK languageName fix.
    if (locale === "pa_PK" && out.languageName !== PA_PK_LANGUAGE_NAME) {
        out.languageName = PA_PK_LANGUAGE_NAME;
        stats.F_pa_pk++;
        touched = true;
    }

    if (touched) {
        const text = serialise(out);
        if (text !== raw && !DRY) {
            fs.writeFileSync(path.join(LANG_DIR, file), text);
        }
    }
    return touched;
}

/**
 * Apply Category E to en.json (rename the placeholder name in the source key).
 * @returns {boolean} True if en.json changed.
 */
function fixEnJson() {
    const file = path.join(LANG_DIR, "en.json");
    const raw = fs.readFileSync(file, "utf8");
    const data = JSON.parse(raw);
    let touched = false;
    for (const k of Object.keys(data)) {
        const res = applyIssueTrackerRename(data[k]);
        if (res.changed) {
            data[k] = res.value;
            stats.E_issuetracker_en++;
            touched = true;
        }
    }
    if (touched && !DRY) {
        fs.writeFileSync(file, serialise(data));
    }
    return touched;
}

/**
 * Apply Category E to the Vue call site that uses the slot name.
 * Only renames the slot name, not surrounding markup or text.
 * @returns {boolean} True if the .vue file changed.
 */
function fixVueCallSite() {
    const file = path.join(SRC_ROOT, "components", "notifications", "GoogleChat.vue");
    if (!fs.existsSync(file)) {
        return false;
    }
    const raw = fs.readFileSync(file, "utf8");
    // The slot name appears as `#issuetackerURL` in the v-slot shorthand.
    // No braces here — it's a Vue slot identifier — but the same typo.
    if (!raw.includes("#issuetackerURL")) {
        return false;
    }
    const out = raw.split("#issuetackerURL").join("#issueTrackerURL");
    if (out !== raw) {
        if (!DRY) {
            fs.writeFileSync(file, out);
        }
        stats.E_issuetracker_vue++;
        return true;
    }
    return false;
}

// ----- Main -----------------------------------------------------------------

/**
 * Drive the full set of mechanical fixes across every locale + en + Vue file.
 */
function main() {
    const idx = buildLocaleIndex();
    const files = fs.readdirSync(LANG_DIR)
        .filter(f => f.endsWith(".json") && f !== "en.json")
        .sort();

    // Apply en.json's Category E first so the audit can be re-run cleanly.
    fixEnJson();
    fixVueCallSite();

    let changedFiles = 0;
    for (const file of files) {
        const locale = file.replace(/\.json$/, "");
        const ops = idx.get(locale) || null;
        if (processLocale(file, ops)) {
            changedFiles++;
        }
    }

    console.log(`i18n mechanical fixes${DRY ? " (DRY RUN)" : ""}:`);
    console.log(`  A renamed-placeholder fixes:        ${stats.A_renamed}`);
    console.log(`  B {0}->{here} rewrites:             ${stats.B_clicksend_rewrite}`);
    console.log(`  B clicksend deletes:                ${stats.B_clicksend_delete}`);
    console.log(`  C strip-braces fixes:               ${stats.C_strip}`);
    console.log(`  C drop-token fixes:                 ${stats.C_drop}`);
    console.log(`  D dropped-placeholder deletes:      ${stats.D_delete}`);
    console.log(`  E issuetackerURL renames (locales): ${stats.E_issuetracker_locales}`);
    console.log(`  E issuetackerURL en.json:           ${stats.E_issuetracker_en}`);
    console.log(`  E issuetackerURL .vue call site:    ${stats.E_issuetracker_vue}`);
    console.log(`  F pa_PK languageName:               ${stats.F_pa_pk}`);
    console.log(`  ${changedFiles} of ${files.length} locale files updated`);
}

main();
