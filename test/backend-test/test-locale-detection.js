const { describe, it } = require("node:test");
const assert = require("node:assert");

/**
 * Minimal replica of the currentLocale() inner loop for unit testing.
 *
 * This mirrors the algorithm in src/i18n.js so we can exercise it in Node without
 * importing Vue or browser-only globals (localStorage, navigator).  Keep in sync with
 * any changes to that function.
 */
function findLocale(locale, messages) {
    if (locale in messages) {
        return locale;
    }
    if (locale.length === 2) {
        const regionalLocale = `${locale}-${locale.toUpperCase()}`;
        if (regionalLocale in messages) {
            return regionalLocale;
        }
        // Fallback: find the first registered locale whose language prefix matches
        // (handles cs→cs-CZ, da→da-DK, ko→ko-KR, etc.)
        const prefixMatch = Object.keys(messages).find(
            (key) => key.toLowerCase().startsWith(locale.toLowerCase() + "-")
        );
        if (prefixMatch) {
            return prefixMatch;
        }
    } else {
        const genericLocale = locale.slice(0, 2);
        if (genericLocale in messages) {
            return genericLocale;
        }
    }
    return null;
}

// A representative subset of the real languageList from src/i18n.js.
const messages = {
    en: {},
    "fr-FR": {},
    "de-DE": {},
    "de-CH": {},
    "cs-CZ": {},
    "da-DK": {},
    "nb-NO": {},
    "sv-SE": {},
    "ko-KR": {},
    "he-IL": {},
    "ar-SY": {},
    "uk-UA": {},
    "et-EE": {},
    "sl-SI": {},
    "zh-CN": {},
    "zh-TW": {},
    "zh-HK": {},
    sk: {},
    ja: {},
    pl: {},
};

describe("locale detection — 2-letter code prefix fallback (fix for #7803)", () => {
    it("returns the exact registered locale when it already matches (fr-FR)", () => {
        assert.strictEqual(findLocale("fr-FR", messages), "fr-FR");
    });

    it("keeps the existing fast path when region === language code (fr→fr-FR, de→de-DE)", () => {
        assert.strictEqual(findLocale("fr", messages), "fr-FR");
        assert.strictEqual(findLocale("de", messages), "de-DE");
    });

    it("resolves cs→cs-CZ (not cs-CS, which does not exist)", () => {
        assert.strictEqual(findLocale("cs", messages), "cs-CZ");
    });

    it("resolves da→da-DK", () => {
        assert.strictEqual(findLocale("da", messages), "da-DK");
    });

    it("resolves nb→nb-NO", () => {
        assert.strictEqual(findLocale("nb", messages), "nb-NO");
    });

    it("resolves sv→sv-SE", () => {
        assert.strictEqual(findLocale("sv", messages), "sv-SE");
    });

    it("resolves ko→ko-KR", () => {
        assert.strictEqual(findLocale("ko", messages), "ko-KR");
    });

    it("resolves he→he-IL", () => {
        assert.strictEqual(findLocale("he", messages), "he-IL");
    });

    it("resolves uk→uk-UA", () => {
        assert.strictEqual(findLocale("uk", messages), "uk-UA");
    });

    it("resolves et→et-EE", () => {
        assert.strictEqual(findLocale("et", messages), "et-EE");
    });

    it("resolves sl→sl-SI", () => {
        assert.strictEqual(findLocale("sl", messages), "sl-SI");
    });

    it("leaves bare-code locales that have a bare registration unchanged (sk, ja, pl)", () => {
        assert.strictEqual(findLocale("sk", messages), "sk");
        assert.strictEqual(findLocale("ja", messages), "ja");
        assert.strictEqual(findLocale("pl", messages), "pl");
    });

    it("falls through to null for an unrecognised locale", () => {
        assert.strictEqual(findLocale("xx", messages), null);
    });
});
