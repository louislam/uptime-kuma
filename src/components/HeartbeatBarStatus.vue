<template>
    <div ref="wrap">
        <div class="hp-bar-big">
            <CalendarHeatmap
                :style="{ fill: 'var(--dark-font-color2)', fontSize: 'xx-small' }"
                class="heatmap" :values="values" :end-date="endDate" no-data-text="Unknown" tooltip-unit="%"
                :range-color="['aliceblue', 'var(--danger)', 'var(--warning)', 'var(--warning)', 'var(--highlight)', 'var(--primary)']"
                :display-legend="false"
                round="3"
                :max="100"
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

:root {
    --highlight-white: #{$highlight-white};
    --danger: #{$danger};
    --warning: #{$warning};
    --warning2: #ffc100;
    --highlight: #{$highlight};
    --primary: #{$primary};
    --dark-font-color2: #{$dark-font-color2};
}

/* stylelint-disable */
// This naming is an internal name for the package vue3-calendar-heatmap and it cannot be modified to kebab-case
.vch__legend {
    display: none !important;
}

.hp-bar-big {
    padding: 10px;
    overflow: visible;
    background-color: white;
    border-radius: 6px;
}

.heatmap {
    rect.vch__day__square {
        stroke: none !important;
        stroke-width: 0 !important;

        &:hover {
        fill-opacity: 0.5;
        }
    }
}
/* stylelint-enable */
</style>
