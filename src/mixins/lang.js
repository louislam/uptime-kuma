import { currentLocale } from "../i18n";
import { setPageLocale, timeDurationFormatter } from "../util-frontend";
const langModules = import.meta.glob("../lang/*.json");

export default {
    data() {
        return {
            language: currentLocale(),
            persistLanguage: true,
        };
    },

    async created() {
        if (this.language !== "en") {
            await this.changeLang(this.language);
        }
    },

    watch: {
        async language(lang) {
            await this.changeLang(lang, {
                persist: this.persistLanguage,
            });
            this.persistLanguage = true;
        },
    },

    methods: {
        /**
         * Set the application language
         * @param {string} lang Language code to switch to
         * @param {{ persist?: boolean }} options Options for language change
         * @returns {void}
         */
        setLanguage(lang, options = {}) {
            this.persistLanguage = options.persist !== false;
            this.language = lang;
        },

        /**
         * Change the application language
         * @param {string} lang Language code to switch to
         * @param {{ persist?: boolean }} options Options for language change
         * @returns {Promise<void>}
         */
        async changeLang(lang, options = {}) {
            const persist = options.persist !== false;
            let message = (await langModules["../lang/" + lang + ".json"]()).default;
            this.$i18n.setLocaleMessage(lang, message);
            this.$i18n.locale = lang;
            if (persist) {
                localStorage.locale = lang;
            }
            setPageLocale(lang);
            timeDurationFormatter.updateLocale(lang);
        },
    },
};
