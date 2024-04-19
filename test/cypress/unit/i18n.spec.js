import { currentLocale } from "../../../src/i18n";

describe("Test i18n.js", () => {

    it("currentLocale()", () => {
        const setLanguage = (language) => {
            Object.defineProperty(window.navigator, 'language', {
                value: language,
                writable: true
            });
            Object.defineProperty(window.navigator, 'languages', {
                value: [language],
                writable: true
            });
        }
        setLanguage('en-EN');

        expect(currentLocale()).toEqual("en");

        setLanguage('zh-HK');
        expect(currentLocale()).toEqual("zh-HK");

        // Note that in Safari on iOS prior to 10.2, the country code returned is lowercase: "en-us", "fr-fr" etc.
        // https://developer.mozilla.org/en-US/docs/Web/API/Navigator/language
        setLanguage('zh-hk');
        expect(currentLocale()).toEqual("en");

        setLanguage('en-US');
        expect(currentLocale()).toEqual("en");

        setLanguage('ja-ZZ');
        expect(currentLocale()).toEqual("ja");

        setLanguage('zz-ZZ');
        expect(currentLocale()).toEqual("en");

        setLanguage('zz-ZZ');
        expect(currentLocale()).toEqual("en");

        setLanguage('en');
        localStorage.locale = "en";
        expect(currentLocale()).toEqual("en");

        localStorage.locale = "zh-HK";
        expect(currentLocale()).toEqual("zh-HK");
    });

});
