<template>
    <div>
        <div v-if="$root.isMobile" class="shadow-box mb-3">
            <router-link to="/manage-status-page" class="nav-link">
                <font-awesome-icon icon="stream" /> {{ $t("Status Pages") }}
            </router-link>
            <router-link to="/maintenance" class="nav-link">
                <font-awesome-icon icon="wrench" /> {{ $t("Maintenance") }}
            </router-link>
        </div>

        <h1 v-show="show" class="mb-3">
            {{ $t("Settings") }}
        </h1>

        <div class="shadow-box shadow-box-settings">
            <div class="row">
                <div v-if="showSubMenu" class="settings-menu col-lg-3 col-md-5">
                    <router-link
                        v-for="(item, key) in subMenus"
                        :key="key"
                        :to="`/settings/${key}`"
                    >
                        <div class="menu-item">
                            {{ item.title }}
                        </div>
                    </router-link>

                    <!-- Logout Button -->
                    <a v-if="$root.isMobile && $root.loggedIn && $root.socket.token !== 'autoLogin'" class="logout" @click.prevent="$root.logout">
                        <div class="menu-item">
                            <font-awesome-icon icon="sign-out-alt" />
                            {{ $t("Logout") }}
                        </div>
                    </a>
                </div>
                <div class="settings-content col-lg-9 col-md-7">
                    <nav aria-label="breadcrumb">
                        <ol class="breadcrumb settings-content-header">
                            <li
                                v-for="{ path, title, active } in breadcrumbs"
                                :key="path"
                                class="breadcrumb-item"
                                v-bind="active ? { 'aria-current': 'page' } : {}"
                                aria-current="page"
                            >
                                <template v-if="active">{{ title }}</template>
                                <RouterLink v-else :to="path">{{ title }}</RouterLink>
                            </li>
                        </ol>
                    </nav>
                    <div class="mx-3">
                        <router-view v-slot="{ Component }">
                            <transition name="slide-fade" appear>
                                <component :is="Component" />
                            </transition>
                        </router-view>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { useRoute } from "vue-router";

/**
 * Deduplicate an array of objects using the provided key
 * @param {object[]} arr array of objects to deduplicate
 * @param {string} key key used for uniqness
 * @returns {object[]} the deduplicated array
 */
const uniqBy = (arr, key) =>
    [ ...(new Map(arr.map(item => [ item[key], item ]))).values() ];

