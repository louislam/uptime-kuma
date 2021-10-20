<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 v-show="show" class="mb-3">
                {{ $t("Settings") }}
            </h1>

            <div class="shadow-box">
                <div class="row">
                    <div class="settings-menu">
                        <div v-for="(item, key) in subMenus"
                             :key="key"
                             class="menu-item"
                             :class="{ active: currentSubMenu == key }"
                             @click="currentSubMenu = key"
                        >
                            {{ item.title }}
                        </div>
                    </div>
                    <div class="settings-content">
                        <div class="settings-content-header">
                            {{ subMenus[currentSubMenu].title }}
                        </div>
                        <div class="mx-3">
                            <component :is="subMenus[currentSubMenu].component" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </transition>
</template>

<script>
import { markRaw } from "vue";

import Appearance from "../components/settings/Appearance.vue";
import General from "../components/settings/General.vue";
import Notifications from "../components/settings/Notifications.vue";
import MonitorHistory from "../components/settings/MonitorHistory.vue";
import Security from "../components/settings/Security.vue";
import Backup from "../components/settings/Backup.vue";
import About from "../components/settings/About.vue";

export default {

    data() {
        return {

            show: true,

            settings: {},
            settingsLoaded: false,

            subMenus: {
                general: {
                    title: this.$t("General"),
                    component: markRaw(General),
                },
                appearance: {
                    title: this.$t("Appearance"),
                    component: markRaw(Appearance),
                },
                notifications: {
                    title: this.$t("Notifications"),
                    component: markRaw(Notifications),
                },
                monitorHistory: {
                    title: this.$t("Monitor History"),
                    component: markRaw(MonitorHistory),
                },
                security: {
                    title: this.$t("Security"),
                    component: markRaw(Security),
                },
                backup: {
                    title: this.$t("Backup"),
                    component: markRaw(Backup),
                },
                about: {
                    title: this.$t("About"),
                    component: markRaw(About),
                }
            },
            currentSubMenu: "general",
        };
    },

    mounted() {
        this.loadSettings();
    },

    methods: {
        loadSettings() {
            this.$root.getSocket().emit("getSettings", (res) => {
                this.settings = res.data;

                if (this.settings.searchEngineIndex === undefined) {
                    this.settings.searchEngineIndex = false;
                }

                if (this.settings.entryPage === undefined) {
                    this.settings.entryPage = "dashboard";
                }

                if (this.settings.keepDataPeriodDays === undefined) {
                    this.settings.keepDataPeriodDays = 180;
                }

                this.settingsLoaded = true;
            });
        },

        saveSettings() {
            this.$root.getSocket().emit("setSettings", this.settings, (res) => {
                this.$root.toastRes(res);
                this.loadSettings();
            });
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.shadow-box {
    padding: 20px;
    min-height: calc(100vh - 155px);
    max-height: calc(100vh - 30px);
}

footer {
    color: #aaa;
    font-size: 13px;
    margin-top: 20px;
    padding-bottom: 30px;
    text-align: center;
}

.settings-menu {
    flex: 0 0 auto;
    width: 300px;

    .menu-item {
        border-radius: 10px;
        margin: 0.5em;
        padding: 0.7em 1em;
        cursor: pointer;
    }

    .menu-item:hover {
        background: $highlight-white;

        .dark & {
            background: $dark-header-bg;
        }
    }

    .menu-item.active {
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
    flex: 0 0 auto;
    width: calc(100% - 300px);

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
    }
}
</style>
