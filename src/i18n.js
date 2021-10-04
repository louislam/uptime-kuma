import { createI18n } from "vue-i18n";
import bgBG from "./languages/bg-BG";
import daDK from "./languages/da-DK";
import deDE from "./languages/de-DE";
import en from "./languages/en";
import fa from "./languages/fa";
import esEs from "./languages/es-ES";
import etEE from "./languages/et-EE";
import frFR from "./languages/fr-FR";
import hu from "./languages/hu";
import itIT from "./languages/it-IT";
import ja from "./languages/ja";
import koKR from "./languages/ko-KR";
import nlNL from "./languages/nl-NL";
import pl from "./languages/pl";
import ptBR from "./languages/pt-BR";
import ruRU from "./languages/ru-RU";
import sr from "./languages/sr";
import srLatn from "./languages/sr-latn";
import svSE from "./languages/sv-SE";
import trTR from "./languages/tr-TR";
import zhCN from "./languages/zh-CN";
import zhHK from "./languages/zh-HK";

const languageList = {
    en,
    "zh-HK": zhHK,
    "bg-BG": bgBG,
    "de-DE": deDE,
    "nl-NL": nlNL,
    "es-ES": esEs,
    "fa": fa,
    "pt-BR": ptBR,
    "fr-FR": frFR,
    "hu": hu,
    "it-IT": itIT,
    "ja": ja,
    "da-DK": daDK,
    "sr": sr,
    "sr-latn": srLatn,
    "sv-SE": svSE,
    "tr-TR": trTR,
    "ko-KR": koKR,
    "ru-RU": ruRU,
    "zh-CN": zhCN,
    "pl": pl,
    "et-EE": etEE,
};

const rtlLangs = ["fa"];
    
export const currentLocale = () => localStorage.locale || "en";

export const localeDirection = () => {
    return rtlLangs.includes(currentLocale()) ? "rtl" : "ltr"
}
export const i18n = createI18n({
    locale: currentLocale(),
    fallbackLocale: "en",
    silentFallbackWarn: true,
    silentTranslationWarn: process.env.NODE_ENV !== "development",
    messages: languageList,
});