export default {
    data() {
        return {
            show: true,
            settings: {},
            settingsLoaded: false,
        };
    },

    computed: {
        currentPage() {
            let pathSplit = useRoute().path.split("/");
            let pathEnd = pathSplit[pathSplit.length - 1];
            if (!pathEnd || pathEnd === "settings") {
                return null;
            }
            return pathEnd;
        },

        showSubMenu() {
            if (this.$root.isMobile) {
                return !this.currentPage;
            } else {
                return true;
            }
        },

        subMenus() {
            return {
                general: {
                    title: this.$t("General"),
                },
                appearance: {
                    title: this.$t("Appearance"),
                },
                notifications: {
                    title: this.$t("Notifications"),
                },
                "reverse-proxy": {
                    title: this.$t("Reverse Proxy"),
                },
                tags: {
                    title: this.$t("Tags"),
                },
                "monitor-history": {
                    title: this.$t("Monitor History"),
                },
                "docker-hosts": {
                    title: this.$t("Docker Hosts"),
                },
                "remote-browsers": {
                    title: this.$t("Remote Browsers"),
                },
                security: {
                    title: this.$t("Security"),
                },
                users: {
                    title: this.$t("Users"),
                    children: {
                        add: { title: this.$t("Add") },
                        edit: { title: this.$t("Edit") }
                    },
                },
                "api-keys": {
                    title: this.$t("API Keys")
                },
                proxies: {
                    title: this.$t("Proxies"),
                },
                about: {
                    title: this.$t("About"),
                },
            };
        },

        breadcrumbs: ({ $route, subMenus }) => {
            // List of setting routes matching the current path
            // for ex, with path "/settings/users/edit/1", we got:
            // [
            //    { path: "/settings/users", ...otherRoutesProps },
            //    { path: "/settings/users/edit/:id", ...otherRoutesProps }
            // ]
            const settingRoutes = uniqBy(
                $route.matched.filter(({ path }) => /^\/settings\//.test(path)),
                "path"
            );

            /**
             * Get leaf submenu for a given setting path
             * @param {string} path setting path, ex: "/settings/users/edit/1"
             * @returns {object} the leaf subMenu corresponding to the given path
             */
            const getLeafSubMenu = path => {
                const pathParts = path.split("/").slice(2);

                // walk through submenus and there children until reaching the corresponding leaf subMenu
                // ex with "/settings/users/edit/1" we got { title: this.$t("Edit") }
                // because this path match "users" > "children" > "edit" in subMenus
                return pathParts.reduce(
                    (acc, pathPart) =>
                        acc[pathPart] || acc.children?.[pathPart] || acc,
                    subMenus
                );
            };

            // construct an array of setting routes path joined with submenus
            return settingRoutes.map(({ path }, idx) => ({
                path,
                title: getLeafSubMenu(path).title,
                active: !settingRoutes[idx + 1],
            }));
        }
    },

    watch: {
        "$root.isMobile"() {
            this.loadGeneralPage();
        }
    },

    mounted() {
        this.loadSettings();
        this.loadGeneralPage();
    },

    methods: {

        /**
         * Load the general settings page
         * For desktop only, on mobile do nothing
         * @returns {void}
         */
        loadGeneralPage() {
            if (!this.currentPage && !this.$root.isMobile) {
                this.$router.push("/settings/general");
            }
        },

        /**
         * Load settings from server
         * @returns {void}
         */
        loadSettings() {
            this.$root.getSocket().emit("getSettings", (res) => {
                this.settings = res.data;

                if (this.settings.checkUpdate === undefined) {
                    this.settings.checkUpdate = true;
                }

                if (this.settings.searchEngineIndex === undefined) {
                    this.settings.searchEngineIndex = false;
                }

                if (this.settings.entryPage === undefined) {
                    this.settings.entryPage = "dashboard";
                }

                if (this.settings.nscd === undefined) {
                    this.settings.nscd = true;
                }

                if (this.settings.keepDataPeriodDays === undefined) {
                    this.settings.keepDataPeriodDays = 180;
                }

                if (this.settings.tlsExpiryNotifyDays === undefined) {
                    this.settings.tlsExpiryNotifyDays = [ 7, 14, 21 ];
                }

                if (this.settings.trustProxy === undefined) {
                    this.settings.trustProxy = false;
                }

                this.settingsLoaded = true;
            });
        },

        /**
         * Callback for saving settings
         * @callback saveSettingsCB
         * @param {object} res Result of operation
         * @returns {void}
         */

        /**
         * Save Settings
         * @param {saveSettingsCB} callback Callback for socket response
         * @param {string} currentPassword Only need for disableAuth to true
         * @returns {void}
         */
        saveSettings(callback, currentPassword) {
            let valid = this.validateSettings();
            if (valid.success) {
                this.$root.getSocket().emit("setSettings", this.settings, currentPassword, (res) => {
                    this.$root.toastRes(res);
                    this.loadSettings();

                    if (callback) {
                        callback();
                    }
                });
            } else {
                this.$root.toastError(valid.msg);
            }
        },

        /**
         * Ensure settings are valid
         * @returns {object} Contains success state and error msg
         */
        validateSettings() {
            if (this.settings.keepDataPeriodDays < 0) {
                return {
                    success: false,
                    msg: this.$t("dataRetentionTimeError"),
                };
            }
            return {
                success: true,
                msg: "",
            };
        },
    }
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.shadow-box-settings {
    padding: 20px;
    min-height: calc(100vh - 155px);
}

footer {
    color: $secondary-text;
    font-size: 13px;
    margin-top: 20px;
    padding-bottom: 30px;
    text-align: center;
}

.settings-menu {
    a {
        text-decoration: none !important;
    }

    .menu-item {
        border-radius: 10px;
        margin: 0.5em;
        padding: 0.7em 1em;
        cursor: pointer;
        border-left-width: 0;
        transition: all ease-in-out 0.1s;
    }

    .menu-item:hover {
        background: $highlight-white;

        .dark & {
            background: $dark-header-bg;
        }
    }

    .active .menu-item {
        background: $highlight-white;
        border-left: 4px solid $primary;
        border-top-left-radius: 0;
        border-bottom-left-radius: 0;

        .dark & {
            background: $dark-header-bg;
        }
    }
}

.settings-content {
    .settings-content-header {
        width: calc(100% + 20px);
        border-bottom: 1px solid #dee2e6;
        border-radius: 0 10px 0 0;
        margin-top: -20px;
        margin-right: -20px;
        padding: 12.5px 1em;
        font-size: 26px;

        .dark & {
            background: $dark-header-bg;
            border-bottom: 0;
        }

        .mobile & {
            padding: 15px 0 0 0;

            .dark & {
                background-color: transparent;
            }
        }
    }
}

.logout {
    color: $danger !important;
}
</style>
