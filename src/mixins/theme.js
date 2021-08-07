export default {

    data() {
        return {
            system: (window.matchMedia("(prefers-color-scheme: dark)")) ? "dark" : "light",
            userTheme: localStorage.theme,
        };
    },

    mounted() {
        // Default Light
        if (! this.userTheme) {
            this.userTheme = "light";
        }
    },

    computed: {
        theme() {
            if (this.userTheme === "auto") {
                return this.system;
            }
            return this.userTheme;
        }
    },

    watch: {
        userTheme(to, from) {
            localStorage.theme = to;
        }
    }
}

