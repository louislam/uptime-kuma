<template>
    <div class="uptime-grid-24h">
        <div
            v-for="(hourData, index) in gridData"
            :key="index"
            class="grid-cell"
            :class="getCellClass(hourData)"
            :title="getCellTitle(hourData, index)"
        ></div>
    </div>
</template>

<script>
import dayjs from "dayjs";
import { DOWN, UP } from "../util.ts";

export default {
    props: {
        monitorId: {
            type: Number,
            required: true,
        },
        hourlyData: {
            type: Array,
            default: () => [],
        },
    },
    computed: {
        gridData() {
            const result = [];
            const now = dayjs().utc();

            for (let i = 23; i >= 0; i--) {
                const hourStart = now.subtract(i, "hour").startOf("hour");
                const hourKey = hourStart.unix();

                const data = this.hourlyData.find((d) => d.timestamp === hourKey);

                if (data) {
                    result.push(data);
                } else {
                    result.push({
                        timestamp: hourKey,
                        up: 0,
                        down: 0,
                        avgPing: 0,
                    });
                }
            }

            return result;
        },
    },
    methods: {
        getCellClass(hourData) {
            const total = hourData.up + hourData.down;

            if (total === 0) {
                return "empty";
            }

            const ratio = hourData.up / total;

            if (ratio === 1) {
                return "up";
            } else if (ratio >= 0.9) {
                return "mostly-up";
            } else if (ratio >= 0.5) {
                return "partial";
            } else if (ratio > 0) {
                return "mostly-down";
            } else {
                return "down";
            }
        },

        getCellTitle(hourData, index) {
            const hourStart = dayjs
                .utc()
                .subtract(23 - index, "hour")
                .startOf("hour");
            const total = hourData.up + hourData.down;

            if (total === 0) {
                return `${this.$root.datetime(hourStart.toISOString())} - No data`;
            }

            const uptime = ((hourData.up / total) * 100).toFixed(1);
            return `${this.$root.datetime(hourStart.toISOString())} - ${uptime}% uptime (${hourData.up} up, ${hourData.down} down)`;
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.uptime-grid-24h {
    display: flex;
    gap: 2px;
    flex-wrap: wrap;

    .grid-cell {
        width: 14px;
        height: 14px;
        border-radius: 2px;
        cursor: pointer;
        transition: transform 0.1s ease;

        &:hover {
            transform: scale(1.3);
        }

        &.empty {
            background-color: #e5e7eb;

            .dark & {
                background-color: #374151;
            }
        }

        &.up {
            background-color: #22c55e;
        }

        &.mostly-up {
            background-color: #86efac;
        }

        &.partial {
            background-color: #facc15;
        }

        &.mostly-down {
            background-color: #f97316;
        }

        &.down {
            background-color: #dc2626;
        }
    }
}
</style>
