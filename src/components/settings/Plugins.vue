<template>
    <div>
        <div class="mt-3">{{ remotePluginListMsg }}</div>
        <PluginItem v-for="plugin in remotePluginList" :key="plugin.id" :plugin="plugin" />
    </div>
</template>

<script>
import PluginItem from "../PluginItem.vue";

export default {
    components: {
        PluginItem
    },

    data() {
        return {
            remotePluginList: [],
            remotePluginListMsg: "",
        };
    },

    computed: {
        pluginList() {
            return this.$parent.$parent.$parent.pluginList;
        },
        settings() {
            return this.$parent.$parent.$parent.settings;
        },
        saveSettings() {
            return this.$parent.$parent.$parent.saveSettings;
        },
        settingsLoaded() {
            return this.$parent.$parent.$parent.settingsLoaded;
        },
    },

    async mounted() {
        this.loadList();
    },

    methods: {
        loadList() {
            this.remotePluginListMsg = this.$t("Loading") + "...";

            this.$root.getSocket().emit("getPluginList", (res) => {
                if (res.ok) {
                    this.remotePluginList = res.pluginList;
                    this.remotePluginListMsg = "";
                } else {
                    this.remotePluginListMsg = this.$t("loadingError") + " " + res.msg;
                }
            });
        }
    },
};
</script>
