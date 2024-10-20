<template>
    <div>
        <HorizontalTabHeader
            v-model:selected="storageLoc"
            class="mt-4"
            :tabs="['Browser', 'Server']"
        />
        <AppearanceSettings
            v-if="storageLoc == 0"
            v-model:language="$root.language"
            v-model:userTheme="$root.userTheme"
            v-model:userHeartbeatBar="$root.userHeartbeatBar"
            v-model:styleElapsedTime="$root.styleElapsedTime"
            :languages="languagesList"
        />
        <AppearanceSettings
            v-if="storageLoc == 1"
            :language="settings.defaultAppearance.language || ''"
            :userTheme="settings.defaultAppearance.theme || ''"
            :userHeartbeatBar="settings.defaultAppearance.heartbeatBarTheme || ''"
            :styleElapsedTime="settings.defaultAppearance.styleElapsedTime || ''"
            :languages="languagesList"
            @update:language="updateDefaultLanguage"
            @update:user-theme="updateDefaultTheme"
            @update:user-heartbeat-bar="updateDefaultHeartbeatBarTheme"
            @update:style-elapsed-time="updateDefaultStyleElapsedTime"
        />
    </div>
</template>

<script>
import HorizontalTabHeader from "../HorizontalTabHeader.vue";
import AppearanceSettings from "./AppearanceSettings.vue";

export default {
    components: {
        HorizontalTabHeader,
        AppearanceSettings
    },
    data() {
        return {
            storageLoc: 0,
            languagesList: this.$i18n.availableLocales.map(lang => {
                return {
                    value: lang,
                    label: this.$i18n.messages[lang].languageName,
                };
            })
        };
    },
    computed: {
        settings() {
            return this.$parent.$parent.$parent.settings;
        },
        saveSettings() {
            return this.$parent.$parent.$parent.saveSettings;
        }
    },
    methods: {
        updateDefaultLanguage(language) {
            this.updateDefaultAppearance({
                ...this.settings.defaultAppearance,
                language
            });
        },
        updateDefaultTheme(theme) {
            this.updateDefaultAppearance({
                ...this.settings.defaultAppearance,
                theme: theme
            });
        },
        updateDefaultHeartbeatBarTheme(theme) {
            this.updateDefaultAppearance({
                ...this.settings.defaultAppearance,
                heartbeatBarTheme: theme
            });
        },
        updateDefaultStyleElapsedTime(styleElapsedTime) {
            this.updateDefaultAppearance({
                ...this.settings.defaultAppearance,
                styleElapsedTime
            });
        },
        updateDefaultAppearance(appearance) {
            this.$parent.$parent.$parent.settings.defaultAppearance = appearance;
            this.saveSettings();
        }
    }
};
</script>

<style lang="scss" scoped>
@import "../../assets/vars.scss";

.dark {
    .list-group-item {
        background-color: $dark-bg2;
        color: $dark-font-color;
    }
}
</style>
