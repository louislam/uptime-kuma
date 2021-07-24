<template>
    <span class="badge rounded-pill" :class=" 'bg-' + color ">{{ text }}</span>
</template>

<script>
export default {
    props: {
        status: Number
    },

    computed: {
        color() {
            if (this.status === 0) {
                return "danger"
            } else if (this.status === 1) {
                return "primary"
            } else if (this.status === 2) {
                return "warning"
            } else {
                return "secondary"
            }
        },

        text() {
            if (this.status === 0) {
                return "Down"
            } else if (this.status === 1) {
                return "Up"
            } else if (this.status === 2) {
                return "Pending"
            } else {
                return "Unknown"
            }
        },
    }
}
</script>

<style scoped>
    span {
        width: 54px;
    }
</style>
