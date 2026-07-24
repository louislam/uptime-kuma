import { currentLocale } from "../i18n";
import { setPageLocale, timeDurationFormatter } from "../util-frontend";
const langModules = import.meta.glob("../lang/*.json");

export default {
    data() {
        return {
            language: currentLocale(),
            statusPageLanguage: null,
        };
    },

    async created() {
        if (this.language !== "en") {
            await this.changeLang(this.language);
        }
    },

    watch: {
        async language(lang) {
            await this.changeLang(lang, true);
        },
        async statusPageLanguage(lang) {
            await this.changeLang(lang, false);
        },
    },

    methods: {
        /**
         * Change the application language
         * @param {string} lang Language code to switch to
         * @param {boolean} persist Whether to persist the language selection in localStorage
         * @returns {Promise<void>}
         */
        async changeLang(lang, persist = true) {
            let message = (await langModules["../lang/" + lang + ".json"]()).default;
            this.$i18n.setLocaleMessage(lang, message);
            this.$i18n.locale = lang;
            if (persist) {
                localStorage.locale = lang;
            }
            setPageLocale();
            timeDurationFormatter.updateLocale(lang);
        },
    },
};
