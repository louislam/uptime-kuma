<template>
    <div>
        <div class="my-4 d-flex justify-content-between align-items-center">
            <h5 class="settings-subheading mb-0">{{ $t("Groups") }}</h5>
            <button class="btn btn-primary btn-sm" @click="openAddGroupModal">
                <font-awesome-icon icon="plus" />
                {{ $t("Add Group") }}
            </button>
        </div>

        <div v-if="loading" class="text-center my-4">
            <div class="spinner-border spinner-border-sm" role="status"></div>
        </div>

        <div v-else>
            <p v-if="groupList.length === 0" class="text-muted text-center my-3">{{ $t("No groups found.") }}</p>

            <div v-for="group in groupList" :key="group.id" class="group-card mb-3 p-3">
                <!-- Group Header -->
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <div>
                        <div class="fw-bold fs-6">{{ group.name }}</div>
                        <div v-if="group.description" class="text-muted small">{{ group.description }}</div>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-secondary" @click="openEditGroupModal(group)">
                            {{ $t("Edit") }}
                        </button>
                        <button class="btn btn-sm btn-outline-danger" @click="confirmDeleteGroup(group)">
                            {{ $t("Delete") }}
                        </button>
                    </div>
                </div>

                <!-- Permissions as toggle switches -->
                <div class="mb-3">
                    <div class="small fw-semibold text-muted mb-2 text-uppercase" style="letter-spacing: 0.05em;">
                        {{ $t("Permissions") }}
                    </div>
                    <div class="d-flex flex-wrap gap-2">
                        <div
                            v-for="perm in allPermissions"
                            :key="perm.value"
                            class="perm-toggle"
                            :class="{ active: isPermActive(group.id, perm.value) }"
                            @click="togglePermission(group.id, perm.value)"
                        >
                            <span class="perm-indicator"></span>
                            {{ perm.label }}
                        </div>
                    </div>
                </div>

                <!-- Members -->
                <div>
                    <div class="small fw-semibold text-muted mb-2 text-uppercase" style="letter-spacing: 0.05em;">
                        {{ $t("Members") }}
                    </div>
                    <div class="d-flex flex-wrap gap-2 align-items-center">
                        <span
                            v-for="member in groupMembers[group.id] || []"
                            :key="member.id"
                            class="member-badge d-flex align-items-center gap-1"
                        >
                            {{ member.username }}
                            <button
                                type="button"
                                class="btn-close"
                                style="font-size: 0.55em;"
                                @click="removeMember(group.id, member.id)"
                            ></button>
                        </span>

                        <select
                            class="form-select form-select-sm add-member-select"
                            @change="addMember(group.id, $event)"
                        >
                            <option value="">+ {{ $t("Add member") }}</option>
                            <option v-for="user in availableUsers(group.id)" :key="user.id" :value="user.id">
                                {{ user.username }}
                            </option>
                        </select>
                    </div>
                </div>
            </div>
        </div>

        <!-- Add/Edit Group Modal -->
        <div ref="groupModal" class="modal fade" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">{{ editGroup ? $t("Edit Group") : $t("Add Group") }}</h5>
                        <button type="button" class="btn-close" :aria-label="$t('Close')" @click="closeGroupModal" />
                    </div>
                    <div class="modal-body">
                        <form id="group-form" @submit.prevent="saveGroup">
                            <div class="mb-3">
                                <label class="form-label">{{ $t("Name") }}</label>
                                <input v-model="groupForm.name" type="text" class="form-control" required />
                            </div>
                            <div class="mb-3">
                                <label class="form-label">{{ $t("Description") }}</label>
                                <input v-model="groupForm.description" type="text" class="form-control" />
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="submit" form="group-form" class="btn btn-primary">{{ $t("Save") }}</button>
                        <button type="button" class="btn btn-secondary" @click="closeGroupModal">{{ $t("Cancel") }}</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Confirm Delete Group -->
        <Confirm ref="confirmDelete" :yes-text="$t('Delete')" btn-style="btn-danger" @yes="doDeleteGroup">
            {{ $t("confirmDeleteGroup", { name: deleteTarget ? deleteTarget.name : "" }) }}
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
            groupList: [],
            allUsers: [],
            groupPermissions: {},
            groupMembers: {},
            groupModalInstance: null,
            editGroup: null,
            deleteTarget: null,
            groupForm: { name: "", description: "" },
            allPermissions: [
                { value: "view_only", label: this.$t("View Only") },
                { value: "create_monitor", label: this.$t("Create Monitor") },
                { value: "update_monitor", label: this.$t("Update Monitor") },
                { value: "delete_monitor", label: this.$t("Delete Monitor") },
                { value: "create_dashboard", label: this.$t("Create Status Page") },
                { value: "create_api_key", label: this.$t("Create API Key") },
                { value: "create_notification", label: this.$t("Create Notification") },
                { value: "manage_maintenance", label: this.$t("Manage Maintenance") },
                { value: "manage_tags", label: this.$t("Manage Tags") },
                { value: "manage_proxy", label: this.$t("Manage Proxy") },
                { value: "manage_monitor_collections", label: this.$t("Manage Monitor Collections") },
            ],
        };
    },

    mounted() {
        this.groupModalInstance = new Modal(this.$refs.groupModal);
        this.loadAll();
    },

    methods: {
        loadAll() {
            this.loading = true;
            this.$root.getSocket().emit("getUserGroupList", (res) => {
                if (res.ok) {
                    this.groupList = res.groupList;
                    for (const group of this.groupList) {
                        this.loadGroupPermissions(group.id);
                        this.loadGroupMembers(group.id);
                    }
                } else {
                    this.$root.toastError(res.msg);
                }
                this.loading = false;
            });
            this.$root.getSocket().emit("getUserList", (res) => {
                if (res.ok) {
                    this.allUsers = res.userList;
                }
            });
        },

        loadGroupPermissions(groupID) {
            this.$root.getSocket().emit("getGroupPermissions", groupID, (res) => {
                if (res.ok) {
                    this.groupPermissions = { ...this.groupPermissions, [groupID]: res.permissions };
                }
            });
        },

        loadGroupMembers(groupID) {
            this.$root.getSocket().emit("getUserGroupMembers", groupID, (res) => {
                if (res.ok) {
                    this.groupMembers = { ...this.groupMembers, [groupID]: res.members };
                }
            });
        },

        isPermActive(groupID, permission) {
            return !!(this.groupPermissions[groupID] && this.groupPermissions[groupID].includes(permission));
        },

        togglePermission(groupID, permission) {
            const current = (this.groupPermissions[groupID] || []).slice();
            const idx = current.indexOf(permission);
            if (idx === -1) {
                current.push(permission);
            } else {
                current.splice(idx, 1);
            }
            this.$root.getSocket().emit("setGroupPermissions", { groupID, permissions: current }, (res) => {
                if (res.ok) {
                    this.groupPermissions = { ...this.groupPermissions, [groupID]: current };
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },

        availableUsers(groupID) {
            const members = this.groupMembers[groupID] || [];
            const memberIds = new Set(members.map((m) => m.id));
            return this.allUsers.filter((u) => !memberIds.has(u.id) && !u.admin);
        },

        addMember(groupID, event) {
            const userID = parseInt(event.target.value);
            if (!userID) {
                return;
            }
            event.target.value = "";
            this.$root.getSocket().emit("addUserToGroup", { userID, groupID }, (res) => {
                if (res.ok) {
                    this.loadGroupMembers(groupID);
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },

        removeMember(groupID, userID) {
            this.$root.getSocket().emit("removeUserFromGroup", { userID, groupID }, (res) => {
                if (res.ok) {
                    this.loadGroupMembers(groupID);
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },

        openAddGroupModal() {
            this.editGroup = null;
            this.groupForm = { name: "", description: "" };
            this.groupModalInstance.show();
        },

        openEditGroupModal(group) {
            this.editGroup = group;
            this.groupForm = { name: group.name, description: group.description || "" };
            this.groupModalInstance.show();
        },

        closeGroupModal() {
            this.groupModalInstance.hide();
        },

        saveGroup() {
            if (this.editGroup) {
                this.$root.getSocket().emit("editUserGroup", { id: this.editGroup.id, ...this.groupForm }, (res) => {
                    this.$root.toastRes(res);
                    if (res.ok) {
                        this.closeGroupModal();
                        this.loadAll();
                    }
                });
            } else {
                this.$root.getSocket().emit("addUserGroup", this.groupForm, (res) => {
                    this.$root.toastRes(res);
                    if (res.ok) {
                        this.closeGroupModal();
                        this.loadAll();
                    }
                });
            }
        },

        confirmDeleteGroup(group) {
            this.deleteTarget = group;
            this.$refs.confirmDelete.show();
        },

        doDeleteGroup() {
            this.$root.getSocket().emit("deleteUserGroup", this.deleteTarget.id, (res) => {
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

/* Permission toggle pill buttons */
.perm-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px 4px 8px;
    border-radius: 20px;
    border: 1px solid rgba(0, 0, 0, 0.2);
    font-size: 0.82rem;
    cursor: pointer;
    user-select: none;
    transition: all 0.15s ease;
    background-color: transparent;
}

.dark .perm-toggle {
    border-color: rgba(255, 255, 255, 0.2);
}

.perm-toggle:hover {
    border-color: var(--bs-primary);
}

.perm-toggle.active {
    background-color: var(--bs-primary);
    border-color: var(--bs-primary);
    color: #fff;
}

.perm-indicator {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: rgba(0, 0, 0, 0.2);
    flex-shrink: 0;
    transition: background-color 0.15s;
}

.dark .perm-indicator {
    background-color: rgba(255, 255, 255, 0.3);
}

.perm-toggle.active .perm-indicator {
    background-color: rgba(255, 255, 255, 0.8);
}

/* Member badges */
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
