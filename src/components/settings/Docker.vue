<template>
    <div>
        <div class="dockerHost-list my-4">
            <p v-if="$root.dockerHostList.length === 0">
                {{ $t("Not available, please setup.") }}
            </p>

            <ul class="list-group mb-3" style="border-radius: 1rem;">
                <li v-for="(dockerHost, index) in $root.dockerHostList" :key="index" class="list-group-item">
                    {{ dockerHost.name }}<br>
                    <a href="#" @click="$refs.dockerHostDialog.show(dockerHost.id)">{{ $t("Edit") }}</a>
                </li>
            </ul>

            <button class="btn btn-primary me-2" type="button" @click="$refs.dockerHostDialog.show()">
                {{ $t("Setup Docker Host") }}
            </button>
        </div>

        <DockerHostDialog ref="dockerHostDialog" />
    </div>
</template>

<script>
import DockerHostDialog from "../../components/DockerHostDialog.vue";

export default {
    components: {
        DockerHostDialog,
    },

    data() {
        return {};
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
    }
};
</script>
