<template>
    <div class="refresh-info mb-2">
        <div>{{ $t("lastUpdatedAt", { date: lastUpdateTimeDisplay }) }}</div>
        <div v-if="showCountdown" data-testid="update-countdown-text">
            {{ $t("statusPageRefreshIn", [updateCountdownText]) }}
        </div>
    </div>
</template>

<script>
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);

export default {
    name: "StatusPageRefreshInfo",
    props: {
        lastUpdateTime: {
            type: Object,
            required: true,
        },
        autoRefreshInterval: {
            type: Number,
            required: true,
        },
        showCountdown: {
            type: Boolean,
            default: true,
        },
    },
    data() {
        return {
            updateCountdown: null,
            updateCountdownText: null,
        };
    },
    computed: {
        lastUpdateTimeDisplay() {
            return this.$root.datetime(this.lastUpdateTime);
        },
    },
    watch: {
        lastUpdateTime() {
            this.startUpdateTimer();
        },
        autoRefreshInterval() {
            this.startUpdateTimer();
        },
        showCountdown() {
            this.startUpdateTimer();
        },
    },
    mounted() {
        this.startUpdateTimer();
    },
    unmounted() {
        clearInterval(this.updateCountdown);
    },
    methods: {
        startUpdateTimer() {
            clearInterval(this.updateCountdown);

            if (!this.showCountdown) {
                this.updateCountdownText = null;
                return;
            }

            this.updateCountdown = setInterval(() => {
                const countdown = dayjs.duration(
                    Math.round(
                        this.lastUpdateTime.add(Math.max(5, this.autoRefreshInterval), "seconds").diff(dayjs()) / 1000
                    ),
                    "seconds"
                );

                if (countdown.as("seconds") < 0) {
                    clearInterval(this.updateCountdown);
                } else {
                    this.updateCountdownText = countdown.format("mm:ss");
                }
            }, 1000);
        },
    },
};
</script>

<style scoped>
.refresh-info {
    opacity: 0.7;
}
</style>
