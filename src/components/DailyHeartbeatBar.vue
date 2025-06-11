<template>
    <div ref="wrap" class="wrap" :style="wrapStyle">
        <div class="hp-bar-big" :style="barStyle">
            <div
                v-for="(beat, index) in shortBeatList"
                :key="index"
                class="beat-hover-area"
                :class="{ 'empty': (beat === 0) }"
                :style="beatHoverAreaStyle"
                :title="getBeatTitle(beat)"
            >
                <div
                    class="beat daily-beat"
                    :class="{
                        'empty': (beat === 0),
                        'missing': (beat.missing || beat.status === -1),
                        'down': (beat.status === 0),
                        'pending': (beat.status === 2),
                        'maintenance': (beat.status === 3)
                    }"
                    :style="getBeatStyle(beat)"
                />
            </div>
        </div>
        <div
            v-if="!$root.isMobile && size !== 'small' && beatList.length > 4 && $root.styleElapsedTime !== 'none'"
            class="d-flex justify-content-between align-items-center word" :style="timeStyle"
        >
            <div>{{ timeSinceFirstBeat }}</div>
            <div v-if="$root.styleElapsedTime === 'with-line'" class="connecting-line"></div>
            <div>{{ timeSinceLastBeat }}</div>
        </div>
    </div>
</template>

<script>
import dayjs from "dayjs";

