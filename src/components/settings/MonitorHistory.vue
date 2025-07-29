<template>
    <div>
        <div class="my-4">
            <label for="keepDataPeriodDays" class="form-label">
                {{
                    $t("clearDataOlderThan", [
                        settings.keepDataPeriodDays,
                    ])
                }}
                {{ $t("infiniteRetention") }}
            </label>
            <input
                id="keepDataPeriodDays"
                v-model="settings.keepDataPeriodDays"
                type="number"
                class="form-control"
                required
                min="0"
                step="1"
            />
            <div v-if="settings.keepDataPeriodDays < 0" class="form-text">
                {{ $t("dataRetentionTimeError") }}
            </div>
        </div>
        <div class="my-4">
            <button class="btn btn-primary" type="button" @click="saveSettings()">
                {{ $t("Save") }}
            </button>
        </div>
        <div class="my-4">
            <div v-if="$root.info.dbType === 'sqlite'" class="my-3">
                <button class="btn btn-outline-info me-2" @click="shrinkDatabase">
                    {{ $t("Shrink Database") }} ({{ databaseSizeDisplay }})
                </button>
                <i18n-t tag="div" keypath="shrinkDatabaseDescriptionSqlite" class="form-text mt-2 mb-4 ms-2">
                    <template #vacuum>
                        <code>VACUUM</code>
                    </template>
                    <template #auto_vacuum>
                        <code>AUTO_VACUUM</code>
                    </template>
                </i18n-t>
            </div>
            <button
                id="clearAllStats-btn"
                class="btn btn-outline-danger me-2 mb-2"
                @click="confirmClearStatistics"
            >
                {{ $t("Clear all statistics") }}
            </button>
        </div>
        <Confirm
            ref="confirmClearStatistics"
            btn-style="btn-danger"
            :yes-text="$t('Yes')"
            :no-text="$t('No')"
            @yes="clearStatistics"
        >
            {{ $t("confirmClearStatisticsMsg") }}
        </Confirm>
    </div>
</template>

<script>
import Confirm from "../../components/Confirm.vue";
import { log } from "../../util.ts";

export default {
    components: {
        Confirm,
    },

    data() {
        return {
            databaseSize: 0,
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
        databaseSizeDisplay() {
            return (
                Math.round((this.databaseSize / 1024 / 1024) * 10) / 10 + " MB"
            );
        },
    },

    mounted() {
        this.loadDatabaseSize();
    },

    methods: {
        /**
         * Get the current size of the database
         * @returns {void}
         */
        loadDatabaseSize() {
            log.debug("monitorhistory", "load database size");
            this.$root.getSocket().emit("getDatabaseSize", (res) => {
                if (res.ok) {
                    this.databaseSize = res.size;
                    log.debug("monitorhistory", "database size: " + res.size);
                } else {
                    log.debug("monitorhistory", res);
                }
            });
        },

        /**
         * Request that the database is shrunk
         * @returns {void}
         */
        shrinkDatabase() {
            this.$root.getSocket().emit("shrinkDatabase", (res) => {
                if (res.ok) {
                    this.loadDatabaseSize();
                    this.$root.toastSuccess("Done");
                } else {
                    log.debug("monitorhistory", res);
                }
            });
        },

        /**
         * Show the dialog to confirm clearing stats
         * @returns {void}
         */
        confirmClearStatistics() {
            this.$refs.confirmClearStatistics.show();
        },

        /**
         * Send the request to clear stats
         * @returns {void}
         */
        clearStatistics() {
            this.$root.clearStatistics((res) => {
                if (res.ok) {
                    this.$router.go();
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },
    },
};
</script>
