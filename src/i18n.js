import { createI18n } from "vue-i18n/dist/vue-i18n.esm-browser.prod.js";
import en from "./lang/en.json";

const languageList = {
    "ar-SY": "العربية",
    "cs": "Čeština",
    "zh-HK": "繁體中文 (香港)",
    "bg": "Български",
    "be": "Беларуская",
    "de-DE": "Deutsch (Deutschland)",
    "de-CH": "Deutsch (Schweiz)",
    "nl": "Nederlands",
    "nb": "Norsk",
    "es": "Español",
    "eu": "Euskara",
    "fa": "Farsi",
    "pt-PT": "Português (Portugal)",
    "pt-BR": "Português (Brasileiro)",
    "fi": "Suomi",
    "fr": "Français",
    "he-IL": "עברית",
    "hu": "Magyar",
    "hr-HR": "Hrvatski",
    "it": "Italiano",
    "id": "Bahasa Indonesia",
    "ja": "日本語",
    "da": "Danish",
    "sr": "Српски",
    "sl": "Slovenščina",
    "sr-latn": "Srpski",
    "sv": "Svenska",
    "tr": "Türkçe",
    "ko": "한국어",
    "lt": "Lietuvių",
    "ru": "Русский",
    "zh-CN": "简体中文",
    "pl": "Polski",
    "et": "eesti",
    "vi": "Tiếng Việt",
    "zh-TW": "繁體中文 (台灣)",
    "uk": "Українська",
    "th": "ไทย",
    "el": "Ελληνικά",
    "yue": "繁體中文 (廣東話 / 粵語)",
    "ro": "Limba română",
    "ur": "Urdu",
    "ge": "ქართული",
    "uz": "O'zbek tili",
    "ga": "Gaeilge",
};

let messages = {
    en,
};

for (let lang in languageList) {
    messages[lang] = {
        languageName: languageList[lang]
    };
}

const rtlLangs = [ "he-IL", "fa", "ar-SY", "ur" ];

/**
 * Find the best matching locale to display
 * If no locale can be matched, the default is "en"
 * @returns {string} the locale that should be displayed
 */
export function currentLocale() {
    for (const locale of [ localStorage.locale, navigator.language, ...navigator.languages ]) {
        // localstorage might not have a value or there might not be a language in `navigator.language`
        if (!locale) {
            continue;
        }
        if (locale in messages) {
            return locale;
        }
        // some locales are further specified such as "en-US".
        // If we only have a generic locale for this, we can use it too
        const genericLocale = locale.split("-")[0];
        if (genericLocale in messages) {
            return genericLocale;
        }
    }
    return "en";
}

export const localeDirection = () => {
    return rtlLangs.includes(currentLocale()) ? "rtl" : "ltr";
};

export const i18n = createI18n({
    locale: currentLocale(),
    fallbackLocale: "en",
    silentFallbackWarn: true,
    silentTranslationWarn: true,
    messages: messages,
});
