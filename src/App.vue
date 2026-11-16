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
import { markRaw } from "vue";
import { setPageLocale } from "./util-frontend";
import { polyfillCountryFlagEmojis } from "country-flag-emoji-polyfill";
import { DashboardProgress } from "./dashboard-progress";
export default {
    data() {
        return {
            showLoading: false,
            shownProgress: 0,
            progressController: markRaw(
                new DashboardProgress(() => {
                    this.showLoading = this.progressController.visible;
                    this.shownProgress = this.progressController.value;
                })
            ),
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
            this.progressController.update(value);
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
            this.progressController.update(this.progress);
        }
    },
    beforeUnmount() {
        this.progressController.clearTimers();
    },
    methods: {
        /**
         * Show a small progress step as soon as the dashboard route is reached
         * @returns {void}
         */
        markDashboardLoading() {
            // Logged-out sessions show the login page; the bar has nothing to wait for
            if (this.$root.loginRequired) {
                return;
            }
            const current = this.$root.dashboardLoadProgress || 0;
            const next = this.progressController.routeProgress(this.$route.path, current);
            if (next !== this.$root.dashboardLoadProgress) {
                this.$root.dashboardLoadProgress = next;
            }
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
