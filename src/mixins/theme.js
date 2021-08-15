export default {

    data() {
        return {
            system: (window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light",
            userTheme: localStorage.theme,
        };
    },

    mounted() {
        // Default Light
        if (! this.userTheme) {
            this.userTheme = "light";
        }

        document.body.classList.add(this.theme);
        this.updateThemeColorMeta();
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
        },

        theme(to, from) {
            document.body.classList.remove(from);
            document.body.classList.add(this.theme);
            this.updateThemeColorMeta();
        }
    },

    methods: {
        updateThemeColorMeta() {
            if (this.theme === "dark") {
                document.querySelector("#theme-color").setAttribute("content", "#161B22");
            } else {
                document.querySelector("#theme-color").setAttribute("content", "#5cdd8b");
            }
        }
    }
}

