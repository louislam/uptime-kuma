<template>
    <span>{{ displayText }}</span>
</template>

<script>
export default {
    props: {
        /** Value of date time */
        value: {
            type: String,
            default: null,
        },
        /** Should only the date be displayed? */
        dateOnly: {
            type: Boolean,
            default: false,
        },
    },

    computed: {
        displayText() {
            if (this.dateOnly) {
                return this.$root.date(this.value);
            } else {
                return this.$root.datetime(this.value);
            }
        },
    },
};
</script>
