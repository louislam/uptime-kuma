<template>
    <div class="d-flex justify-content-center align-items-center">
        <div class="logo d-flex flex-column justify-content-center align-items-center">
            <object class="my-4" width="200" height="200" data="/icon.svg" />
            <div class="fs-4 fw-bold">Uptime Worker</div>
            <div>{{ $t("versionIs", { version: appVersion }) }}</div>

            <div v-if="!$root.isFrontendBackendVersionMatched" class="alert alert-warning mt-4" role="alert">
                ⚠️ {{ $t("Frontend Version do not match backend version!") }}
            </div>

            <div class="my-3 update-link">
                <a href="https://github.com/esaueng/uptimeworker/releases" target="_blank" rel="noopener">
                    {{ $t("Check Update On GitHub") }}
                </a>
            </div>

            <div class="mt-1">
                <div class="form-check">
                    <label>
                        <input v-model="settings.checkUpdate" type="checkbox" @change="saveSettings()" />
                        {{ $t("Show update if available") }}
                    </label>
                </div>
            </div>
            <div class="mt-4 license-note">
                <a href="https://github.com/esaueng/uptimeworker/blob/master/LICENSE" target="_blank" rel="noopener">
                    MIT License
                </a>
                <div>Copyright (c) 2026 Esau Engineering</div>
            </div>
            <div class="mt-4 fork-note">
                Forked from
                <a href="https://github.com/louislam/uptime-kuma" target="_blank" rel="noopener">
                    Uptime Kuma
                </a>
            </div>
        </div>
    </div>
</template>

<script>
export default {
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
        appVersion() {
            return this.$root.info.version || this.$root.frontendVersion;
        },
    },

    watch: {},
};
</script>

<style lang="scss" scoped>
.logo {
    margin: 4em 1em;
}

.update-link {
    font-size: 0.8em;
}

.license-note {
    font-size: 0.9em;
}

.fork-note {
    font-size: 0.9em;
}
</style>
