<template>
    <div :class="classes">
        <div v-if="!$root.socket.connected && !$root.socket.firstConnect" class="lost-connection">
            <div class="container-fluid">
                {{ $root.connectionErrorMsg }}
                <div v-if="$root.showReverseProxyGuide">
                    {{ $t("Using a Reverse Proxy?") }}
                    <a href="https://github.com/louislam/uptime-kuma/wiki/Reverse-Proxy" target="_blank">
                        {{ $t("Check how to config it for WebSocket") }}
                    </a>
                </div>
            </div>
        </div>

        <div :class="{ 'kn-shell': showSidebar }">
            <!-- Desktop sidebar -->
            <aside v-if="showSidebar" class="kn-sidebar app-sidebar">
                <router-link to="/dashboard" class="kn-brand app-brand">
                    <BrandMark />
                    {{ $t("Status") }}
                </router-link>

                <nav class="kn-nav" :aria-label="$t('Status')">
                    <router-link to="/dashboard" :class="{ 'is-active': isDashboardRoute }">
                        {{ $t("Dashboard") }}
                    </router-link>
                    <router-link to="/manage-status-page" :class="{ 'is-active': isRoute('status-page') }">
                        {{ $t("Status Pages") }}
                    </router-link>
                    <router-link to="/maintenance" :class="{ 'is-active': isRoute('maintenance') }">
                        {{ $t("Maintenance") }}
                    </router-link>
                    <router-link to="/settings/general" :class="{ 'is-active': isRoute('settings') }">
                        {{ $t("Settings") }}
                    </router-link>
                    <a href="https://github.com/louislam/uptime-kuma/wiki" target="_blank" rel="noopener">
                        {{ $t("Help") }}
                    </a>
                </nav>

                <a
                    v-if="hasNewVersion"
                    target="_blank"
                    rel="noopener"
                    href="https://github.com/louislam/uptime-kuma/releases"
                    class="app-update kn-small"
                >
                    {{ $t("New Update") }}
                </a>

                <div class="kn-sidebar-foot app-foot">
                    <span class="kn-avatar">{{ $root.usernameFirstChar }}</span>
                    <span class="app-user kn-small">
                        {{ $root.username != null ? $root.username : $t("signedInDispDisabled") }}
                    </span>
                    <button class="kn-btn kn-btn-quiet kn-btn-sm" type="button" @click="$root.logout">
                        {{ $t("Logout") }}
                    </button>
                </div>
            </aside>

            <div class="app-content">
                <!-- Mobile header -->
                <header v-if="$root.loggedIn && $root.isMobile" class="kn-topbar app-bar">
                    <router-link to="/dashboard" class="kn-brand app-brand">
                        <BrandMark />
                        {{ $t("Status") }}
                    </router-link>
                </header>

                <main :class="{ 'app-main': $root.loggedIn }">
                    <router-view v-if="$root.loggedIn" />
                    <Login v-if="!$root.loggedIn && $root.allowLoginDialog" />
                </main>
            </div>
        </div>

        <!-- Mobile Only -->
        <div v-if="$root.isMobile" style="width: 100%; height: calc(60px + env(safe-area-inset-bottom))" />
        <nav v-if="$root.isMobile && $root.loggedIn" class="bottom-nav">
            <router-link to="/dashboard" class="nav-link">
                <div><font-awesome-icon icon="tachometer-alt" /></div>
                {{ $t("Home") }}
            </router-link>

            <router-link to="/list" class="nav-link">
                <div><font-awesome-icon icon="list" /></div>
                {{ $t("List") }}
            </router-link>

            <router-link to="/add" class="nav-link">
                <div><font-awesome-icon icon="plus" /></div>
                {{ $t("Add") }}
            </router-link>

            <router-link to="/settings" class="nav-link">
                <div><font-awesome-icon icon="cog" /></div>
                {{ $t("Settings") }}
            </router-link>
        </nav>

        <button
            v-if="numActiveToasts != 0"
            type="button"
            class="btn btn-normal clear-all-toast-btn"
            @click="clearToasts"
        >
            <font-awesome-icon icon="times" />
        </button>
    </div>
</template>

