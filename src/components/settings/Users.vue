<template>
    <div>
        <div class="my-4 d-flex justify-content-between align-items-center">
            <h5 class="settings-subheading mb-0">{{ $t("Users") }}</h5>
            <button class="btn btn-primary btn-sm" @click="openAddModal">
                <font-awesome-icon icon="plus" />
                {{ $t("Add User") }}
            </button>
        </div>

        <div v-if="loading" class="text-center my-4">
            <div class="spinner-border spinner-border-sm" role="status"></div>
        </div>

        <div v-else>
            <p v-if="userList.length === 0" class="text-muted text-center my-3">{{ $t("No users found.") }}</p>

            <div
                v-for="user in userList"
                :key="user.id"
                class="user-item d-flex align-items-center justify-content-between px-3 py-2 mb-2 rounded"
            >
                <div class="d-flex align-items-center gap-3">
                    <div class="user-avatar">{{ user.username.charAt(0).toUpperCase() }}</div>
                    <div>
                        <div class="fw-bold">{{ user.username }}</div>
                        <div class="small text-muted">{{ user.admin ? $t("Admin") : $t("Member") }}</div>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span :class="user.active ? 'badge bg-success' : 'badge bg-secondary'">
                        {{ user.active ? $t("Active") : $t("Inactive") }}
                    </span>
                    <button
                        class="btn btn-sm btn-outline-secondary"
                        :disabled="user.admin"
                        @click="openEditModal(user)"
                    >
                        {{ $t("Edit") }}
                    </button>
                    <button
                        class="btn btn-sm btn-outline-danger"
                        :disabled="user.admin"
                        @click="confirmDelete(user)"
                    >
                        {{ $t("Delete") }}
                    </button>
                </div>
            </div>
        </div>

        <!-- Add User Modal -->
        <div ref="addModal" class="modal fade" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">{{ $t("Add User") }}</h5>
                        <button type="button" class="btn-close" :aria-label="$t('Close')" @click="closeAddModal" />
                    </div>
                    <div class="modal-body">
                        <form id="add-user-form" @submit.prevent="addUser">
                            <div class="mb-3">
                                <label class="form-label">{{ $t("Username") }}</label>
                                <input
                                    v-model="addForm.username"
                                    type="text"
                                    class="form-control"
                                    required
                                    autocomplete="off"
                                />
                            </div>
                            <div class="mb-3 form-check">
                                <input
                                    id="add-user-active"
                                    v-model="addForm.active"
                                    type="checkbox"
                                    class="form-check-input"
                                />
                                <label class="form-check-label" for="add-user-active">{{ $t("Active") }}</label>
                            </div>
                            <p class="text-muted small mb-0">
                                <font-awesome-icon icon="info-circle" />
                                {{ $t("A temporary password will be generated. The user will be required to change it on first login.") }}
                            </p>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="submit" form="add-user-form" class="btn btn-primary">{{ $t("Create User") }}</button>
                        <button type="button" class="btn btn-secondary" @click="closeAddModal">{{ $t("Cancel") }}</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Generated Password Modal -->
        <div ref="passwordModal" class="modal fade" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">{{ $t("User Created") }}</h5>
                    </div>
                    <div class="modal-body">
                        <p>{{ $t("Share this temporary password with the user. They will be required to change it on first login.") }}</p>
                        <div class="input-group">
                            <input
                                ref="tempPasswordInput"
                                :value="generatedPassword"
                                type="text"
                                class="form-control font-monospace"
                                readonly
                            />
                            <button class="btn btn-outline-secondary" type="button" @click="copyPassword">
                                <font-awesome-icon :icon="copied ? 'check' : 'copy'" />
                            </button>
                        </div>
                        <div v-if="copied" class="text-success small mt-1">{{ $t("Copied to clipboard") }}</div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" @click="closePasswordModal">{{ $t("Done") }}</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Edit User Modal -->
        <div ref="editModal" class="modal fade" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">{{ $t("Edit User") }}</h5>
                        <button type="button" class="btn-close" :aria-label="$t('Close')" @click="closeEditModal" />
                    </div>
                    <div class="modal-body">
                        <form id="edit-user-form" @submit.prevent="saveEdit">
                            <div class="mb-3">
                                <label class="form-label">{{ $t("Username") }}</label>
                                <input
                                    v-model="editForm.username"
                                    type="text"
                                    class="form-control"
                                    required
                                    autocomplete="off"
                                />
                            </div>
                            <div class="mb-3 form-check">
                                <input
                                    id="edit-user-active"
                                    v-model="editForm.active"
                                    type="checkbox"
                                    class="form-check-input"
                                />
                                <label class="form-check-label" for="edit-user-active">{{ $t("Active") }}</label>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="submit" form="edit-user-form" class="btn btn-primary">{{ $t("Save") }}</button>
                        <button type="button" class="btn btn-secondary" @click="closeEditModal">{{ $t("Cancel") }}</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Confirm Delete -->
        <Confirm ref="confirmDeleteModal" :yes-text="$t('Delete')" btn-style="btn-danger" @yes="doDelete">
            {{ $t("confirmDeleteUser", { username: deleteTarget ? deleteTarget.username : "" }) }}
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
            userList: [],
            addModalInstance: null,
            passwordModalInstance: null,
            editModalInstance: null,
            editTarget: null,
            deleteTarget: null,
            generatedPassword: "",
            copied: false,
            addForm: { username: "", active: true },
            editForm: { username: "", active: true },
        };
    },

    mounted() {
        this.addModalInstance = new Modal(this.$refs.addModal);
        this.passwordModalInstance = new Modal(this.$refs.passwordModal);
        this.editModalInstance = new Modal(this.$refs.editModal);
        this.loadUsers();
    },

    methods: {
        loadUsers() {
            this.loading = true;
            this.$root.getSocket().emit("getUserList", (res) => {
                this.loading = false;
                if (res.ok) {
                    this.userList = res.userList;
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },

        openAddModal() {
            this.addForm = { username: "", active: true };
            this.addModalInstance.show();
        },

        closeAddModal() {
            this.addModalInstance.hide();
        },

        addUser() {
            this.$root.getSocket().emit("addUser", this.addForm, (res) => {
                if (res.ok) {
                    this.closeAddModal();
                    this.generatedPassword = res.tempPassword;
                    this.copied = false;
                    this.passwordModalInstance.show();
                    this.loadUsers();
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },

        copyPassword() {
            navigator.clipboard.writeText(this.generatedPassword).then(() => {
                this.copied = true;
                setTimeout(() => {
                    this.copied = false;
                }, 2000);
            });
        },

        closePasswordModal() {
            this.passwordModalInstance.hide();
        },

        openEditModal(user) {
            this.editTarget = user;
            this.editForm = { username: user.username, active: !!user.active };
            this.editModalInstance.show();
        },

        closeEditModal() {
            this.editModalInstance.hide();
        },

        saveEdit() {
            const data = { id: this.editTarget.id, username: this.editForm.username, active: this.editForm.active };
            this.$root.getSocket().emit("editUser", data, (res) => {
                this.$root.toastRes(res);
                if (res.ok) {
                    this.closeEditModal();
                    this.loadUsers();
                }
            });
        },

        confirmDelete(user) {
            this.deleteTarget = user;
            this.$refs.confirmDeleteModal.show();
        },

        doDelete() {
            this.$root.getSocket().emit("deleteUser", this.deleteTarget.id, (res) => {
                this.$root.toastRes(res);
                if (res.ok) {
                    this.loadUsers();
                }
            });
        },
    },
};
</script>

<style scoped>
.user-item {
    border: 1px solid rgba(0, 0, 0, 0.1);
    transition: background-color 0.15s;
}

.dark .user-item {
    border-color: rgba(255, 255, 255, 0.1);
}

.user-item:hover {
    background-color: rgba(0, 0, 0, 0.03);
}

.dark .user-item:hover {
    background-color: rgba(255, 255, 255, 0.05);
}

.user-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background-color: var(--bs-primary);
    color: white;
    font-weight: bold;
    font-size: 14px;
    flex-shrink: 0;
}
</style>
