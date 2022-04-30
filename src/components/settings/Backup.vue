<template>
    <div>
        <div class="my-4">
            <h4 class="mt-4 mb-2">{{ $t("Export Backup") }}</h4>

            <p>
                {{ $t("backupDescription") }} <br />
                ({{ $t("backupDescription2") }}) <br />
            </p>

            <div class="mb-2">
                <button class="btn btn-primary" @click="downloadBackup">
                    {{ $t("Export") }}
                </button>
            </div>

            <p>
                <strong>{{ $t("backupDescription3") }}</strong>
            </p>
        </div>

        <div class="my-4">
            <h4 class="mt-4 mb-2">{{ $t("Import Backup") }}</h4>

            <label class="form-label">{{ $t("Options") }}:</label>
            <br />
            <div class="form-check form-check-inline">
                <input
                    id="radioKeep"
                    v-model="importHandle"
                    class="form-check-input"
                    type="radio"
                    name="radioImportHandle"
                    value="keep"
                />
                <label class="form-check-label" for="radioKeep">
                    {{ $t("Keep both") }}
                </label>
            </div>
            <div class="form-check form-check-inline">
                <input
                    id="radioSkip"
                    v-model="importHandle"
                    class="form-check-input"
                    type="radio"
                    name="radioImportHandle"
                    value="skip"
                />
                <label class="form-check-label" for="radioSkip">
                    {{ $t("Skip existing") }}
                </label>
            </div>
            <div class="form-check form-check-inline">
                <input
                    id="radioOverwrite"
                    v-model="importHandle"
                    class="form-check-input"
                    type="radio"
                    name="radioImportHandle"
                    value="overwrite"
                />
                <label class="form-check-label" for="radioOverwrite">
                    {{ $t("Overwrite") }}
                </label>
            </div>
            <div class="form-text mb-2">
                {{ $t("importHandleDescription") }}
            </div>

            <div class="mb-2">
                <input
                    id="import-backend"
                    type="file"
                    class="form-control"
                    accept="application/json"
                />
            </div>

            <div class="input-group mb-2 justify-content-end">
                <button
                    type="button"
                    class="btn btn-outline-primary"
                    :disabled="processing"
                    @click="confirmImport"
                >
                    <div
                        v-if="processing"
                        class="spinner-border spinner-border-sm me-1"
                    ></div>
                    {{ $t("Import") }}
                </button>
            </div>

            <div
                v-if="importAlert"
                class="alert alert-danger mt-3"
                style="padding: 6px 16px;"
            >
                {{ importAlert }}
            </div>
        </div>

        <Confirm
            ref="confirmImport"
            btn-style="btn-danger"
            :yes-text="$t('Yes')"
            :no-text="$t('No')"
            @yes="importBackup"
        >
            {{ $t("confirmImportMsg") }}
        </Confirm>
    </div>
</template>

<script>
import Confirm from "../../components/Confirm.vue";
import dayjs from "dayjs";
import { useToast } from "vue-toastification";

const toast = useToast();

export default {
    components: {
        Confirm,
    },

    data() {
        return {
            processing: false,
            importHandle: "skip",
            importAlert: null,
        };
    },

    methods: {
        confirmImport() {
            this.$refs.confirmImport.show();
        },

        downloadBackup() {
            let time = dayjs().format("YYYY_MM_DD-hh_mm_ss");
            let fileName = `Uptime_Kuma_Backup_${time}.json`;
            let monitorList = Object.values(this.$root.monitorList);
            let exportData = {
                version: this.$root.info.version,
                notificationList: this.$root.notificationList,
                monitorList: monitorList,
            };
            exportData = JSON.stringify(exportData, null, 4);
            let downloadItem = document.createElement("a");
            downloadItem.setAttribute(
                "href",
                "data:application/json;charset=utf-8," +
                    encodeURIComponent(exportData)
            );
            downloadItem.setAttribute("download", fileName);
            downloadItem.click();
        },

        importBackup() {
            this.processing = true;
            let uploadItem = document.getElementById("import-backend").files;

            if (uploadItem.length <= 0) {
                this.processing = false;
                return (this.importAlert = this.$t("alertNoFile"));
            }

            if (uploadItem.item(0).type !== "application/json") {
                this.processing = false;
                return (this.importAlert = this.$t("alertWrongFileType"));
            }

            let fileReader = new FileReader();
            fileReader.readAsText(uploadItem.item(0));

            fileReader.onload = (item) => {
                this.$root.uploadBackup(
                    item.target.result,
                    this.importHandle,
                    (res) => {
                        this.processing = false;

                        if (res.ok) {
                            toast.success(res.msg);
                        } else {
                            toast.error(res.msg);
                        }
                    }
                );
            };
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../../assets/vars.scss";

.dark {
    #import-backend {
        &::file-selector-button {
            color: $primary;
            background-color: $dark-bg;
        }

        &:hover:not(:disabled):not([readonly])::file-selector-button {
            color: $dark-font-color2;
            background-color: $primary;
        }
    }
}
</style>
