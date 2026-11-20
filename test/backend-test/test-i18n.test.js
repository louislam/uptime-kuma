const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert");

describe("i18n currentLocale() auto-detection", async () => {
    // Setup mock browser globals before importing i18n
    globalThis.localStorage = {};
    let mockLanguages = ["en"];

    Object.defineProperty(globalThis, "navigator", {
        get() {
            return {
                language: mockLanguages[0],
                languages: mockLanguages,
            };
        },
        configurable: true,
    });

    const { currentLocale } = await import("../../src/i18n.js");

    beforeEach(() => {
        globalThis.localStorage = {};
        mockLanguages = ["en"];
    });

    it("should prioritize localStorage.locale if present", () => {
        globalThis.localStorage.locale = "de-DE";
        mockLanguages = ["cs", "sk", "en-US"];
        assert.strictEqual(currentLocale(), "de-DE");
    });

    it("should match direct locales in messages", () => {
        mockLanguages = ["sk", "en-US"];
        assert.strictEqual(currentLocale(), "sk");

        mockLanguages = ["fi"];
        assert.strictEqual(currentLocale(), "fi");
    });

    it("should resolve symmetrical 2-letter codes to their regional variant", () => {
        mockLanguages = ["fr"];
        assert.strictEqual(currentLocale(), "fr-FR");

        mockLanguages = ["de"];
        assert.strictEqual(currentLocale(), "de-DE");

        mockLanguages = ["es"];
        assert.strictEqual(currentLocale(), "es-ES");
    });

    it("should resolve bare 'cs' to 'cs-CZ' instead of skipping to 'sk' (Issue #7803)", () => {
        mockLanguages = ["cs", "sk", "en-US"];
        assert.strictEqual(currentLocale(), "cs-CZ");
    });

    it("should resolve other asymmetrical 2-letter language codes to their registered locale", () => {
        const asymmetricalCases = [
            { input: ["cs"], expected: "cs-CZ" },
            { input: ["da"], expected: "da-DK" },
            { input: ["nb"], expected: "nb-NO" },
            { input: ["sv"], expected: "sv-SE" },
            { input: ["et"], expected: "et-EE" },
            { input: ["uk"], expected: "uk-UA" },
            { input: ["sl"], expected: "sl-SI" },
            { input: ["ko"], expected: "ko-KR" },
            { input: ["he"], expected: "he-IL" },
            { input: ["ar"], expected: "ar-SY" },
            { input: ["el"], expected: "el-GR" },
        ];

        for (const { input, expected } of asymmetricalCases) {
            mockLanguages = input;
            assert.strictEqual(currentLocale(), expected, `Expected ${input[0]} to resolve to ${expected}`);
        }
    });

    it("should deterministically resolve 'zh' to 'zh-CN'", () => {
        mockLanguages = ["zh", "en"];
        assert.strictEqual(currentLocale(), "zh-CN");
    });

    it("should preserve specific regional variants when explicitly requested", () => {
        mockLanguages = ["zh-TW", "en"];
        assert.strictEqual(currentLocale(), "zh-TW");

        mockLanguages = ["pt-BR", "en"];
        assert.strictEqual(currentLocale(), "pt-BR");
    });

    it("should fall back to 'en' when no locale matches", () => {
        mockLanguages = ["xx-YY", "zz"];
        assert.strictEqual(currentLocale(), "en");
    });
});
