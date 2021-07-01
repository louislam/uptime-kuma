<template>
    <span v-if="isNum" ref="output">{{ output }}</span> <span v-if="isNum">{{ unit }}</span>
    <span v-else>{{ value }}</span>
</template>

<script>

import {sleep} from "../../server/util";

export default {

    props: {
        value: [String, Number],
        time: {
            Number,
            default: 0.3,
        },
        unit: {
            String,
            default: "ms",
        }
    },

    mounted() {
        this.output = this.value;
    },

    data() {
        return {
            output: "",
            frameDuration: 30,
        }
    },

    methods: {

    },

    computed: {
        isNum() {
            return typeof this.value === 'number'
        }
    },

    watch: {
        async value(from, to) {
            let diff = to - from;
            let frames = 12;
            let step = Math.floor(diff / frames);

            if (! this.isNum || (diff > 0 && step < 1) || (diff < 0 && step > 1) || diff === 0) {
                // Lazy to NOT this condition, hahaha.
            } else {
                for (let i = 1; i < frames; i++) {
                    this.output += step;
                    await sleep(15)
                }
            }

            this.output = this.value;
        },
    },

}
</script>

<style scoped>

</style>
