import { currentLocale } from "../../../src/i18n";

describe("Test i18n.js", () => {

    it("currentLocale()", () => {
        const setLanguage = (language) => {
            Object.defineProperty(window.navigator, 'language', { 
                value: language, 
                writable: true 
            });
        }
        setLanguage('en-EN');

        expect(currentLocale()).equal("en");

        setLanguage('zh-HK');
        expect(currentLocale()).equal("zh-HK");

        // Note that in Safari on iOS prior to 10.2, the country code returned is lowercase: "en-us", "fr-fr" etc.
        // https://developer.mozilla.org/en-US/docs/Web/API/Navigator/language
        setLanguage('zh-hk');
        expect(currentLocale()).equal("en");

        setLanguage('en-US');
        expect(currentLocale()).equal("en");

        setLanguage('ja-ZZ');
        expect(currentLocale()).equal("ja");

        setLanguage('zz-ZZ');
        expect(currentLocale()).equal("en");

        setLanguage('zz-ZZ');
        expect(currentLocale()).equal("en");

        setLanguage('en');
        localStorage.locale = "en";
        expect(currentLocale()).equal("en");

        localStorage.locale = "zh-HK";
        expect(currentLocale()).equal("zh-HK");
    });

});