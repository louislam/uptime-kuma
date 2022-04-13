<template>
    <div>
        <div class="my-4">
            <label for="keepDataPeriodDays" class="form-label">
                {{
                    $t("clearDataOlderThan", [
                        settings.keepDataPeriodDays,
                    ])
                }}
            </label>
            <input
                id="keepDataPeriodDays"
                v-model="settings.keepDataPeriodDays"
                type="number"
                class="form-control"
                required
                min="1"
                step="1"
            />
        </div>
        <div class="my-4">
            <button class="btn btn-primary" type="button" @click="saveSettings()">
                {{ $t("Save") }}
            </button>
        </div>
        <div class="my-4">
            <div class="my-3">
                <button class="btn btn-outline-info me-2" @click="shrinkDatabase">
                    {{ $t("Shrink Database") }} ({{ databaseSizeDisplay }})
                </button>
                <div class="form-text mt-2 mb-4 ms-2">{{ $t("shrinkDatabaseDescription") }}</div>
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
import { useToast } from "vue-toastification";

const toast = useToast();

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

        shrinkDatabase() {
            this.$root.getSocket().emit("shrinkDatabase", (res) => {
                if (res.ok) {
                    this.loadDatabaseSize();
                    toast.success("Done");
                } else {
                    log.debug("monitorhistory", res);
                }
            });
        },

        confirmClearStatistics() {
            this.$refs.confirmClearStatistics.show();
        },

        clearStatistics() {
            this.$root.clearStatistics((res) => {
                if (res.ok) {
                    this.$router.go();
                } else {
                    toast.error(res.msg);
                }
            });
        },
    },
};
</script>
