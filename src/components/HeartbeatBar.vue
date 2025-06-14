<template>
    <div ref="wrap" class="wrap" :style="wrapStyle">
        <div class="hp-bar-big" :style="barStyle">
            <div
                v-for="(beat, index) in shortBeatList"
                :key="index"
                class="beat-hover-area"
                :class="{ 'empty': (beat === 0 || beat === null || beat.status === null) }"
                :style="beatHoverAreaStyle"
                :title="getBeatTitle(beat)"
            >
                <div
                    class="beat"
                    :class="{ 'empty': (beat === 0 || beat === null || beat.status === null), 'down': (beat.status === 0), 'pending': (beat.status === 2), 'maintenance': (beat.status === 3) }"
                    :style="beatStyle"
                />
            </div>
        </div>
        <div
            v-if="!$root.isMobile && size !== 'small' && shortBeatList.length > 4 && $root.styleElapsedTime !== 'none'"
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
        /** Array of the monitors heartbeats */
        heartbeatList: {
            type: Array,
            default: null,
        },
        /** Heartbeat bar days */
        heartbeatBarDays: {
            type: [ Number, String ],
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
        };
    },
    computed: {

        /**
         * Normalized heartbeatBarDays as a number
         * @returns {number} Number of days for heartbeat bar
         */
        normalizedHeartbeatBarDays() {
            const num = Number(this.heartbeatBarDays);
            return isNaN(num) ? 0 : Math.max(0, Math.min(365, Math.floor(num)));
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

            // If heartbeat days is configured (not auto), data should be aggregated from server
            if (this.normalizedHeartbeatBarDays > 0 && this.beatList.length > 0) {
                // Calculate how many beats can fit on screen with proper beat size
                const maxBeatsOnScreen = this.maxBeat > 0 ? this.maxBeat : 50; // fallback

                // If we have more beats than can fit, aggregate them client-side
                if (this.beatList.length > maxBeatsOnScreen) {
                    return this.aggregateBeats(this.beatList, maxBeatsOnScreen);
                }

                // Otherwise show all beats
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
            // For configured days mode, show the configured range
            if (this.normalizedHeartbeatBarDays > 0) {
                return this.normalizedHeartbeatBarDays < 2 ?
                    (this.normalizedHeartbeatBarDays * 24) + "h" :
                    this.normalizedHeartbeatBarDays + "d";
            }

            // For auto mode, calculate from actual data
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
                return this.$t("time ago", [ (seconds / 60).toFixed(0) + "m" ]);
            } else {
                return this.$t("time ago", [ (seconds / 60 / 60).toFixed(0) + "h" ]);
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
                this.maxBeat = Math.floor(this.$refs.wrap.clientWidth / (this.beatWidth + this.beatHoverAreaPadding * 2));
            }
        },

        /**
         * Aggregate beats to fit screen width while maintaining proper beat size
         * @param {Array} beats Array of beats to aggregate
         * @param {number} targetCount Target number of beats to display
         * @returns {Array} Aggregated beats array
         */
        aggregateBeats(beats, targetCount) {
            if (beats.length <= targetCount) {
                return beats;
            }

            const aggregated = [];
            const beatsPerBucket = beats.length / targetCount;

            for (let i = 0; i < targetCount; i++) {
                const startIdx = Math.floor(i * beatsPerBucket);
                const endIdx = Math.floor((i + 1) * beatsPerBucket);
                const bucketBeats = beats.slice(startIdx, endIdx);

                if (bucketBeats.length === 0) {
                    continue;
                }

                // Aggregate the beats in this bucket
                let aggregatedBeat = {
                    status: null,
                    time: bucketBeats[bucketBeats.length - 1].time, // Use end time
                    msg: "",
                    ping: null,
                    _aggregated: true,
                    _startTime: bucketBeats[0]._startTime || bucketBeats[0].time,
                    _endTime: bucketBeats[bucketBeats.length - 1]._endTime || bucketBeats[bucketBeats.length - 1].time,
                    _counts: {
                        up: 0,
                        down: 0,
                        maintenance: 0,
                        pending: 0
                    }
                };

                // Sum up counts from all beats in bucket
                for (const beat of bucketBeats) {
                    if (beat && beat._counts) {
                        aggregatedBeat._counts.up += beat._counts.up || 0;
                        aggregatedBeat._counts.down += beat._counts.down || 0;
                        aggregatedBeat._counts.maintenance += beat._counts.maintenance || 0;
                        aggregatedBeat._counts.pending += beat._counts.pending || 0;
                    } else if (beat && beat.status !== null) {
                        // Handle non-aggregated beats
                        if (beat.status === 1) {
                            aggregatedBeat._counts.up += 1;
                        } else if (beat.status === 0) {
                            aggregatedBeat._counts.down += 1;
                        } else if (beat.status === 3) {
                            aggregatedBeat._counts.maintenance += 1;
                        } else if (beat.status === 2) {
                            aggregatedBeat._counts.pending += 1;
                        }
                    }
                }

                // Determine aggregated status (priority: DOWN > MAINTENANCE > PENDING > UP)
                const counts = aggregatedBeat._counts;
                if (counts.down > 0) {
                    aggregatedBeat.status = 0; // DOWN
                } else if (counts.maintenance > 0) {
                    aggregatedBeat.status = 3; // MAINTENANCE
                } else if (counts.pending > 0) {
                    aggregatedBeat.status = 2; // PENDING
                } else if (counts.up > 0) {
                    aggregatedBeat.status = 1; // UP
                } else {
                    aggregatedBeat.status = null; // No data
                }

                aggregated.push(aggregatedBeat);
            }

            return aggregated;
        },

        /**
         * Get the title of the beat.
         * Used as the hover tooltip on the heartbeat bar.
         * @param {object} beat Beat to get title from
         * @returns {string} Beat title
         */
        getBeatTitle(beat) {
            if (beat === 0 || !beat) {
                return "";
            }

            // For server-side aggregated beats
            if (beat._aggregated && beat._counts) {
                const counts = beat._counts;
                const total = counts.up + counts.down + counts.maintenance + counts.pending;

                // Use start time for display if available
                const displayTime = beat._startTime ? beat._startTime : beat.time;

                if (total === 0) {
                    return `${this.$root.datetime(displayTime)}: No Data`;
                }

                let statusText = "";
                if (counts.down > 0) {
                    statusText = "Down";
                } else if (counts.maintenance > 0) {
                    statusText = "Maintenance";
                } else if (counts.pending > 0) {
                    statusText = "Pending";
                } else if (counts.up > 0) {
                    statusText = "Up";
                }

                return `${this.$root.datetime(displayTime)}: ${statusText} (${total} checks)`;
            }

            // For individual beats, show timestamp
            return `${this.$root.datetime(beat.time)}${beat.msg ? ` - ${beat.msg}` : ""}`;
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
