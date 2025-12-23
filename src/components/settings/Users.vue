<template>
    <div>
        <h5 class="my-4 settings-subheading">{{ $t("User Management") }}</h5>
        
        <div class="mb-3">
            <button class="btn btn-primary" @click="showAddDialog">
                <font-awesome-icon icon="plus" /> {{ $t("Add User") }}
            </button>
        </div>

        <div v-if="loading" class="text-center my-3">
            <div class="spinner-border" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>

        <div v-else-if="users.length === 0" class="alert alert-info">
            {{ $t("No users") }}
        </div>

        <div v-else class="table-responsive">
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>{{ $t("Username") }}</th>
                        <th>{{ $t("Role") }}</th>
                        <th>{{ $t("Status") }}</th>
                        <th>{{ $t("Actions") }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="user in users" :key="user.id">
                        <td>{{ user.username }}</td>
                        <td>
                            <span v-if="user.role === 'admin'" class="badge bg-danger">{{ $t("Admin") }}</span>
                            <span v-else-if="user.role === 'readonly'" class="badge bg-secondary">{{ $t("Read Only") }}</span>
                            <span v-else class="badge bg-primary">{{ $t("User") }}</span>
                        </td>
                        <td>
                            <span v-if="user.active" class="badge bg-success">{{ $t("Active") }}</span>
                            <span v-else class="badge bg-secondary">{{ $t("Inactive") }}</span>
                        </td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary me-2" @click="showEditDialog(user)">
                                <font-awesome-icon icon="edit" /> {{ $t("Edit") }}
                            </button>
                            <button class="btn btn-sm btn-outline-danger" @click="confirmDelete(user)">
                                <font-awesome-icon icon="trash" /> {{ $t("Delete") }}
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Add/Edit User Dialog -->
        <div class="modal fade" :class="{ show: showDialog }" :style="{ display: showDialog ? 'block' : 'none' }" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            {{ editMode ? $t("Edit User") : $t("Add User") }}
                        </h5>
                        <button type="button" class="btn-close" @click="closeDialog"></button>
                    </div>
                    <div class="modal-body">
                        <form @submit.prevent="saveUser">
                            <div class="mb-3">
                                <label for="username" class="form-label">{{ $t("Username") }}</label>
                                <input
                                    id="username"
                                    v-model="formData.username"
                                    type="text"
                                    class="form-control"
                                    required
                                />
                            </div>

                            <div class="mb-3">
                                <label for="password" class="form-label">
                                    {{ editMode ? $t("New Password") : $t("Password") }}
                                    {{ editMode ? $t("(Leave blank to keep current)") : "" }}
                                </label>
                                <input
                                    id="password"
                                    v-model="formData.password"
                                    type="password"
                                    class="form-control"
                                    :required="!editMode"
                                />
                            </div>

                            <div class="mb-3">
                                <label for="role" class="form-label">{{ $t("Role") }}</label>
                                <select
                                    id="role"
                                    v-model="formData.role"
                                    class="form-select"
                                    required
                                >
                                    <option value="user">{{ $t("User") }}</option>
                                    <option value="admin">{{ $t("Admin") }}</option>
                                    <option value="readonly">{{ $t("Read Only") }}</option>
                                </select>
                            </div>

                            <div v-if="editMode" class="mb-3 form-check">
                                <input
                                    id="active"
                                    v-model="formData.active"
                                    type="checkbox"
                                    class="form-check-input"
                                />
                                <label class="form-check-label" for="active">
                                    {{ $t("Active") }}
                                </label>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" @click="closeDialog">
                            {{ $t("Cancel") }}
                        </button>
                        <button type="button" class="btn btn-primary" @click="saveUser">
                            {{ $t("Save") }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <div v-if="showDialog" class="modal-backdrop fade show"></div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            users: [],
            loading: false,
            showDialog: false,
            editMode: false,
            formData: {
                id: null,
                username: "",
                password: "",
                role: "user",
                active: true,
            },
        };
    },

    mounted() {
        this.loadUsers();
    },

    methods: {
        /**
         * Load all users from the server
         * @returns {void}
         */
        loadUsers() {
            this.loading = true;
            this.$root.getSocket().emit("getUsers", (res) => {
                this.loading = false;
                if (res.ok) {
                    this.users = res.users;
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },

        /**
         * Show dialog to add a new user
         * @returns {void}
         */
        showAddDialog() {
            this.editMode = false;
            this.formData = {
                id: null,
                username: "",
                password: "",
                role: "user",
                active: true,
            };
            this.showDialog = true;
        },

        /**
         * Show dialog to edit an existing user
         * @param {object} user User object to edit
         * @returns {void}
         */
        showEditDialog(user) {
            this.editMode = true;
            this.formData = {
                id: user.id,
                username: user.username,
                password: "",
                role: user.role,
                active: user.active === 1,
            };
            this.showDialog = true;
        },

        /**
         * Close the add/edit dialog
         * @returns {void}
         */
        closeDialog() {
            this.showDialog = false;
        },

        /**
         * Save the user (add or update)
         * @returns {void}
         */
        saveUser() {
            if (this.editMode) {
                const updateData = {
                    username: this.formData.username,
                    role: this.formData.role,
                    active: this.formData.active,
                };
                
                if (this.formData.password) {
                    updateData.password = this.formData.password;
                }

                this.$root.getSocket().emit("updateUser", this.formData.id, updateData, (res) => {
                    if (res.ok) {
                        this.$root.toastSuccess(res.msg);
                        this.closeDialog();
                        this.loadUsers();
                    } else {
                        this.$root.toastError(res.msg);
                    }
                });
            } else {
                this.$root.getSocket().emit("addUser", this.formData, (res) => {
                    if (res.ok) {
                        this.$root.toastSuccess(res.msg);
                        this.closeDialog();
                        this.loadUsers();
                    } else {
                        this.$root.toastError(res.msg);
                    }
                });
            }
        },

        /**
         * Confirm and delete a user
         * @param {object} user User object to delete
         * @returns {void}
         */
        confirmDelete(user) {
            if (confirm(this.$t("Are you sure you want to delete this user?"))) {
                this.$root.getSocket().emit("deleteUser", user.id, (res) => {
                    if (res.ok) {
                        this.$root.toastSuccess(res.msg);
                        this.loadUsers();
                    } else {
                        this.$root.toastError(res.msg);
                    }
                });
            }
        },
    },
};
</script>

<style lang="scss" scoped>
.modal.show {
    display: block;
}

.settings-subheading {
    font-weight: 600;
}
</style>
