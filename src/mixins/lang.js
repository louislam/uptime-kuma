import { currentLocale } from "../i18n";
import { setPageLocale, relativeTimeFormatter } from "../util-frontend";
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
            let message = (await langModules["../lang/" + lang + ".json"]())
                .default;
            this.$i18n.setLocaleMessage(lang, message);
            this.$i18n.locale = lang;
            localStorage.locale = lang;
            setPageLocale();
            relativeTimeFormatter.updateLocale(lang);
        },
    },
};
