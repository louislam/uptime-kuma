export default {

    data() {
        return {
            windowWidth: window.innerWidth,
        }
    },

    created() {
        window.addEventListener("resize", this.onResize);
    },

    methods: {
        onResize() {
            this.windowWidth = window.innerWidth;
        },
    },

    computed: {
        isMobile() {
            return this.windowWidth <= 767.98;
        },
    }

}
