<template>
    <div>
        <h2 class="pointer" @click="toggle">
            Badges generator {{ visible ? "-" : "+" }}
        </h2>
        <div v-if="visible">
            <StatusBadge :monitor="monitor" :colors="colors" />
            <hr />
            <PingBadge :monitor="monitor" :colors="colors" />
            <hr />
            <UptimeBadge :monitor="monitor" :colors="colors" />
        </div>
    </div>
</template>

<script>
import PingBadge from "./badges/PingBadge.vue";
import StatusBadge from "./badges/StatusBadge.vue";
import UptimeBadge from "./badges/UptimeBadge.vue";

export default {
    components: {
        StatusBadge,
        PingBadge,
        UptimeBadge,
    },
    props: {
        monitor: {
            default: () => {},
            type: Object,
        },
    },
    data() {
        return {
            visible: false,
            colors: [
                "brightgreen",
                "green",
                "yellow",
                "yellowgreen",
                "orange",
                "red",
                "blue",
                "grey",
                "lightgrey",
                "white",
                "black",
            ],
        };
    },
    computed: {},
    watch: {},
    mounted() {},
    methods: {
        toggle() {
            this.visible = !this.visible;
        },
    },
};
</script>

<style>
.fix-width-label {
    max-width: 40px;
}

.pointer {
    cursor: pointer;
}
</style>
