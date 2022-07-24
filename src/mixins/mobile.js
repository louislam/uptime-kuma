export default {

    data() {
        return {
            windowWidth: window.innerWidth,
        };
    },

    created() {
        window.addEventListener("resize", this.onResize);
        this.updateBody();
    },

    methods: {
        /** Handle screen resize */
        onResize() {
            this.windowWidth = window.innerWidth;
            this.updateBody();
        },

        /** Add css-class "mobile" to body if needed */
        updateBody() {
            if (this.isMobile) {
                document.body.classList.add("mobile");
            } else {
                document.body.classList.remove("mobile");
            }
        }

    },

    computed: {
        isMobile() {
            return this.windowWidth <= 767.98;
        },
    },

};