export default {
    props: {
        /** Size of the heartbeat bar */
        size: {
            type: String,
            default: "big",
        },
        /** ID of the monitor */
        monitorId: {
            type: Number,
            required: true,
        },
        /** Array of the monitors daily heartbeats */
        heartbeatList: {
            type: Array,
            default: null,
        }
    },
    data() {
        return {
            beatWidth: 10,
            beatHeight: 30,
            hoverScale: 1.5,
            beatHoverAreaPadding: 4,
            move: false,
            maxBeat: -1,
        };
    },
    computed: {
        /**
         * If heartbeat list is loaded
         * @returns {boolean} True if loaded
         */
        hasHeartbeat() {
            return (this.$root.dailyHeartbeatList[this.monitorId] &&
                this.$root.dailyHeartbeatList[this.monitorId].length > 0);
        },

        /**
         * If heartbeatList is null, get it from $root.dailyHeartbeatList
         * @returns {object} Daily heartbeat list
         */
        beatList() {
            if (this.heartbeatList === null) {
                return this.$root.dailyHeartbeatList[this.monitorId];
            } else {
                return this.heartbeatList;
            }
        },

        /**
         * Calculates the amount of beats of padding needed to fill the length of shortBeatList.
         * @returns {number} The amount of beats of padding needed to fill the length of shortBeatList.
         */
        numPadding() {
            if (!this.beatList) {
                return 0;
            }
            let num = this.beatList.length - this.maxBeat;

            if (this.move) {
                num = num - 1;
            }

            if (num > 0) {
                return 0;
            }

            return -1 * num;
        },

        shortBeatList() {
            if (!this.$root.dailyHeartbeatList[this.monitorId]) {
                return this.generateCompleteTimeline([]);
            }

            let result = this.$root.dailyHeartbeatList[this.monitorId].slice();
            const completeTimeline = this.generateCompleteTimeline(result);

            if (completeTimeline.length > this.maxBeat) {
                return completeTimeline.slice(-this.maxBeat);
            }

            return completeTimeline;
        },

        wrapStyle() {
            let topBottom = (((this.beatHeight * this.hoverScale) - this.beatHeight) / 2);
            let leftRight = (((this.beatWidth * this.hoverScale) - this.beatWidth) / 2);

            return {
                padding: `${topBottom}px ${leftRight}px`,
                width: "100%",
            };
        },

        barStyle() {
            if (this.move && this.shortBeatList.length > this.maxBeat) {
                let width = -(this.beatWidth + this.beatHoverAreaPadding * 2);

                return {
                    transition: "all ease-in-out 0.25s",
                    transform: `translateX(${width}px)`,
                };

            }
            return {
                transform: "translateX(0)",
            };

        },

        beatHoverAreaStyle() {
            return {
                padding: this.beatHoverAreaPadding + "px",
                "--hover-scale": this.hoverScale,
            };
        },

        beatStyle() {
            return {
                width: this.beatWidth + "px",
                height: this.beatHeight + "px",
            };
        },

        /**
         * Returns the style object for positioning the time element.
         * @returns {object} The style object containing the CSS properties for positioning the time element.
         */
        timeStyle() {
            return {
                "margin-left": this.numPadding * (this.beatWidth + this.beatHoverAreaPadding * 2) + "px",
            };
        },

        /**
         * Calculates the time elapsed since the first valid beat.
         * @returns {string} The time elapsed in days or months.
         */
        timeSinceFirstBeat() {
            const firstValidBeat = this.shortBeatList.at(this.numPadding);
            if (!firstValidBeat || !firstValidBeat.date) {
                return "";
            }

            const days = dayjs().diff(dayjs(firstValidBeat.date), "days");
            if (days > 30) {
                return Math.floor(days / 30) + "mo";
            } else {
                return days + "d";
            }
        },

        /**
         * Calculates the elapsed time since the last valid beat was registered.
         * @returns {string} The elapsed time in days or "today".
         */
        timeSinceLastBeat() {
            const lastValidBeat = this.shortBeatList.at(-1);
            if (!lastValidBeat || !lastValidBeat.date) {
                return "";
            }

            const days = dayjs().diff(dayjs(lastValidBeat.date), "days");

            if (days === 0) {
                return this.$t("Today");
            } else if (days === 1) {
                return this.$t("Yesterday");
            } else if (days < 7) {
                return days + "d";
            } else {
                return Math.floor(days / 7) + "w";
            }
        }
    },
    watch: {
        beatList: {
            handler(val, oldVal) {
                this.move = true;

                setTimeout(() => {
                    this.move = false;
                }, 300);
            },
            deep: true,
        },
    },
    unmounted() {
        window.removeEventListener("resize", this.resize);
    },
    beforeMount() {
        if (this.heartbeatList === null) {
            if (!(this.monitorId in this.$root.dailyHeartbeatList)) {
                this.$root.dailyHeartbeatList[this.monitorId] = [];
            }
        }
    },

    mounted() {
        if (this.size !== "big") {
            this.beatWidth = 5;
            this.beatHeight = 16;
            this.beatHoverAreaPadding = 2;
        }

        // Suddenly, have an idea how to handle it universally.
        // If the pixel * ratio != Integer, then it causes render issue, round it to solve it!!
        const actualWidth = this.beatWidth * window.devicePixelRatio;
        const actualHoverAreaPadding = this.beatHoverAreaPadding * window.devicePixelRatio;

        if (!Number.isInteger(actualWidth)) {
            this.beatWidth = Math.round(actualWidth) / window.devicePixelRatio;
        }

        if (!Number.isInteger(actualHoverAreaPadding)) {
            this.beatHoverAreaPadding = Math.round(actualHoverAreaPadding) / window.devicePixelRatio;
        }

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
                this.maxBeat = Math.floor(this.$refs.wrap.clientWidth / (this.beatWidth + this.beatHoverAreaPadding * 2));
            }
        },

        /**
         * Get the title of the beat for daily data.
         * Used as the hover tooltip on the heartbeat bar.
         * @param {object} beat Beat to get title from
         * @returns {string} Beat title
         */
        getBeatTitle(beat) {
            if (!beat || beat === 0) {
                return "";
            }

            // Handle missing data
            if (beat.missing || beat.status === -1) {
                const date = beat.date || beat.time.split(" ")[0];
                return `${date}\nNo data available`;
            }

            const date = beat.date || beat.time.split(" ")[0];
            const uptime = Math.round(beat.uptime * 100);
            const stats = beat.dailyStats;

            let tooltip = `${date}\nUptime: ${uptime}%`;

            if (stats) {
                tooltip += `\nUp: ${stats.up}, Down: ${stats.down}`;
                if (stats.pending > 0) {
                    tooltip += `, Pending: ${stats.pending}`;
                }
                if (stats.maintenance > 0) {
                    tooltip += `, Maintenance: ${stats.maintenance}`;
                }
                tooltip += `\nTotal checks: ${stats.total}`;
            }

            if (beat.ping) {
                tooltip += `\nAvg ping: ${beat.ping}ms`;
            }

            return tooltip;
        },

        /**
         * Get the style for an individual beat, including opacity based on uptime
         * @param {object} beat Beat object
         * @returns {object} Style object
         */
        getBeatStyle(beat) {
            let style = {
                width: this.beatWidth + "px",
                height: this.beatHeight + "px",
            };

            // Don't apply uptime opacity to missing data beats - they get CSS opacity instead
            if (beat && beat.uptime !== undefined && !beat.missing && beat.status !== -1) {
                // Ensure minimum opacity of 0.3 for visibility, max of 1.0
                const opacity = Math.max(0.3, Math.min(1.0, beat.uptime));
                style.opacity = opacity;
            }

            return style;
        },

        /**
         * Generate a complete 3-month timeline with placeholders for missing data
         * @param {Array} actualData Array of actual daily heartbeat data
         * @returns {Array} Complete timeline with placeholders for missing dates
         */
        generateCompleteTimeline(actualData) {
            const timeline = [];
            const today = dayjs().startOf("day");
            const startDate = today.subtract(90, "day"); // 3 months back

            // Create a map of existing data by date for quick lookup
            const dataMap = {};
            actualData.forEach(beat => {
                if (beat && beat.date) {
                    const dateKey = dayjs(beat.date).format("YYYY-MM-DD");
                    dataMap[dateKey] = beat;
                }
            });

            // Generate complete timeline from startDate to today
            for (let i = 0; i <= 90; i++) {
                const currentDate = startDate.add(i, "day");
                const dateKey = currentDate.format("YYYY-MM-DD");

                if (dataMap[dateKey]) {
                    // Use actual data if available
                    timeline.push(dataMap[dateKey]);
                } else {
                    // Create placeholder for missing data
                    timeline.push({
                        status: -1, // Special status for missing data
                        date: dateKey,
                        time: dateKey + " 00:00:00",
                        uptime: 0,
                        ping: 0,
                        missing: true,
                        dailyStats: {
                            total: 0,
                            up: 0,
                            down: 0,
                            pending: 0,
                            maintenance: 0
                        }
                    });
                }
            }

            return timeline;
        },

    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.wrap {
    overflow: hidden;
    width: 100%;
    white-space: nowrap;
}

