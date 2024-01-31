<template>
    <div ref="wrap">
        <div class="hp-bar-big">
            <CalendarHeatmap
                :style="{ fill: '#fff', fontSize: 'x-small' }"
                class="heatmap" :values="values" :end-date="endDate" no-data-text="Unknown" tooltip-unit="%"
                :range-color="['#ebedf0', '#C3D4CB', '#9ABAA7', '#72A182', '#49875E', '#216E39']" :max="100"
            />
        </div>
    </div>
</template>

<script>
import dayjs from "dayjs";
import { CalendarHeatmap } from "vue3-calendar-heatmap";

export default {
    components: { CalendarHeatmap },
    props: {
        /** ID of the monitor */
        monitorId: {
            type: Number,
            required: true,
        },
    },
    computed: {
        // Getting the values in form of percentage
        values() {
            const data = this.$root.heartbeatList[this.monitorId]?.map(({ day, percentage }) => ({ date: day,
                count: percentage.toFixed(1) }));
            return data || [];
        },

        endDate() {
            const date = dayjs().format("YYYY-MM-DD");
            return date;
        },
    },
    unmounted() {
        window.removeEventListener("resize", this.resize);
    },
    beforeMount() {
        if (this.heartbeatList === null) {
            if (!(this.monitorId in this.$root.heartbeatList)) {
                this.$root.heartbeatList[this.monitorId] = [];
            }
        }
    },

    mounted() {
        window.addEventListener("resize", this.resize);
        this.resize();
    },
    methods: {
        /**
         * Resize the heartbeat bar
         * @returns {void}
         */
        resize() {
            if (this.$refs.wrap) {
                this.maxBeat = Math.floor(this.$refs.wrap.clientWidth / (this.beatWidth + this.beatMargin * 2));
            }
        },

    },
};
</script>

<style lang="scss">
@import "../assets/vars.scss";

// This naming is an internal name for the package vue3-calendar-heatmap and it cannot be modified to kebab-case
/* stylelint-disable */
.vch__legend {
    display: inline-flex;
    padding: 0.25rem 0.5rem;
    gap: 1ch;
    align-items: center;
}
/* stylelint-enable */
</style>
