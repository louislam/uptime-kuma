<template>
    <span class="badge rounded-pill" :class="'bg-' + color">{{ text }}</span>
</template>

<script>
import { NOMINAL, SLOW } from "../util.ts";

export default {
    props: {
        /** Response-time status */
        pingStatus: {
            type: Number,
            default: undefined,
        },
    },

    computed: {
        color() {
            if (this.pingStatus === SLOW) {
                return "warning";
            }

            if (this.pingStatus === NOMINAL) {
                return "primary";
            }

            return "secondary";
        },

        text() {
            if (this.pingStatus === SLOW) {
                return this.$t("Slow");
            }

            if (this.pingStatus === NOMINAL) {
                return this.$t("Nominal");
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
