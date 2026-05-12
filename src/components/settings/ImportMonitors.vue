<template>
    <div class="import-monitors">
        <div class="mb-3">
            <label for="kumaBackupFile" class="form-label">Uptime Kuma JSON export</label>
            <input
                id="kumaBackupFile"
                class="form-control"
                type="file"
                accept="application/json,.json"
                @change="readBackupFile"
            />
        </div>

        <div class="mb-3">
            <label for="kumaBackupJson" class="form-label">Backup JSON</label>
            <textarea
                id="kumaBackupJson"
                v-model="backupJSON"
                class="form-control font-monospace"
                rows="10"
                spellcheck="false"
            />
        </div>

        <div class="mb-3">
            <label for="importHandle" class="form-label">Existing monitors</label>
            <select id="importHandle" v-model="importHandle" class="form-select">
                <option value="skip">Skip existing names</option>
                <option value="overwrite">Replace existing names</option>
            </select>
        </div>

        <div class="d-flex gap-2 align-items-center">
            <button
                class="btn btn-primary"
                type="button"
                :disabled="importing || !backupJSON.trim()"
                @click="importBackup"
            >
                <span v-if="importing" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                Import
            </button>
            <button class="btn btn-outline-secondary" type="button" :disabled="importing || !backupJSON" @click="clearForm">
                Clear
            </button>
        </div>

        <div v-if="result" class="mt-4">
            <div class="alert" :class="result.ok ? 'alert-success' : 'alert-warning'">
                Imported {{ result.imported }} of {{ result.total }} monitors.
                <span v-if="result.overwritten">Replaced {{ result.overwritten }}.</span>
                <span v-if="result.skipped">Skipped {{ result.skipped }} existing.</span>
                <span v-if="result.unsupported">Unsupported {{ result.unsupported }}.</span>
                <span v-if="result.failed">Failed {{ result.failed }}.</span>
            </div>

            <div v-if="result.results && result.results.length" class="table-responsive">
                <table class="table table-sm align-middle">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Reason</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="item in result.results" :key="`${item.name}-${item.type}-${item.status}`">
                            <td>{{ item.name || "(unnamed)" }}</td>
                            <td>{{ item.type || "unknown" }}</td>
                            <td>{{ item.status }}</td>
                            <td>{{ item.reason || "" }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            backupJSON: "",
            importHandle: "skip",
            importing: false,
            result: null,
        };
    },

    methods: {
        readBackupFile(event) {
            const file = event.target.files?.[0];
            if (!file) {
                return;
            }

            const reader = new FileReader();
            reader.onload = () => {
                this.backupJSON = String(reader.result || "");
                this.result = null;
            };
            reader.onerror = () => {
                this.$root.toastError("Unable to read backup file.");
            };
            reader.readAsText(file);
        },

        async importBackup() {
            if (!this.backupJSON.trim()) {
                return;
            }

            if (this.importHandle === "overwrite" && !window.confirm("Replace existing monitors with matching names?")) {
                return;
            }

            this.importing = true;
            this.result = null;
            this.$root.uploadBackup(this.backupJSON, this.importHandle, (res) => {
                this.importing = false;
                this.$root.toastRes(res);
                if (res.ok) {
                    this.result = res;
                } else {
                    this.result = res;
                }
            });
        },

        clearForm() {
            this.backupJSON = "";
            this.result = null;
        },
    },
};
</script>

<style lang="scss" scoped>
.import-monitors {
    max-width: 900px;
}

textarea {
    min-height: 16rem;
}
</style>
