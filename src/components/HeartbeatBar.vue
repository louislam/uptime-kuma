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

            // If heartbeat days is configured (not auto), check if data is already aggregated
            if (this.normalizedHeartbeatBarDays > 0) {
                // Check if the data is already aggregated from the server
                if (this.beatList.length > 0 && this.beatList[0]._aggregated) {
                    // Data is already aggregated from server, use it directly
                    // But still limit to maxBeat for display
                    if (this.beatList.length > this.maxBeat) {
                        return this.beatList.slice(this.beatList.length - this.maxBeat);
                    }
                    return this.beatList;
                } else {
                    // Fallback to client-side aggregation for edit mode
                    return this.aggregatedBeatList;
                }
            }

            // Original logic for auto mode (heartbeatBarDays = 0)
            let placeholders = [];

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

        aggregatedBeatList() {
            if (!this.beatList || this.beatList.length === 0) {
                return [];
            }

            // Always do client-side aggregation using fixed time buckets
            const now = dayjs();
            const buckets = [];

            // Use same logic as server-side: 100 buckets
            const targetBuckets = 100;
            const days = this.normalizedHeartbeatBarDays;
            const bucketSizeMinutes = Math.max(1, Math.floor((days * 24 * 60) / targetBuckets));

            // Create time buckets from oldest to newest
            const startTime = now.subtract(days, "day").startOf("minute");
            const endTime = now;
            
            for (let i = 0; i < targetBuckets; i++) {
                let bucketStart = startTime.add(i * bucketSizeMinutes, "minute");
                let bucketEnd = bucketStart.add(bucketSizeMinutes, "minute");

                // Don't create buckets that start after current time
                if (bucketStart.isAfter(endTime)) {
                    break;
                }

                // Ensure bucket doesn't extend beyond current time
                if (bucketEnd.isAfter(endTime)) {
                    bucketEnd = endTime;
                }

                buckets.push({
                    start: bucketStart,
                    end: bucketEnd,
                    beats: [],
                    status: null, // default to no data
                    time: bucketEnd.toISOString()
                });
            }

            // Group heartbeats into buckets
            this.beatList.forEach(beat => {
                const beatTime = dayjs.utc(beat.time).local();
                const bucket = buckets.find(b =>
                    beatTime.unix() >= b.start.unix() && beatTime.unix() < b.end.unix()
                );
                if (bucket) {
                    bucket.beats.push(beat);
                }
            });

            // Calculate status for each bucket
            buckets.forEach(bucket => {
                if (bucket.beats.length === 0) {
                    bucket.status = null; // no data - will be rendered as empty/grey
                } else {
                    // Priority: DOWN (0) > MAINTENANCE (3) > PENDING (2) > UP (1)
                    const hasDown = bucket.beats.some(b => b.status === 0);
                    const hasMaintenance = bucket.beats.some(b => b.status === 3);
                    const hasPending = bucket.beats.some(b => b.status === 2);

                    if (hasDown) {
                        bucket.status = 0;
                    } else if (hasMaintenance) {
                        bucket.status = 3;
                    } else if (hasPending) {
                        bucket.status = 2;
                    } else {
                        bucket.status = 1;
                    }

                    // Use the bucket end time for consistency
                    bucket.time = bucket.end.toISOString();
                }
            });

            // Ensure we always return targetBuckets number of items by padding at the start
            while (buckets.length < targetBuckets) {
                const firstStart = buckets.length > 0 ? buckets[0].start : now.subtract(days, "day");
                const paddedStart = firstStart.subtract(bucketSizeMinutes, "minute");
                const paddedEnd = firstStart;
                
                buckets.unshift({
                    start: paddedStart,
                    end: paddedEnd,
                    beats: [],
                    status: null,
                    time: paddedEnd.toISOString()
                });
            }

            // Limit to maxBeat for display
            if (buckets.length > this.maxBeat) {
                return buckets.slice(buckets.length - this.maxBeat);
            }

            return buckets;
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
            // For aggregated mode, don't use padding-based positioning
            if (this.normalizedHeartbeatBarDays > 0) {
                return {
                    "margin-left": "0px",
                };
            }

            // Original logic for auto mode
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
         * Get the title of the beat.
         * Used as the hover tooltip on the heartbeat bar.
         * @param {object} beat Beat to get title from
         * @returns {string} Beat title
         */
        getBeatTitle(beat) {
            if (beat === 0 || !beat) {
                return "";
            }

            // For client-side aggregated beats (edit mode)
            if (beat.beats !== undefined) {
                const start = this.$root.datetime(beat.start);
                const end = this.$root.datetime(beat.end);
                const statusText = beat.status === 1 ? "Up" : beat.status === 0 ? "Down" : beat.status === 3 ? "Maintenance" : "No Data";
                return `${start} - ${end}: ${statusText} (${beat.beats.length} checks)`;
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