.hp-bar-big {
    .beat-hover-area {
        display: inline-block;

        &:not(.empty):hover {
            transition: all ease-in-out 0.15s;
            opacity: 0.8;
            transform: scale(var(--hover-scale));
        }

        .beat {
            background-color: $primary;
            border-radius: $border-radius;

            /*
            pointer-events needs to be changed because
            tooltip momentarily disappears when crossing between .beat-hover-area and .beat
            */
            pointer-events: none;

            &.empty {
                background-color: aliceblue;
            }

            &.missing {
                background-color: #e0e0e0;
                opacity: 0.6;
            }

            &.down {
                background-color: $danger;
            }

            &.pending {
                background-color: $warning;
            }

            &.maintenance {
                background-color: $maintenance;
            }

            // Daily beats get special styling
            &.daily-beat {
                border: 1px solid rgba(0, 0, 0, 0.1);

                &.down {
                    border-color: darken($danger, 10%);
                }

                &.pending {
                    border-color: darken($warning, 10%);
                }

                &.maintenance {
                    border-color: darken($maintenance, 10%);
                }

                &:not(.empty):not(.down):not(.pending):not(.maintenance):not(.missing) {
                    border-color: darken($primary, 10%);
                }

                &.missing {
                    border-color: transparent;
                }
            }
        }
    }
}

.dark {
    .hp-bar-big .beat.empty {
        background-color: #848484;
    }

    .hp-bar-big .beat.missing {
        background-color: #555555;
        opacity: 0.6;
    }

    .hp-bar-big .beat.daily-beat {
        border-color: rgba(255, 255, 255, 0.2);

        &.down {
            border-color: lighten($danger, 10%);
        }

        &.pending {
            border-color: lighten($warning, 10%);
        }

        &.maintenance {
            border-color: lighten($maintenance, 10%);
        }

        &:not(.empty):not(.down):not(.pending):not(.maintenance):not(.missing) {
            border-color: lighten($primary, 10%);
        }

        &.missing {
            border-color: transparent;
        }
    }
}

.word {
    color: $secondary-text;
    font-size: 12px;
}

.connecting-line {
    flex-grow: 1;
    height: 1px;
    background-color: #ededed;
    margin-left: 10px;
    margin-right: 10px;
    margin-top: 2px;

    .dark & {
        background-color: #333;
    }
}
</style>
