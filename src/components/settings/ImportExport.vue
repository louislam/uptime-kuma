<template>
    <div>
        <div v-if="!isAdmin" class="alert alert-warning">
            {{ $t("adminOnly") }}
        </div>

        <div v-else>
            <div class="my-4">
                <h5 class="settings-subheading">{{ $t("Export") }}</h5>
                <p>{{ $t("exportConfigDescription") }}</p>

                <div class="alert alert-warning" role="alert">
                    {{ $t("exportConfigWarning") }}
                </div>

                <button class="btn btn-primary" type="button" :disabled="exporting" @click="exportConfig">
                    {{ exporting ? $t("Processing...") : $t("Export") }}
                </button>
            </div>

            <div class="my-4 pt-4">
                <h5 class="settings-subheading">{{ $t("Import") }}</h5>
                <p>{{ $t("importConfigDescription") }}</p>

                <div class="mb-3">
                    <label for="config-file" class="form-label">{{ $t("selectConfigFile") }}</label>
                    <input
                        id="config-file"
                        ref="fileInput"
                        class="form-control"
                        type="file"
                        accept="application/json,.json"
                        @change="onFileSelected"
                    />
                </div>

                <div v-if="parseError" class="alert alert-danger" role="alert">
                    {{ parseError }}
                </div>

                <div v-if="payload">
                    <p>
                        {{
                            $t("configFileLoaded", {
                                file: fileName,
                                monitors: payload.monitors.length,
                                notifications: payload.notifications.length,
                            })
                        }}
                    </p>

                    <div class="form-check">
                        <input
                            id="import-mode-merge"
                            v-model="mode"
                            class="form-check-input"
                            type="radio"
                            value="merge"
                        />
                        <label class="form-check-label" for="import-mode-merge">
                            {{ $t("importModeMerge") }}
                        </label>
                        <div class="form-text">{{ $t("importModeMergeDescription") }}</div>
                    </div>

                    <div class="form-check mt-2">
                        <input
                            id="import-mode-replace"
                            v-model="mode"
                            class="form-check-input"
                            type="radio"
                            value="replace"
                        />
                        <label class="form-check-label" for="import-mode-replace">
                            {{ $t("importModeReplace") }}
                        </label>
                        <div class="form-text">{{ $t("importModeReplaceDescription") }}</div>
                    </div>

                    <div v-if="mode === 'replace'" class="alert alert-danger mt-3" role="alert">
                        {{ $t("importModeReplaceWarning") }}
                    </div>

                    <button class="btn btn-primary mt-3" type="button" :disabled="importing" @click="startImport">
                        {{ importing ? $t("Processing...") : $t("Import") }}
                    </button>
                </div>

                <div v-if="result" class="mt-4">
                    <h6>{{ $t("importResult") }}</h6>
                    <ul class="list-group">
                        <li class="list-group-item">
                            {{ $t("monitorsImported", { count: result.monitors.imported }) }}
                        </li>
                        <li class="list-group-item">
                            {{ $t("notificationsImported", { count: result.notifications.imported }) }}
                        </li>
                        <li v-if="result.monitors.skipped + result.notifications.skipped > 0" class="list-group-item">
                            {{ $t("itemsSkipped", { count: result.monitors.skipped + result.notifications.skipped }) }}
                        </li>
                    </ul>

                    <div v-if="result.warnings.length > 0" class="alert alert-warning mt-3" role="alert">
                        <strong>{{ $t("importWarnings") }}</strong>
                        <ul class="mb-0 mt-2">
                            <li v-for="(warning, index) in result.warnings" :key="index">
                                {{ warning }}
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>

        <Confirm
            ref="confirmReplace"
            btn-style="btn-danger"
            :yes-text="$t('Import')"
            :no-text="$t('Cancel')"
            @yes="doImport"
        >
            {{ $t("importModeReplaceConfirm") }}

            <div v-if="settings && !settings.disableAuth" class="mt-3">
                <label for="import-current-password" class="form-label">
                    {{ $t("Current Password") }}
                </label>
                <input
                    id="import-current-password"
                    v-model="currentPassword"
                    type="password"
                    class="form-control"
                    autocomplete="current-password"
                />
            </div>
        </Confirm>
    </div>
</template>

<script>
import Confirm from "../Confirm.vue";

const CONFIG_FORMAT = "uptime-kuma-config";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default {
    components: {
        Confirm,
    },
    data() {
        return {
            exporting: false,
            importing: false,
            fileName: "",
            payload: null,
            parseError: "",
            mode: "merge",
            currentPassword: "",
            result: null,
        };
    },
    computed: {
        settings() {
            return this.$parent.$parent.$parent.settings;
        },
        isAdmin() {
            const role = this.$root.role;
            return !role || role === "admin";
        },
    },
    methods: {
        /**
         * Ask the server for an export and download it as a JSON file
         * @returns {void}
         */
        exportConfig() {
            this.exporting = true;

            this.$root.getSocket().emit("exportConfig", (res) => {
                this.exporting = false;

                if (!res.ok) {
                    this.$root.toastError(res.msg);
                    return;
                }

                const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
                const blob = new Blob([JSON.stringify(res.data, null, 4)], {
                    type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `uptime-kuma-config-${timestamp}.json`;
                link.click();
                URL.revokeObjectURL(url);
            });
        },

        /**
         * Read and validate the selected file
         * @param {Event} event File input change event
         * @returns {Promise<void>}
         */
        async onFileSelected(event) {
            this.parseError = "";
            this.result = null;
            this.payload = null;
            this.fileName = "";

            const file = event.target.files[0];
            if (!file) {
                return;
            }

            if (file.size > MAX_FILE_SIZE) {
                this.parseError = this.$t("configFileTooLarge");
                return;
            }

            let data;
            try {
                data = JSON.parse(await file.text());
            } catch (e) {
                this.parseError = this.$t("invalidConfigFile");
                return;
            }

            if (
                !data ||
                typeof data !== "object" ||
                data.format !== CONFIG_FORMAT ||
                !Array.isArray(data.monitors) ||
                !Array.isArray(data.notifications)
            ) {
                this.parseError = this.$t("invalidConfigFile");
                return;
            }

            this.fileName = file.name;
            this.payload = data;
            this.mode = "merge";
            this.currentPassword = "";
        },

        /**
         * Import directly or ask for confirmation/password first
         * @returns {void}
         */
        startImport() {
            if (!this.payload) {
                return;
            }

            if (this.mode === "replace") {
                this.$refs.confirmReplace.show();
            } else {
                this.doImport();
            }
        },

        /**
         * Send the selected file to the server
         * @returns {void}
         */
        doImport() {
            if (!this.payload) {
                return;
            }

            this.importing = true;

            this.$root
                .getSocket()
                .emit(
                    "importConfig",
                    this.payload,
                    { mode: this.mode, currentPassword: this.currentPassword },
                    (res) => {
                        this.importing = false;
                        this.currentPassword = "";
                        this.$root.toastRes(res);

                        if (!res.ok) {
                            return;
                        }

                        this.result = res.data;
                        this.payload = null;
                        this.fileName = "";
                        this.$refs.fileInput.value = "";
                    }
                );
        },
    },
};
</script>
