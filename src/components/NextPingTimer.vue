<template>
    <span class="word">&nbsp;({{ $t("nextCheckIn") }}: {{ formattedTime }})</span>
</template>

<script>

export default {
    props: {
        /** Time remaining in seconds */
        timeRemaining: {
            type: Number,
            required: true,
        },
    },
    computed: {
        /**
         * Formatted time remaining
         * @returns {string} Formatted time
         */
        formattedTime() {
            const days = Math.floor(this.timeRemaining / 86400);
            const hours = Math.floor((this.timeRemaining % 86400) / 3600);
            const minutes = Math.floor((this.timeRemaining % 3600) / 60);
            const seconds = this.timeRemaining % 60;

            let formattedTime = "";
            if (seconds >= 0) {
                formattedTime = seconds > 1 ? `${seconds}secs` : `${seconds}sec`;
            }
            if (minutes > 0) {
                formattedTime = minutes > 1 ? `~ ${minutes}mins` : `~ ${minutes}min`;
            }
            if (hours > 0) {
                formattedTime = hours > 1 ? `~ ${hours}hrs` : `~ ${hours}hr`;
            }
            if (days > 0) {
                formattedTime = days > 1 ? `~ ${days}days` : `~ ${days}day`;
            }

            return formattedTime.trim();
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.word {
    color: $secondary-text;
    font-size: 12px;
}

</style>
