<template>
    <div class="wrap" :style="wrapStyle" ref="wrap">
        <div class="hp-bar-big" :style="barStyle">
            <div class="beat"  :style="beatStyle" v-for="(beat, index) in shortBeatList" :key="index">
            </div>
        </div>
    </div>
</template>

<script>


export default {
    data() {
        return {
            i: 1,
            beatList: [

            ],
            beatWidth: 10,
            beatHeight: 30,
            hoverScale: 1.5,
            beatMargin: 3,      // Odd number only, even = blurry
            move: false,
            maxBeat: -1,
        }
    },
    destroyed() {
        window.removeEventListener("resize", this.resize);
    },
    mounted() {
        window.addEventListener("resize", this.resize);
        this.resize();

        setInterval(() => {
            this.beatList.push(this.i++)
        }, 3000)

    },
    methods: {
        resize() {
            this.maxBeat = Math.floor(this.$refs.wrap.clientWidth / (this.beatWidth + this.beatMargin * 2))
        }
    },
    computed: {

        shortBeatList() {
            let start = this.beatList.length - this.maxBeat;

            if (this.move) {
                start = start - 1;
            }

            if (start < 0) {
                start = 0;
            }

            return this.beatList.slice(start)
        },

        wrapStyle() {
            let topBottom = (((this.beatHeight * this.hoverScale) - this.beatHeight) / 2);
            let leftRight = (((this.beatWidth * this.hoverScale) - this.beatWidth) / 2);

            let width
            if (this.maxBeat > 0) {
                width = (this.beatWidth + this.beatMargin * 2) * this.maxBeat + (leftRight * 2) + "px"
            } {
                width = "100%"
            }

            return {
                padding: `${topBottom}px ${leftRight}px`,
                width: width
            }
        },

        barStyle() {
            if (this.move && this.shortBeatList.length > this.maxBeat) {
                let width = -(this.beatWidth + this.beatMargin * 2);

                return {
                    transition: "all ease-in-out 0.25s",
                    transform: `translateX(${width}px)`,
                }

            } else {
                return {
                    transform: `translateX(0)`,
                }
            }
        },

        beatStyle() {
            return {
                width: this.beatWidth + "px",
                height: this.beatHeight + "px",
                margin: this.beatMargin + "px",
                "--hover-scale": this.hoverScale,
            }
        }

    },
    watch: {
        beatList: {
            handler(val, oldVal) {
                console.log("add beat2")
                this.move = true;

                setTimeout(() => {
                    this.move = false;
                }, 300)
            },
            deep: true,
        }
    }
}
</script>

<style scoped lang="scss">
@import "../assets/vars.scss";

.wrap {
    overflow: hidden;
    width: 100%;
    white-space: nowrap;
}

.hp-bar-big {
    .beat {
        display: inline-block;
        background-color: $primary;
        border-radius: 50rem;
        transition: all ease-in-out 0.15s;

        &.new-beat {
            background-color: aliceblue;
        }


        &:hover {
            opacity: 0.8;
            transform: scale(var(--hover-scale));
        }
    }
}

</style>
