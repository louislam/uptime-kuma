<template>
    <span class="badge rounded-pill" :class=" 'bg-' + color ">{{ text }}</span>
</template>

<script>
export default {
    props: {
        /** Current status of monitor */
        status: {
            type: Number,
            default: 0,
        }
    },

    computed: {
        color() {
            if (this.status === 0) {
                return "danger";
            }

            if (this.status === 1) {
                return "primary";
            }

            if (this.status === 2) {
                return "warning";
            }

            if (this.status === 3) {
                return "maintenance";
            }

            return "secondary";
        },

        text() {
            if (this.status === 0) {
                return this.$t("Down");
            }

            if (this.status === 1) {
                return this.$t("Up");
            }

            if (this.status === 2) {
                return this.$t("Pending");
            }

            if (this.status === 3) {
                return this.$t("statusMaintenance");
            }

            return this.$t("Unknown");
        },
    },
};
</script>

<style scoped>
    span {
        min-width: 64px;
    }
</style>
