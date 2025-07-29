<template>
    <span v-if="isNum" ref="output">{{ outputFixed }}</span> <span v-if="isNum">{{ unit }}</span>
    <span v-else>{{ value }}</span>
</template>

<script lang="ts">

import { sleep } from "../util.ts";

export default {

    props: {
        /** Value to count */
        value: {
            type: [ String, Number ],
            default: 0,
        },
        time: {
            type: Number,
            default: 0.3,
        },
        /** Unit of the value */
        unit: {
            type: String,
            default: "ms",
        },
    },

    data() {
        return {
            output: "",
            frameDuration: 30,
        };
    },

    computed: {
        isNum() {
            return typeof this.value === "number";
        },
        outputFixed() {
            if (typeof this.output === "number") {
                if (this.output < 1) {
                    return "<1";
                } else if (Number.isInteger(this.output)) {
                    return this.output;
                } else {
                    return this.output.toFixed(2);
                }
            } else {
                return this.output;
            }
        }
    },

    watch: {
        async value(from, to) {
            let diff = to - from;
            let frames = 12;
            let step = Math.floor(diff / frames);

            if (! (isNaN(step) || ! this.isNum || (diff > 0 && step < 1) || (diff < 0 && step > 1) || diff === 0)) {
                for (let i = 1; i < frames; i++) {
                    this.output += step;
                    await sleep(15);
                }
            }

            this.output = this.value;
        },
    },

    mounted() {
        this.output = this.value;
    },

    methods: {},

};
</script>
