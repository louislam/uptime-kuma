// eslint-disable-next-line no-global-assign
global.localStorage = {};
global.navigator = {
    language: "en"
};

const { currentLocale } = require("../src/i18n");

describe("Test i18n.js", () => {

    it("currentLocale()", () => {
        expect(currentLocale()).toEqual("en");

        navigator.language = "zh-HK";
        expect(currentLocale()).toEqual("zh-HK");

        // Note that in Safari on iOS prior to 10.2, the country code returned is lowercase: "en-us", "fr-fr" etc.
        // https://developer.mozilla.org/en-US/docs/Web/API/Navigator/language
        navigator.language = "zh-hk";
        expect(currentLocale()).toEqual("en");

        navigator.language = "en-US";
        expect(currentLocale()).toEqual("en");

        navigator.language = "ja-ZZ";
        expect(currentLocale()).toEqual("ja");

        navigator.language = "zz";
        expect(currentLocale()).toEqual("en");

        navigator.language = "zz-ZZ";
        expect(currentLocale()).toEqual("en");

        localStorage.locale = "en";
        expect(currentLocale()).toEqual("en");

        localStorage.locale = "zh-HK";
        expect(currentLocale()).toEqual("zh-HK");
    });

});

