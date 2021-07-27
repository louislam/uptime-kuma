<template>
    <span class="badge rounded-pill" :class=" 'bg-' + color ">{{ text }}</span>
</template>

<script>
export default {
    props: {
        status: Number,
    },

    computed: {
        color() {
            if (this.status === 0) {
                return "danger"
            } if (this.status === 1) {
                return "primary"
            } if (this.status === 2) {
                return "warning"
            }
            return "secondary"

        },

        text() {
            if (this.status === 0) {
                return "Down"
            } if (this.status === 1) {
                return "Up"
            } if (this.status === 2) {
                return "Pending"
            }
            return "Unknown"

        },
    },
}
</script>

<style scoped>
    span {
        width: 54px;
    }
</style>
