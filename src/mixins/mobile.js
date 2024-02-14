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
        /**
         * Handle screen resize
         * @returns {void}
         */
        onResize() {
            this.windowWidth = window.innerWidth;
            this.updateBody();
        },

        /**
         * Add css-class "mobile" to body if needed
         * @returns {void}
         */
        updateBody() {
            if (this.isMobile) {
                document.body.classList.add("mobile");
            } else {
                document.body.classList.remove("mobile");
            }
        }

    },

    computed: {
        /**
         * @param {number? | undefined} width Width of the device
         * @returns {boolean} Whether the device is mobile
         */
        isMobile(width) {
            return (width && typeof width === "number"
                ? width ?? this.windowWidth
                : this.windowWidth) <= 767.98;
        },
    },

};
