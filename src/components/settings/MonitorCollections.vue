<template>
    <div>
        <div class="my-4 d-flex justify-content-between align-items-center">
            <h5 class="settings-subheading mb-0">{{ $t("Monitor Collections") }}</h5>
            <button v-if="$root.isAdmin" class="btn btn-primary btn-sm" @click="openAddModal">
                <font-awesome-icon icon="plus" />
                {{ $t("Add Collection") }}
            </button>
        </div>

        <div v-if="loading" class="text-center my-4">
            <div class="spinner-border spinner-border-sm" role="status"></div>
        </div>

        <div v-else>
            <p v-if="collections.length === 0" class="text-muted text-center my-3">{{ $t("No collections found.") }}</p>

            <div v-for="col in collections" :key="col.id" class="group-card mb-3 p-3">
                <!-- Collection Header -->
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <div>
                        <div class="fw-bold fs-6">{{ col.name }}</div>
                        <div v-if="col.description" class="text-muted small">{{ col.description }}</div>
                        <div class="text-muted small mt-1">
                            {{ col.monitorCount }} {{ $t("monitors") }} &middot; {{ col.groupCount }} {{ $t("owning groups") }}
                        </div>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-secondary" @click="openEditModal(col)">
                            {{ $t("Edit") }}
                        </button>
                        <button v-if="$root.isAdmin" class="btn btn-sm btn-outline-danger" @click="confirmDelete(col)">
                            {{ $t("Delete") }}
                        </button>
                    </div>
                </div>

                <!-- Monitors -->
                <div class="mb-3">
                    <div class="small fw-semibold text-muted mb-2 text-uppercase" style="letter-spacing: 0.05em;">
                        {{ $t("Monitors") }}
                    </div>
                    <div class="d-flex flex-wrap gap-2 align-items-center">
                        <span
                            v-for="mon in collectionMonitors[col.id] || []"
                            :key="mon.id"
                            class="member-badge d-flex align-items-center gap-1"
                        >
                            {{ mon.name }}
                            <button
                                type="button"
                                class="btn-close"
                                style="font-size: 0.55em;"
                                @click="removeMonitor(col.id, mon.id)"
                            ></button>
                        </span>

                        <select
                            class="form-select form-select-sm add-member-select"
                            @change="addMonitor(col.id, $event)"
                        >
                            <option value="">+ {{ $t("Add monitor") }}</option>
                            <option v-for="mon in availableMonitors(col.id)" :key="mon.id" :value="mon.id">
                                {{ mon.name }}
                            </option>
                        </select>
                    </div>
                </div>

                <!-- Owning User Groups (admin only) -->
                <div v-if="$root.isAdmin">
                    <div class="small fw-semibold text-muted mb-2 text-uppercase" style="letter-spacing: 0.05em;">
                        {{ $t("Owning Groups") }}
                    </div>
                    <div class="d-flex flex-wrap gap-2 align-items-center">
                        <span
                            v-for="grp in collectionGroups[col.id] || []"
                            :key="grp.id"
                            class="member-badge d-flex align-items-center gap-1"
                        >
                            {{ grp.name }}
                            <button
                                type="button"
                                class="btn-close"
                                style="font-size: 0.55em;"
                                @click="removeGroup(col.id, grp.id)"
                            ></button>
                        </span>

                        <select
                            class="form-select form-select-sm add-member-select"
                            @change="addGroup(col.id, $event)"
                        >
                            <option value="">+ {{ $t("Add group") }}</option>
                            <option v-for="grp in availableGroups(col.id)" :key="grp.id" :value="grp.id">
                                {{ grp.name }}
                            </option>
                        </select>
                    </div>
                </div>
            </div>
        </div>

        <!-- Add/Edit Collection Modal -->
        <div ref="collectionModal" class="modal fade" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">{{ editCollection ? $t("Edit Collection") : $t("Add Collection") }}</h5>
                        <button type="button" class="btn-close" :aria-label="$t('Close')" @click="closeModal" />
                    </div>
                    <div class="modal-body">
                        <form id="collection-form" @submit.prevent="saveCollection">
                            <div class="mb-3">
                                <label class="form-label">{{ $t("Name") }}</label>
                                <input v-model="form.name" type="text" class="form-control" required />
                            </div>
                            <div class="mb-3">
                                <label class="form-label">{{ $t("Description") }}</label>
                                <input v-model="form.description" type="text" class="form-control" />
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="submit" form="collection-form" class="btn btn-primary">{{ $t("Save") }}</button>
                        <button type="button" class="btn btn-secondary" @click="closeModal">{{ $t("Cancel") }}</button>
                    </div>
                </div>
            </div>
        </div>

        <Confirm ref="confirmDeleteRef" :yes-text="$t('Delete')" btn-style="btn-danger" @yes="doDelete">
            {{ $t("confirmDeleteCollection", { name: deleteTarget ? deleteTarget.name : "" }) }}
        </Confirm>
    </div>
</template>

<script>
import { Modal } from "bootstrap";
import Confirm from "../Confirm.vue";

