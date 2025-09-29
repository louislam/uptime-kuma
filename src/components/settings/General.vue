<template>
    <div>
        <form class="my-4" autocomplete="off" @submit.prevent="saveGeneral">
            <!-- Client side Timezone -->
            <div class="mb-4">
                <label for="timezone" class="form-label">
                    {{ $t("Display Timezone") }}
                </label>
                <select id="timezone" v-model="$root.userTimezone" class="form-select">
                    <option value="auto">
                        {{ $t("Auto") }}: {{ guessTimezone }}
                    </option>
                    <option
                        v-for="(timezone, index) in timezoneList"
                        :key="index"
                        :value="timezone.value"
                    >
                        {{ timezone.name }}
                    </option>
                </select>
            </div>

            <!-- Server Timezone -->
            <div class="mb-4">
                <label for="timezone" class="form-label">
                    {{ $t("Server Timezone") }}
                </label>
                <select id="timezone" v-model="settings.serverTimezone" class="form-select">
                    <option value="UTC">UTC</option>
                    <option
                        v-for="(timezone, index) in timezoneList"
                        :key="index"
                        :value="timezone.value"
                    >
                        {{ timezone.name }}
                    </option>
                </select>
            </div>

            <!-- Search Engine -->
            <div class="mb-4">
                <label class="form-label">
                    {{ $t("Search Engine Visibility") }}
                </label>

                <div class="form-check">
                    <input
                        id="searchEngineIndexYes"
                        v-model="settings.searchEngineIndex"
                        class="form-check-input"
                        type="radio"
                        name="searchEngineIndex"
                        :value="true"
                        required
                    />
                    <label class="form-check-label" for="searchEngineIndexYes">
                        {{ $t("Allow indexing") }}
                    </label>
                </div>
                <div class="form-check">
                    <input
                        id="searchEngineIndexNo"
                        v-model="settings.searchEngineIndex"
                        class="form-check-input"
                        type="radio"
                        name="searchEngineIndex"
                        :value="false"
                        required
                    />
                    <label class="form-check-label" for="searchEngineIndexNo">
                        {{ $t("Discourage search engines from indexing site") }}
                    </label>
                </div>
            </div>

            <!-- Entry Page -->
            <div class="mb-4">
                <label class="form-label">{{ $t("Entry Page") }}</label>

                <div class="form-check">
                    <input
                        id="entryPageDashboard"
                        v-model="settings.entryPage"
                        class="form-check-input"
                        type="radio"
                        name="entryPage"
                        value="dashboard"
                        required
                    />
                    <label class="form-check-label" for="entryPageDashboard">
                        {{ $t("Dashboard") }}
                    </label>
                </div>

                <div v-for="statusPage in $root.statusPageList" :key="statusPage.id" class="form-check">
                    <input
                        :id="'status-page-' + statusPage.id"
                        v-model="settings.entryPage"
                        class="form-check-input"
                        type="radio"
                        name="entryPage"
                        :value="'statusPage-' + statusPage.slug"
                        required
                    />
                    <label class="form-check-label" :for="'status-page-' + statusPage.id">
                        {{ $t("Status Page") }} - {{ statusPage.title }}
                    </label>
                </div>
            </div>

            <!-- Primary Base URL -->
            <div class="mb-4">
                <label class="form-label" for="primaryBaseURL">
                    {{ $t("Primary Base URL") }}
                </label>

                <div class="input-group mb-3">
                    <input
                        id="primaryBaseURL"
                        v-model="settings.primaryBaseURL"
                        class="form-control"
                        name="primaryBaseURL"
                        placeholder="https://"
                        pattern="https?://.+"
                        autocomplete="new-password"
                    />
                    <button class="btn btn-outline-primary" type="button" @click="autoGetPrimaryBaseURL">
                        {{ $t("Auto Get") }}
                    </button>
                </div>

                <div class="form-text"></div>
            </div>

            <!-- Steam API Key -->
            <div class="mb-4">
                <label class="form-label" for="steamAPIKey">
                    {{ $t("Steam API Key") }}
                </label>
                <HiddenInput
                    id="steamAPIKey"
                    v-model="settings.steamAPIKey"
                    autocomplete="new-password"
                />
                <div class="form-text">
                    {{ $t("steamApiKeyDescription") }}
                    <a href="https://steamcommunity.com/dev" target="_blank">
                        https://steamcommunity.com/dev
                    </a>
                </div>
            </div>

            <!-- DNS Cache (nscd) -->
            <div v-if="$root.info.isContainer" class="mb-4">
                <label class="form-label">
                    {{ $t("enableNSCD") }}
                </label>

                <div class="form-check">
                    <input
                        id="nscdEnable"
                        v-model="settings.nscd"
                        class="form-check-input"
                        type="radio"
                        name="nscd"
                        :value="true"
                        required
                    />
                    <label class="form-check-label" for="nscdEnable">
                        {{ $t("Enable") }}
                    </label>
                </div>

                <div class="form-check">
                    <input
                        id="nscdDisable"
                        v-model="settings.nscd"
                        class="form-check-input"
                        type="radio"
                        name="nscd"
                        :value="false"
                        required
                    />
                    <label class="form-check-label" for="nscdDisable">
                        {{ $t("Disable") }}
                    </label>
                </div>
            </div>

            <!-- Chrome Executable -->
            <div class="mb-4">
                <label class="form-label" for="primaryBaseURL">
                    {{ $t("chromeExecutable") }}
                </label>

                <div class="input-group mb-3">
                    <input
                        id="primaryBaseURL"
                        v-model="settings.chromeExecutable"
                        class="form-control"
                        name="primaryBaseURL"
                        :placeholder="$t('chromeExecutableAutoDetect')"
                    />
                    <button class="btn btn-outline-primary" type="button" @click="testChrome">
                        {{ $t("Test") }}
                    </button>
                </div>

                <div class="form-text">
                    {{ $t("chromeExecutableDescription") }}
                </div>
            </div>

            <!-- Save Button -->
            <div>
                <button class="btn btn-primary" type="submit">
                    {{ $t("Save") }}
                </button>
            </div>
        </form>
    </div>
</template>

<script>
import HiddenInput from "../../components/HiddenInput.vue";
import dayjs from "dayjs";
import { timezoneList } from "../../util-frontend";

export default {
    components: {
        HiddenInput,
    },

    data() {
        return {
            timezoneList: timezoneList(),
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
        guessTimezone() {
            return dayjs.tz.guess();
        }
    },

    methods: {
        /**
         * Save the settings
         * @returns {void}
         */
        saveGeneral() {
            localStorage.timezone = this.$root.userTimezone;
            this.saveSettings();
        },
        /**
         * Get the base URL of the application
         * @returns {void}
         */
        autoGetPrimaryBaseURL() {
            this.settings.primaryBaseURL = location.protocol + "//" + location.host;
        },
        /**
         * Test the chrome executable
         * @returns {void}
         */
        testChrome() {
            this.$root.getSocket().emit("testChrome", this.settings.chromeExecutable, (res) => {
                this.$root.toastRes(res);
            });
        },
    },
};
</script>

