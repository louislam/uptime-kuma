<template>
    <div ref="wrap" class="wrap" :style="wrapStyle">
        <div class="hp-bar-big d-flex" :style="barStyle">
            <div
                v-for="(beat, index) in shortBeatList"
                :key="index"
                class="beat"
                :class="{ 'empty' : (beat === 0), 'down' : (beat.status === 0), 'pending' : (beat.status === 2) }"
                :style="beatStyle"
                :title="getBeatTitle(beat)"
                @mouseenter="toggleActivateSibling"
                @mouseleave="toggleActivateSibling"
            >
                <div class="beat-inner" />
            </div>
        </div>
    </div>
</template>

<script>

export default {
    props: {
        size: {
            type: String,
            default: "big",
        },
        monitorId: {
            type: Number,
            required: true,
        },
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
            beatMargin: 4,
            move: false,
            maxBeat: -1,
        };
    },
    computed: {

        /**
         * If heartbeatList is null, get it from $root.heartbeatList
         */
        beatList() {
            if (this.heartbeatList === null) {
                return this.$root.heartbeatList[this.monitorId];
            } else {
                return this.heartbeatList;
            }
        },

        shortBeatList() {
            if (! this.beatList) {
                return [];
            }

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
                let width = -(this.beatWidth + this.beatMargin * 2);

                return {
                    transition: "all ease-in-out 0.25s",
                    transform: `translateX(${width}px)`,
                };

            }
            return {
                transform: "translateX(0)",
            };

        },

        beatStyle() {
            return {
                width: this.beatWidth + "px",
                height: this.beatHeight + "px",
                margin: this.beatMargin + "px",
                "--hover-scale": this.hoverScale,
            };
        },

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
            if (! (this.monitorId in this.$root.heartbeatList)) {
                this.$root.heartbeatList[this.monitorId] = [];
            }
        }
    },

    mounted() {
        if (this.size === "small") {
            this.beatWidth = 5;
            this.beatHeight = 16;
            this.beatMargin = 2;
        }

        // Suddenly, have an idea how to handle it universally.
        // If the pixel * ratio != Integer, then it causes render issue, round it to solve it!!
        const actualWidth = this.beatWidth * window.devicePixelRatio;
        const actualMargin = this.beatMargin * window.devicePixelRatio;

        if (! Number.isInteger(actualWidth)) {
            this.beatWidth = Math.round(actualWidth) / window.devicePixelRatio;
        }

        if (! Number.isInteger(actualMargin)) {
            this.beatMargin = Math.round(actualMargin) / window.devicePixelRatio;
        }

        window.addEventListener("resize", this.resize);
        this.resize();
    },
    methods: {
        resize() {
            if (this.$refs.wrap) {
                this.maxBeat = Math.floor(this.$refs.wrap.clientWidth / (this.beatWidth + this.beatMargin * 2));
            }
        },

        getBeatTitle(beat) {
            return `${this.$root.datetime(beat.time)}` + ((beat.msg) ? ` - ${beat.msg}` : "");
        },

        // Toggling the activeSibling class on hover over the current hover item
        toggleActivateSibling(e) {
            // Variable definition
            const element = e.target;
            const previous = element.previousSibling;
            const next = element.nextSibling;

            // Return if the hovered element has empty class
            if (element.classList.contains("empty")) {
                return;
            }

            // Check if Previous Sibling is heartbar element and doesn't have the empty class
            if (previous.children && !previous.classList.contains("empty")) {
                previous.classList.toggle("active-sibling");
            }

            // Check if Next Sibling is heartbar element and doesn't have the empty class
            if (next.children && !next.classList.contains("empty")) {
                next.classList.toggle("active-sibling");
            }
        }
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
    .beat {
        background-color: $primary;
        border-radius: $border-radius;
        display: inline-block;
        transition: all ease 0.6s;

        &.empty {
            background-color: aliceblue;
        }

        &.down {
            background-color: $danger;
        }

        &.pending {
            background-color: $warning;
        }

        .beat-inner {
            border-radius: $border-radius;
            display: inline-block;
            height: 100%;
            width: 5px;
        }

        &:not(.empty):hover {
            transition: all ease 0.15s;
            opacity: 0.8;
            transform: scale(var(--hover-scale));
        }

        &.active-sibling {
            transform: scale(1.15);
            transition: all ease 0.15s;
        }
    }
}

.dark {
    .hp-bar-big .beat.empty {
        background-color: #848484;
    }
}

</style>
