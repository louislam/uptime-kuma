<template>
    <div ref="wrap" class="wrap" :style="wrapStyle">
        <div class="hp-bar-big" :style="barStyle">
            <div
                v-for="(beat, index) in shortBeatList"
                :key="index"
                class="beat-hover-area"
                :class="{ 'empty': (beat === 0) }"
                :style="beatHoverAreaStyle"
                :aria-label="getBeatAriaLabel(beat)"
                role="status"
                tabindex="0"
                @mouseenter="showTooltip(beat, $event)"
                @mouseleave="hideTooltip"
                @focus="showTooltip(beat, $event)"
                @blur="hideTooltip"
            >
                <div
                    class="beat"
                    :class="getBeatClasses(beat)"
                    :style="beatStyle"
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

        <!-- Custom Tooltip -->
        <Tooltip
            :visible="tooltipVisible"
            :content="tooltipContent"
            :x="tooltipX"
            :y="tooltipY"
            :position="tooltipPosition"
        />
    </div>
</template>

<script>
import dayjs from "dayjs";
import { DOWN, UP, PENDING, MAINTENANCE } from "../util.ts";
import Tooltip from "./Tooltip.vue";

export default {
    components: {
        Tooltip,
    },
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
        /** Array of the monitors heartbeats */
        heartbeatList: {
            type: Array,
            default: null,
        },
        /** Heartbeat bar days */
        heartbeatBarDays: {
            type: Number,
            default: 0
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
            // Tooltip data
            tooltipVisible: false,
            tooltipContent: null,
            tooltipX: 0,
            tooltipY: 0,
            tooltipPosition: "below",
            tooltipTimeoutId: null,
        };
    },
    computed: {

        /**
         * Normalized heartbeatBarDays as a number
         * @returns {number} Number of days for heartbeat bar
         */
        normalizedHeartbeatBarDays() {
            return Math.max(0, Math.min(365, Math.floor(this.heartbeatBarDays || 0)));
        },

        /**
         * If heartbeatList is null, get it from $root.heartbeatList
         * @returns {object} Heartbeat list
         */
        beatList() {
            if (this.heartbeatList === null) {
                return this.$root.heartbeatList[this.monitorId];
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

            // For configured ranges, no padding needed since we show all beats
            if (this.normalizedHeartbeatBarDays > 0) {
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
            if (!this.beatList) {
                return [];
            }

            // If heartbeat days is configured (not auto), data is already aggregated from server
            if (this.normalizedHeartbeatBarDays > 0 && this.beatList.length > 0) {
                // Show all beats from server - they are already properly aggregated
                return this.beatList;
            }

            // Original logic for auto mode (heartbeatBarDays = 0)
            let placeholders = [];

            // Handle case where maxBeat is -1 (no limit)
            if (this.maxBeat <= 0) {
                return this.beatList;
            }

            let start = this.beatList.length - this.maxBeat;

            if (this.move) {
                start = start - 1;
            }

            if (start < 0) {
                // Add empty placeholder
                for (let i = start; i < 0; i++) {
                    placeholders.push(0);
                }
                start = 0;
            }

            return placeholders.concat(this.beatList.slice(start));
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
         * @returns {string} The time elapsed in minutes or hours.
         */
        timeSinceFirstBeat() {
            if (this.normalizedHeartbeatBarDays === 1) {
                return (this.normalizedHeartbeatBarDays * 24) + "h";
            }
            if (this.normalizedHeartbeatBarDays >= 2) {
                return this.normalizedHeartbeatBarDays + "d";
            }

            // Need to calculate from actual data
            const firstValidBeat = this.shortBeatList.at(this.numPadding);
            const minutes = dayjs().diff(dayjs.utc(firstValidBeat?.time), "minutes");
            return minutes > 60 ? Math.floor(minutes / 60) + "h" : minutes + "m";
        },

        /**
         * Calculates the elapsed time since the last valid beat was registered.
         * @returns {string} The elapsed time in a minutes, hours or "now".
         */
        timeSinceLastBeat() {
            const lastValidBeat = this.shortBeatList.at(-1);
            const seconds = dayjs().diff(dayjs.utc(lastValidBeat?.time), "seconds");

            let tolerance = 60 * 2; // default for when monitorList not available
            if (this.$root.monitorList[this.monitorId] != null) {
                tolerance = this.$root.monitorList[this.monitorId].interval * 2;
            }

            if (seconds < tolerance) {
                return this.$t("now");
            } else if (seconds < 60 * 60) {
                return this.$t("time ago", [ (seconds / 60).toFixed(0) + "m" ] );
            } else {
                return this.$t("time ago", [ (seconds / 60 / 60).toFixed(0) + "h" ] );
            }
        }
    },
    watch: {
        beatList: {
            handler() {
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
        // Clean up tooltip timeout
        if (this.tooltipTimeoutId) {
            clearTimeout(this.tooltipTimeoutId);
        }
    },
    beforeMount() {
        if (this.heartbeatList === null) {
            if (!(this.monitorId in this.$root.heartbeatList)) {
                this.$root.heartbeatList[this.monitorId] = [];
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
                const newMaxBeat = Math.floor(this.$refs.wrap.clientWidth / (this.beatWidth + this.beatHoverAreaPadding * 2));

                // If maxBeat changed and we're in configured days mode, notify parent to reload data
                if (newMaxBeat !== this.maxBeat && this.normalizedHeartbeatBarDays > 0) {
                    this.maxBeat = newMaxBeat;

                    // Find the closest parent with reloadHeartbeatData method (StatusPage)
                    let parent = this.$parent;
                    while (parent && !parent.reloadHeartbeatData) {
                        parent = parent.$parent;
                    }
                    if (parent && parent.reloadHeartbeatData) {
                        parent.reloadHeartbeatData(newMaxBeat);
                    }
                } else {
                    this.maxBeat = newMaxBeat;
                }
            }
        },

        /**
         * Get the title of the beat.
         * Used as the hover tooltip on the heartbeat bar.
         * @param {object} beat Beat to get title from
         * @returns {string} Beat title
         */
        getBeatTitle(beat) {
            if (!beat) {
                return "";
            }

            // Show timestamp for all beats (both individual and aggregated)
            return `${this.$root.datetime(beat.time)}${beat.msg ? ` - ${beat.msg}` : ""}`;
        },

        /**
         * Get CSS classes for a beat element based on its status
         * @param {object} beat - Beat object containing status information
         * @returns {object} Object with CSS class names as keys and boolean values
         */
        getBeatClasses(beat) {
            if (beat === 0 || beat === null || beat?.status === null) {
                return { empty: true };
            }

            const status = Number(beat.status);

            return {
                down: status === DOWN,
                pending: status === PENDING,
                maintenance: status === MAINTENANCE
            };
        },

        /**
         * Get the aria-label for accessibility
         * @param {object} beat Beat to get aria-label from
         * @returns {string} Aria label
         */
        getBeatAriaLabel(beat) {
            switch (beat?.status) {
                case DOWN:
                    return `Down at ${this.$root.datetime(beat.time)}`;
                case UP:
                    return `Up at ${this.$root.datetime(beat.time)}`;
                case PENDING:
                    return `Pending at ${this.$root.datetime(beat.time)}`;
                case MAINTENANCE:
                    return `Maintenance at ${this.$root.datetime(beat.time)}`;
                default:
                    return "No data";
            }
        },

        /**
         * Show custom tooltip
         * @param {object} beat Beat data
         * @param {Event} event Mouse event
         * @returns {void}
         */
        showTooltip(beat, event) {
            if (beat === 0 || !beat) {
                this.hideTooltip();
                return;
            }

            // Clear any existing timeout
            if (this.tooltipTimeoutId) {
                clearTimeout(this.tooltipTimeoutId);
            }

            // Small delay for better UX
            this.tooltipTimeoutId = setTimeout(() => {
                this.tooltipContent = beat;

                // Calculate position relative to viewport
                const rect = event.target.getBoundingClientRect();

                // Position relative to viewport
                const x = rect.left + (rect.width / 2);
                const y = rect.top;

                // Check if tooltip would go off-screen and adjust position
                const tooltipHeight = 80; // Approximate tooltip height
                const viewportHeight = window.innerHeight;
                const spaceAbove = y;
                const spaceBelow = viewportHeight - y - rect.height;

                if (spaceAbove > tooltipHeight && spaceBelow < tooltipHeight) {
                    // Show above - arrow points down
                    this.tooltipPosition = "above";
                    this.tooltipY = y - 10;
                } else {
                    // Show below - arrow points up
                    this.tooltipPosition = "below";
                    this.tooltipY = y + rect.height + 10;
                }

                // Ensure tooltip doesn't go off the left or right edge
                const tooltipWidth = 120; // Approximate tooltip width
                let adjustedX = x;

                if ((x - tooltipWidth / 2) < 10) {
                    adjustedX = tooltipWidth / 2 + 10;
                } else if ((x + tooltipWidth / 2) > (window.innerWidth - 10)) {
                    adjustedX = window.innerWidth - tooltipWidth / 2 - 10;
                }

                this.tooltipX = adjustedX;
                this.tooltipVisible = true;
            }, 150);
        },

        /**
         * Hide custom tooltip
         * @returns {void}
         */
        hideTooltip() {
            if (this.tooltipTimeoutId) {
                clearTimeout(this.tooltipTimeoutId);
                this.tooltipTimeoutId = null;
            }

            this.tooltipVisible = false;
            this.tooltipContent = null;
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

            &.down {
                background-color: $danger;
            }

            &.pending {
                background-color: $warning;
            }

            &.maintenance {
                background-color: $maintenance;
            }
        }
    }
}

.dark {
    .hp-bar-big .beat.empty {
        background-color: #848484;
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
