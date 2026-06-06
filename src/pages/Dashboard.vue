<template>
    <div class="container-fluid dashboard-container">
        <div ref="dashboardShell" class="dashboard-shell">
            <aside v-if="!$root.isMobile" class="dashboard-sidebar" :style="sidebarStyle">
                <div v-if="canWriteMonitors">
                    <router-link to="/add" class="btn btn-primary add-monitor-btn mb-2">
                        <font-awesome-icon icon="plus" />
                        {{ $t("Add New Monitor") }}
                    </router-link>
                </div>
                <MonitorList :scrollbar="true" :use-page-scroll="true" />
            </aside>

            <div
                v-if="!$root.isMobile"
                class="dashboard-sidebar-resizer"
                :class="{ resizing: isSidebarResizing }"
                role="separator"
                aria-label="Resize monitor sidebar"
                aria-orientation="vertical"
                tabindex="0"
                title="Resize monitor sidebar"
                @keydown="onSidebarResizeKeydown"
                @pointerdown="startSidebarResize"
            ></div>

            <section ref="container" class="dashboard-content mb-2">
                <!-- Add :key to disable vue router re-use the same component -->
                <router-view :key="$route.fullPath" :calculatedHeight="height" />
            </section>
        </div>
    </div>
</template>

<script>
import MonitorList from "../components/MonitorList.vue";

const SIDEBAR_WIDTH_STORAGE_KEY = "dashboardSidebarWidth";
const SIDEBAR_WIDTH_DEFAULT = 440;
const SIDEBAR_WIDTH_MIN = 340;
const SIDEBAR_WIDTH_MAX = 760;
const CONTENT_MIN_WIDTH = 460;

/**
 * Keep the dashboard sidebar inside usable desktop bounds.
 * @param {number} width Requested sidebar width.
 * @param {number} containerWidth Available dashboard shell width.
 * @returns {number} Clamped sidebar width.
 */
function clampSidebarWidth(width, containerWidth = window.innerWidth) {
    const maxWidth = Math.max(SIDEBAR_WIDTH_MIN, Math.min(SIDEBAR_WIDTH_MAX, containerWidth - CONTENT_MIN_WIDTH));

    return Math.min(maxWidth, Math.max(SIDEBAR_WIDTH_MIN, width));
}

/**
 * Read the persisted dashboard sidebar width.
 * @returns {number} Initial dashboard sidebar width.
 */
function getInitialSidebarWidth() {
    const value = parseInt(window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY), 10);

    if (Number.isNaN(value)) {
        return SIDEBAR_WIDTH_DEFAULT;
    }

    return clampSidebarWidth(value);
}

export default {
    components: {
        MonitorList,
    },
    data() {
        return {
            height: 0,
            sidebarWidth: getInitialSidebarWidth(),
            isSidebarResizing: false,
            previousBodyCursor: "",
            previousBodyUserSelect: "",
        };
    },
    computed: {
        sidebarStyle() {
            return {
                width: `${this.sidebarWidth}px`,
            };
        },
        canWriteMonitors() {
            return this.$root.hasPermission("monitors.write");
        },
    },
    mounted() {
        this.updateDashboardMeasurements();
        window.addEventListener("resize", this.updateDashboardMeasurements);
    },
    beforeUnmount() {
        window.removeEventListener("resize", this.updateDashboardMeasurements);
        this.stopSidebarResize();
    },
    methods: {
        updateDashboardMeasurements() {
            this.height = this.$refs.container?.offsetHeight || 0;

            if (this.$refs.dashboardShell) {
                this.sidebarWidth = clampSidebarWidth(this.sidebarWidth, this.$refs.dashboardShell.offsetWidth);
            }
        },
        startSidebarResize(event) {
            if (event.button != null && event.button !== 0) {
                return;
            }

            event.preventDefault();
            this.isSidebarResizing = true;
            this.previousBodyCursor = document.body.style.cursor;
            this.previousBodyUserSelect = document.body.style.userSelect;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
            this.resizeSidebarFromPointer(event.clientX);
            window.addEventListener("pointermove", this.onSidebarResize);
            window.addEventListener("pointerup", this.stopSidebarResize);
            window.addEventListener("pointercancel", this.stopSidebarResize);
        },
        onSidebarResize(event) {
            this.resizeSidebarFromPointer(event.clientX);
        },
        resizeSidebarFromPointer(clientX) {
            if (!this.$refs.dashboardShell) {
                return;
            }

            const shellRect = this.$refs.dashboardShell.getBoundingClientRect();
            this.sidebarWidth = clampSidebarWidth(clientX - shellRect.left, shellRect.width);
            window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(this.sidebarWidth));
            window.dispatchEvent(new Event("resize"));
        },
        stopSidebarResize() {
            if (this.isSidebarResizing) {
                this.isSidebarResizing = false;
                document.body.style.cursor = this.previousBodyCursor;
                document.body.style.userSelect = this.previousBodyUserSelect;
            }

            window.removeEventListener("pointermove", this.onSidebarResize);
            window.removeEventListener("pointerup", this.stopSidebarResize);
            window.removeEventListener("pointercancel", this.stopSidebarResize);
        },
        onSidebarResizeKeydown(event) {
            let nextWidth = this.sidebarWidth;

            if (event.key === "ArrowLeft") {
                nextWidth -= 24;
            } else if (event.key === "ArrowRight") {
                nextWidth += 24;
            } else if (event.key === "Home") {
                nextWidth = SIDEBAR_WIDTH_MIN;
            } else if (event.key === "End") {
                nextWidth = SIDEBAR_WIDTH_MAX;
            } else {
                return;
            }

            event.preventDefault();
            const containerWidth = this.$refs.dashboardShell?.offsetWidth || window.innerWidth;
            this.sidebarWidth = clampSidebarWidth(nextWidth, containerWidth);
            window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(this.sidebarWidth));
            window.dispatchEvent(new Event("resize"));
        },
    },
};
</script>

<style lang="scss" scoped>
.container-fluid {
    width: 99%;
}

.dashboard-container {
    overflow-x: clip;
}

.dashboard-shell {
    display: flex;
    align-items: stretch;
    width: 100%;
    min-width: 0;
}

.dashboard-sidebar {
    display: flex;
    flex-direction: column;
    flex: 0 0 auto;
    min-width: 0;
    padding-left: 0;
    padding-right: 8px;
}

.add-monitor-btn {
    padding-left: 16px;
    padding-right: 16px;
}

.dashboard-content {
    flex: 1 1 auto;
    min-width: 0;
}

.dashboard-sidebar-resizer {
    position: sticky;
    top: 8px;
    flex: 0 0 12px;
    align-self: stretch;
    height: calc(100vh - 134px);
    margin-right: 8px;
    cursor: col-resize;
    touch-action: none;
    outline: 0;

    &::before {
        content: "";
        display: block;
        width: 3px;
        height: 100%;
        margin: 0 auto;
        border-radius: 999px;
        background: rgba(108, 117, 125, 0.35);
        transition:
            background-color 0.15s ease,
            width 0.15s ease;
    }

    &:hover::before,
    &:focus-visible::before,
    &.resizing::before {
        width: 5px;
        background: #5cdd8b;
    }
}
</style>
