import { currentLocale } from "../../../src/i18n";

describe("Test i18n.js", () => {

    it("currentLocale()", () => {
        const setLanguages = (languages) => {
            Object.defineProperty(navigator, 'language', {
                value: languages[0],
                writable: true
            });
            Object.defineProperty(navigator, 'languages', {
                value: languages,
                writable: true
            });
        }

        setLanguages(['en-EN']);
        expect(currentLocale()).equal("en");

        setLanguages(['zh-HK']);
        expect(currentLocale()).equal("zh-HK");

        // Note that in Safari on iOS prior to 10.2, the country code returned is lowercase: "en-us", "fr-fr" etc.
        // https://developer.mozilla.org/en-US/docs/Web/API/Navigator/language
        setLanguages(['zh-hk']);
        expect(currentLocale()).equal("en");

        setLanguages(['en-US']);
        expect(currentLocale()).equal("en");

        setLanguages(['ja-ZZ']);
        expect(currentLocale()).equal("ja");

        setLanguages(['zz-ZZ']);
        expect(currentLocale()).equal("en");

        setLanguages(['zz-ZZ']);
        expect(currentLocale()).equal("en");

        setLanguages(['en-US', 'en', 'pl', 'ja']);
        expect(currentLocale()).equal("en");

        setLanguages(['en-US', 'pl', 'ja']);
        expect(currentLocale()).equal("en");

        setLanguages(['abc', 'en-US', 'pl', 'ja']);
        expect(currentLocale()).equal("en");

        setLanguages(['fil-PH', 'pl']);
        expect(currentLocale()).equal("pl");

        setLanguages(['shi-Latn-MA', 'pl']);
        expect(currentLocale()).equal("pl");

        setLanguages(['pl']);
        localStorage.locale = "ja-ZZ";
        expect(currentLocale()).equal("ja");

        setLanguages(['pl']);
        localStorage.locale = "invalid-lang";
        expect(currentLocale()).equal("pl");
    });

});
