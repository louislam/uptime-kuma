import { currentLocale } from "../i18n";
import { setPageLocale, timeDurationFormatter } from "../util-frontend";
const langModules = import.meta.glob("../lang/*.json");

export default {
    data() {
        return {
            language: currentLocale(),
        };
    },

    async created() {
        if (this.language !== "en") {
            await this.changeLang(this.language);
        }
    },

    watch: {
        async language(lang) {
            await this.changeLang(lang);
        },
    },

    methods: {
        /**
         * Change the application language
         * @param {string} lang Language code to switch to
         * @returns {Promise<void>}
         */
        async changeLang(lang) {
            // Weblate names some files with an underscore (e.g. en_GB.json) while the locale key is a hyphenated tag ("en-GB")
            const loader = langModules[`../lang/${lang}.json`] ?? langModules[`../lang/${lang.replace("-", "_")}.json`];
            if (loader) {
                this.$i18n.setLocaleMessage(lang, (await loader()).default);
            } else {
                console.warn(`No translation file for "${lang}", falling back to "en"`);
                lang = "en";
            }
            this.$i18n.locale = lang;
            localStorage.locale = lang;
            setPageLocale();
            timeDurationFormatter.updateLocale(lang);
        },
    },
};
