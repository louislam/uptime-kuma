<template>
    <transition name="fade">
        <div v-if="showLoading" class="app-loading" aria-hidden="true">
            <div class="app-loading-track">
                <div class="app-loading-fill" :style="{ width: shownProgress + '%' }"></div>
            </div>
        </div>
    </transition>
    <router-view />
</template>

<script>
import { setPageLocale } from "./util-frontend";
import { polyfillCountryFlagEmojis } from "country-flag-emoji-polyfill";
export default {
    data() {
        return {
            showLoading: false,
            showTimer: null,
            finishTimer: null,
            safetyTimer: null,
            creepTimer: null,
            shownProgress: 0,
        };
    },
    computed: {
        /**
         * Dashboard data loading progress (0-100)
         * @returns {number} Progress
         */
        progress() {
            return this.$root.dashboardLoadProgress || 0;
        },
    },
    watch: {
        progress(value) {
            this.onProgress(value);
        },
        "$route.path"() {
            this.markDashboardLoading();
        },
    },
    created() {
        setPageLocale();
    },
    mounted() {
        this.markDashboardLoading();
        if (this.progress > 0) {
            this.onProgress(this.progress);
        }
    },
    beforeUnmount() {
        this.clearTimers();
    },
    methods: {
        /**
         * Show a small progress step as soon as the dashboard route is reached
         * @returns {void}
         */
        markDashboardLoading() {
            if (this.$route.path.startsWith("/dashboard") && !this.$root.dashboardLoadProgress) {
                this.$root.dashboardLoadProgress = 8;
            }
        },
        /**
         * React to a real progress update from the socket events
         * @param {number} value Progress 0-100
         * @returns {void}
         */
        onProgress(value) {
            if (value >= 100) {
                this.finishLoading();
                return;
            }
            if (value <= 0) {
                this.clearTimers();
                this.showLoading = false;
                this.shownProgress = 0;
                return;
            }
            this.shownProgress = Math.max(this.shownProgress, value);
            if (!this.showLoading) {
                clearTimeout(this.showTimer);
                this.showTimer = setTimeout(() => {
                    this.showLoading = true;
                    this.startCreep();
                    // Never let the overlay outlive a stalled/broken connection
                    clearTimeout(this.safetyTimer);
                    this.safetyTimer = setTimeout(() => {
                        this.showLoading = false;
                    }, 15000);
                }, 150);
            }
        },
        /**
         * Creep toward 90% while waiting, so the bar keeps moving even when
         * the server is still working and no phase update arrived.
         * @returns {void}
         */
        startCreep() {
            clearInterval(this.creepTimer);
            this.creepTimer = setInterval(() => {
                if (this.shownProgress < 90) {
                    const step = Math.max(0.4, (90 - this.shownProgress) * 0.03);
                    this.shownProgress = Math.min(90, this.shownProgress + step);
                }
            }, 100);
        },
        /**
         * Fill the bar, then hide it shortly after
         * @returns {void}
         */
        finishLoading() {
            this.clearTimers();
            this.shownProgress = 100;
            this.finishTimer = setTimeout(() => {
                this.showLoading = false;
            }, 250);
        },
        /**
         * Clear all pending timers
         * @returns {void}
         */
        clearTimers() {
            clearTimeout(this.showTimer);
            clearTimeout(this.finishTimer);
            clearTimeout(this.safetyTimer);
            clearInterval(this.creepTimer);
        },
    },
};
polyfillCountryFlagEmojis();
</script>

<style lang="scss" scoped>
@import "./assets/vars.scss";

.app-loading {
    position: fixed;
    inset: 0;
    z-index: 1500;
    display: flex;
    align-items: center;
    justify-content: center;
    padding-top: 56px;
    pointer-events: none;
}

.app-loading-track {
    width: 240px;
    max-width: 60vw;
    height: 6px;
    border-radius: 3px;
    background-color: rgba(128, 128, 128, 0.25);
    overflow: hidden;
}

.app-loading-fill {
    height: 100%;
    background-color: $primary;
    border-radius: 3px;
    transition: width 0.2s linear;
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
