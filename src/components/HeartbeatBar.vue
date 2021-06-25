<template>
    <div class="wrap" :style="wrapStyle">
        <div class="hp-bar-big" :style="barStyle">
            <div class="beat" :style="beatStyle" v-for="beat in beatList"></div>
        </div>
    </div>
</template>

<script>


export default {
    data() {
        return {
            beatList: [
                1,2,3,4,5
            ],
            beatWidth: 10,
            beatHeight: 30,
            hoverScale: 1.5,
            beatMargin: 4,
            move: false,
            maxBeat: 5,
        }
    },
    mounted() {
        setInterval(() => {

            this.addBeat()
            console.log("add beat")
        }, 3000)

    },
    methods: {
        async addBeat() {
            this.move = true;

            setTimeout(() => {
                this.beatList.push(6)

                if (this.beatList.length > this.maxBeat) {
                    this.beatList.shift();
                    this.move = false;
                }
            }, 300)

        }
    },
    computed: {
        wrapStyle() {
            let topBottom = (((this.beatHeight * this.hoverScale) - this.beatHeight) / 2);
            let leftRight = (((this.beatWidth * this.hoverScale) - this.beatWidth) / 2);

            return {
                padding: `${topBottom}px ${leftRight}px`,
                width: (this.beatWidth + this.beatMargin * 2) * this.maxBeat + (leftRight * 2) + "px"
            }
        },
        barStyle() {
            if (this.move) {
                let width = -(this.beatWidth + this.beatMargin * 2);

                return  {
                    transition: "all ease-in-out 0.25s",
                    transform: `translateX(${width}px)`,
                }
            } else {
                return {

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
    }
}
</script>

<style scoped lang="scss">
@import "../assets/vars.scss";

.wrap {
    overflow: hidden;
    width: 100px;

    white-space: nowrap;
}

.hp-bar-big {
    .beat {
        display: inline-block;
        background-color: $primary;
        border-radius: 50rem;
        transition: all ease-in-out 0.15s;


        &:hover {
            opacity: 0.8;
            transform: scale(var(--hover-scale));
        }
    }
}

</style>
