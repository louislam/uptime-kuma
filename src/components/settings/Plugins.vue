<template>
    <div>
        <div class="mt-3">{{ pluginListMsg }}</div>
        <PluginItem v-for="plugin in pluginList" :key="plugin.id" :plugin="plugin" />
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
            pluginList: [],
            pluginListMsg: "",
        };
    },

    computed: {
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
        this.pluginListMsg = this.$t("Loading") + "...";

        this.$root.getSocket().emit("getPluginList", (res) => {
            if (res.ok) {
                this.pluginList = res.pluginList;
                this.pluginListMsg = "";
            } else {
                this.pluginListMsg = this.$t("loadingError") + " " + res.message;
            }
        });
    },

    methods: {

    },
};
</script>

<style lang="scss" scoped>

</style>
