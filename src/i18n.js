import { createI18n } from "vue-i18n/dist/vue-i18n.esm-browser.prod.js";
import messages from "./i18n-list";

const rtlLangs = [ "fa", "ar-SY" ];

export const currentLocale = () => localStorage.locale
    || messages[navigator.language] && navigator.language
    || messages[navigator.language.substring(0, 2)] && navigator.language.substring(0, 2)
    || "en";

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