export default {
    components: { Confirm },

    data() {
        return {
            loading: false,
            collections: [],
            collectionMonitors: {},
            collectionGroups: {},
            allMonitors: [],
            allGroups: [],
            modalInstance: null,
            editCollection: null,
            deleteTarget: null,
            form: { name: "", description: "" },
        };
    },

    mounted() {
        this.modalInstance = new Modal(this.$refs.collectionModal);
        this.loadAll();
    },

    methods: {
        loadAll() {
            this.loading = true;
            this.$root.getSocket().emit("getMonitorCollections", (res) => {
                this.loading = false;
                if (res.ok) {
                    this.collections = res.collections;
                    for (const col of this.collections) {
                        this.loadCollectionMonitors(col.id);
                        if (this.$root.isAdmin) {
                            this.loadCollectionGroups(col.id);
                        }
                    }
                } else {
                    this.$root.toastError(res.msg);
                }
            });

            // All monitors for the "Add monitor" picker
            this.allMonitors = Object.values(this.$root.monitorList || {}).map((m) => ({
                id: m.id,
                name: m.name,
            })).sort((a, b) => a.name.localeCompare(b.name));

            // All user groups for the "Add group" picker (admin only)
            if (this.$root.isAdmin) {
                this.$root.getSocket().emit("getUserGroupList", (res) => {
                    if (res.ok) {
                        this.allGroups = res.groupList;
                    }
                });
            }
        },

        loadCollectionMonitors(collectionID) {
            this.$root.getSocket().emit("getCollectionMonitors", collectionID, (res) => {
                if (res.ok) {
                    this.collectionMonitors = { ...this.collectionMonitors, [collectionID]: res.monitors };
                }
            });
        },

        loadCollectionGroups(collectionID) {
            this.$root.getSocket().emit("getCollectionUserGroups", collectionID, (res) => {
                if (res.ok) {
                    this.collectionGroups = { ...this.collectionGroups, [collectionID]: res.groups };
                }
            });
        },

        availableMonitors(collectionID) {
            const inCollection = new Set((this.collectionMonitors[collectionID] || []).map((m) => m.id));
            return this.allMonitors.filter((m) => !inCollection.has(m.id));
        },

        availableGroups(collectionID) {
            const inCollection = new Set((this.collectionGroups[collectionID] || []).map((g) => g.id));
            return this.allGroups.filter((g) => !inCollection.has(g.id));
        },

        addMonitor(collectionID, event) {
            const monitorID = parseInt(event.target.value);
            if (!monitorID) {
                return;
            }
            event.target.value = "";
            this.$root.getSocket().emit("addMonitorToCollection", { collectionID, monitorID }, (res) => {
                if (res.ok) {
                    this.loadCollectionMonitors(collectionID);
                    this.updateCollectionCount(collectionID, "monitorCount", 1);
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },

        removeMonitor(collectionID, monitorID) {
            this.$root.getSocket().emit("removeMonitorFromCollection", { collectionID, monitorID }, (res) => {
                if (res.ok) {
                    this.loadCollectionMonitors(collectionID);
                    this.updateCollectionCount(collectionID, "monitorCount", -1);
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },

        addGroup(collectionID, event) {
            const groupID = parseInt(event.target.value);
            if (!groupID) {
                return;
            }
            event.target.value = "";
            const currentGroups = (this.collectionGroups[collectionID] || []).map((g) => g.id);
            const newGroups = [...currentGroups, groupID];
            this.$root.getSocket().emit("setCollectionUserGroups", { collectionID, groupIDs: newGroups }, (res) => {
                if (res.ok) {
                    this.loadCollectionGroups(collectionID);
                    this.updateCollectionCount(collectionID, "groupCount", 1);
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },

        removeGroup(collectionID, groupID) {
            const currentGroups = (this.collectionGroups[collectionID] || []).map((g) => g.id).filter((id) => id !== groupID);
            this.$root.getSocket().emit("setCollectionUserGroups", { collectionID, groupIDs: currentGroups }, (res) => {
                if (res.ok) {
                    this.loadCollectionGroups(collectionID);
                    this.updateCollectionCount(collectionID, "groupCount", -1);
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },

        updateCollectionCount(collectionID, field, delta) {
            const idx = this.collections.findIndex((c) => c.id === collectionID);
            if (idx !== -1) {
                this.collections[idx] = { ...this.collections[idx], [field]: (this.collections[idx][field] || 0) + delta };
            }
        },

        openAddModal() {
            this.editCollection = null;
            this.form = { name: "", description: "" };
            this.modalInstance.show();
        },

        openEditModal(col) {
            this.editCollection = col;
            this.form = { name: col.name, description: col.description || "" };
            this.modalInstance.show();
        },

        closeModal() {
            this.modalInstance.hide();
        },

        saveCollection() {
            if (this.editCollection) {
                this.$root.getSocket().emit("editMonitorCollection", { id: this.editCollection.id, ...this.form }, (res) => {
                    this.$root.toastRes(res);
                    if (res.ok) {
                        this.closeModal();
                        this.loadAll();
                    }
                });
            } else {
                this.$root.getSocket().emit("addMonitorCollection", this.form, (res) => {
                    this.$root.toastRes(res);
                    if (res.ok) {
                        this.closeModal();
                        this.loadAll();
                    }
                });
            }
        },

        confirmDelete(col) {
            this.deleteTarget = col;
            this.$refs.confirmDeleteRef.show();
        },

        doDelete() {
            this.$root.getSocket().emit("deleteMonitorCollection", this.deleteTarget.id, (res) => {
                this.$root.toastRes(res);
                if (res.ok) {
                    this.loadAll();
                }
            });
        },
    },
};
</script>

<style scoped>
.group-card {
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 8px;
}

.dark .group-card {
    border-color: rgba(255, 255, 255, 0.12);
}

.member-badge {
    background-color: rgba(0, 0, 0, 0.08);
    padding: 3px 8px 3px 10px;
    border-radius: 20px;
    font-size: 0.82rem;
}

.dark .member-badge {
    background-color: rgba(255, 255, 255, 0.1);
}

.add-member-select {
    width: auto;
    min-width: 140px;
    border-radius: 20px;
    font-size: 0.82rem;
}
</style>