<script>
import Login from "../components/Login.vue";
import BrandMark from "../components/BrandMark.vue";
import compareVersions from "compare-versions";
import { useToast } from "vue-toastification";
const toast = useToast();

export default {
    components: {
        Login,
        BrandMark,
    },

    data() {
        return {
            toastContainer: null,
            numActiveToasts: 0,
            toastContainerObserver: null,
        };
    },

    computed: {
        showSidebar() {
            return this.$root.loggedIn && !this.$root.isMobile;
        },

        isDashboardRoute() {
            const path = this.$route.path;
            return ["/dashboard", "/add", "/edit", "/clone", "/list"].some((prefix) => path.startsWith(prefix));
        },

        // Theme or Mobile
        classes() {
            const classes = {};
            classes[this.$root.theme] = true;
            classes["mobile"] = this.$root.isMobile;
            return classes;
        },

        hasNewVersion() {
            if (this.$root.info.latestVersion && this.$root.info.version) {
                return compareVersions(this.$root.info.latestVersion, this.$root.info.version) >= 1;
            } else {
                return false;
            }
        },
    },

    watch: {},

    mounted() {
        this.toastContainer = document.querySelector(".bottom-right.toast-container");

        // Watch the number of active toasts
        this.toastContainerObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === "childList") {
                    this.numActiveToasts = mutation.target.children.length;
                }
            }
        });

        if (this.toastContainer != null) {
            this.toastContainerObserver.observe(this.toastContainer, { childList: true });
        }
    },

    beforeUnmount() {
        this.toastContainerObserver.disconnect();
    },

    methods: {
        /**
         * Whether the current route belongs to a section of the sidebar
         * @param {string} name Part of the route path
         * @returns {boolean} True if the nav item is the active one
         */
        isRoute(name) {
            return this.$route.path.includes(name);
        },

        /**
         * Clear all toast notifications.
         * @returns {void}
         */
        clearToasts() {
            toast.clear();
        },
    },
};
</script>

<style lang="scss" scoped>
.app-sidebar {
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
}

.app-brand {
    color: var(--text);
    text-decoration: none;
}

.app-update {
    margin: 0 var(--space-4) var(--space-3);
    color: var(--accent-text);
    text-decoration: underline;
    text-underline-offset: 3px;
}

.app-foot {
    display: flex;
    align-items: center;
    gap: var(--space-2);
}

.app-user {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.app-content {
    min-width: 0;
}

.app-main {
    padding: var(--space-8) var(--space-6) var(--space-12);
}

.app-bar {
    padding: 0;

    .app-brand {
        border-bottom: 0;
    }
}

.mobile .app-main {
    padding: var(--space-4) 0 var(--space-8);
}

.bottom-nav {
    z-index: 1000;
    position: fixed;
    bottom: 0;
    height: calc(60px + env(safe-area-inset-bottom));
    width: 100%;
    left: 0;
    background-color: var(--bg-raised);
    border-top: var(--stroke) solid var(--border);
    text-align: center;
    white-space: nowrap;
    padding: 0 10px env(safe-area-inset-bottom);

    a {
        text-align: center;
        width: 25%;
        display: inline-block;
        height: 100%;
        padding: 10px 10px 0;
        font-size: 13px;
        color: var(--text-muted);
        overflow: hidden;
        text-decoration: none;
        border-top: var(--stroke-strong) solid transparent;

        &.router-link-exact-active,
        &.active {
            color: var(--text);
            font-weight: 500;
            border-top-color: var(--accent);
        }

        div {
            font-size: 16px;
        }
    }
}

.lost-connection {
    padding: var(--space-2) 0;
    font-size: 13px;
    color: var(--danger);
    background-color: var(--bg-raised);
    border-bottom: var(--stroke) solid var(--border-strong);
    position: fixed;
    width: 100%;
    z-index: 99999;
}

.clear-all-toast-btn {
    position: fixed;
    right: 1em;
    bottom: 1em;
    width: var(--control-lg);
    height: var(--control-lg);
    padding: 0;
    background-color: var(--bg-raised);
    z-index: 100;
}

@media (max-width: 770px) {
    .clear-all-toast-btn {
        bottom: 72px;
    }
}
</style>
