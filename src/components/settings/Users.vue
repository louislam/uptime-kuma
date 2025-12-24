<template>
    <div>
        <div class="add-btn">
            <button class="btn btn-primary me-2" type="button" @click="showAddDialog">
                <font-awesome-icon icon="plus" /> {{ $t("Add User") }}
            </button>
        </div>

        <div v-if="loading" class="text-center my-3">
            <div class="spinner-border" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>

        <div v-else>
            <span
                v-if="users.length === 0"
                class="d-flex align-items-center justify-content-center my-3"
            >
                {{ $t("No users") }}
            </span>

            <div
                v-for="user in users"
                :key="user.id"
                class="item"
                :class="user.active ? 'active' : 'inactive'"
            >
                <div class="left-part">
                    <div class="circle"></div>
                    <div class="info">
                        <div class="title">{{ user.username }}</div>
                        <div class="status">
                            {{ user.active ? $t("Active") : $t("Inactive") }}
                        </div>
                    </div>
                </div>

                <div class="buttons">
                    <div class="btn-group" role="group">
                        <button class="btn btn-normal" @click="showEditDialog(user)">
                            <font-awesome-icon icon="edit" /> {{ $t("Edit") }}
                        </button>

                        <button class="btn btn-danger" @click="deleteDialog(user.id)">
                            <font-awesome-icon icon="trash" /> {{ $t("Delete") }}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <Confirm ref="confirmDelete" btn-style="btn-danger" :yes-text="$t('Yes')" :no-text="$t('No')" @yes="deleteUser">
            {{ $t("deleteUserWarning") }}
        </Confirm>

        <!-- Add/Edit User Dialog -->
        <div ref="userDialog" class="modal fade" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            {{ editMode ? $t("Edit User") : $t("Add User") }}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
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
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            {{ $t("Cancel") }}
                        </button>
                        <button type="button" class="btn btn-primary" @click="saveUser">
                            {{ $t("Save") }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { Modal } from "bootstrap";
import Confirm from "../Confirm.vue";

export default {
    components: {
        Confirm,
    },
    data() {
        return {
            users: [],
            loading: false,
            userDialog: null,
            editMode: false,
            selectedUserID: null,
            originalUsername: "",
            formData: {
                id: null,
                username: "",
                password: "",
                active: true,
            },
        };
    },

    mounted() {
        this.userDialog = new Modal(this.$refs.userDialog);
        this.loadUsers();
    },

    beforeUnmount() {
        this.cleanupModal();
    },

    methods: {
        /**
         * Cleanup modal instance
         * @returns {void}
         */
        cleanupModal() {
            if (this.userDialog) {
                try {
                    this.userDialog.hide();
                } catch (e) {
                    console.warn("Modal hide failed:", e);
                }
            }
        },

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
            this.originalUsername = "";
            this.formData = {
                id: null,
                username: "",
                password: "",
                active: true,
            };
            this.userDialog.show();
        },

        /**
         * Show dialog to edit an existing user
         * @param {object} user User object to edit
         * @returns {void}
         */
        showEditDialog(user) {
            this.editMode = true;
            this.originalUsername = user.username;
            this.formData = {
                id: user.id,
                username: user.username,
                password: "",
                active: user.active === 1,
            };
            this.userDialog.show();
        },

        /**
         * Save the user (add or update)
         * @returns {void}
         */
        saveUser() {
            // Client-side validation constants (must match server-side validation)
            const MIN_USERNAME_LENGTH = 3;
            const MAX_USERNAME_LENGTH = 50;
            const USERNAME_REGEX = /^[a-zA-Z0-9._-]+$/;
            const RESERVED_USERNAMES = [
                "admin", "root", "system", "administrator",
                "guest", "null", "undefined", "api",
                "user", "users", "public", "private"
            ];

            // Trim and validate username
            const username = this.formData.username.trim();

            if (username.length < MIN_USERNAME_LENGTH) {
                this.$root.toastError(this.$t("usernameMinLength"));
                return;
            }

            if (username.length > MAX_USERNAME_LENGTH) {
                this.$root.toastError(this.$t("usernameMaxLength"));
                return;
            }

            if (!USERNAME_REGEX.test(username)) {
                this.$root.toastError(this.$t("usernameInvalidCharacters"));
                return;
            }

            // Only check reserved usernames if:
            // 1. Adding a new user (not in edit mode), OR
            // 2. Editing a user AND the username has changed
            const shouldCheckReservedUsername = !this.editMode || username !== this.originalUsername;
            if (shouldCheckReservedUsername && RESERVED_USERNAMES.includes(username.toLowerCase())) {
                this.$root.toastError(this.$t("usernameReserved"));
                return;
            }

            // Update formData with trimmed username
            this.formData.username = username;

            if (this.editMode) {
                const updateData = {
                    username: username,
                    active: this.formData.active,
                };

                if (this.formData.password) {
                    updateData.password = this.formData.password;
                }

                this.$root.getSocket().emit("updateUser", this.formData.id, updateData, (res) => {
                    if (res.ok) {
                        this.$root.toastSuccess(res.msg);
                        this.userDialog.hide();
                        this.loadUsers();

                        // If user edited their own username, they will be logged out
                        if (res.requiresLogout) {
                            setTimeout(() => {
                                this.$root.logout();
                            }, 3000);
                        }
                    } else {
                        this.$root.toastError(res.msg);
                    }
                });
            } else {
                this.$root.getSocket().emit("addUser", this.formData, (res) => {
                    if (res.ok) {
                        this.$root.toastSuccess(res.msg);
                        this.userDialog.hide();
                        this.loadUsers();
                    } else {
                        this.$root.toastError(res.msg);
                    }
                });
            }
        },

        /**
         * Show dialog to confirm deletion
         * @param {number} userID ID of user that is being deleted
         * @returns {void}
         */
        deleteDialog(userID) {
            this.selectedUserID = userID;
            this.$refs.confirmDelete.show();
        },

        /**
         * Delete a user
         * @returns {void}
         */
        deleteUser() {
            this.$root.getSocket().emit("deleteUser", this.selectedUserID, (res) => {
                if (res.ok) {
                    this.$root.toastSuccess(res.msg);
                    this.loadUsers();
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../../assets/vars.scss";

.mobile {
    .item {
        flex-direction: column;
        align-items: flex-start;
        margin-bottom: 20px;
    }
}

.add-btn {
    padding-top: 20px;
    padding-bottom: 20px;
}

.item {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    border-radius: 10px;
    transition: all ease-in-out 0.15s;
    justify-content: space-between;
    padding: 10px;
    min-height: 90px;
    margin-bottom: 5px;

    &:hover {
        background-color: $highlight-white;
    }

    &.active {
        .circle {
            background-color: $primary;
        }
    }

    &.inactive {
        .circle {
            background-color: $danger;
        }
    }

    .left-part {
        display: flex;
        gap: 12px;
        align-items: center;

        .circle {
            width: 25px;
            height: 25px;
            border-radius: 50rem;
        }

        .info {
            .title {
                font-weight: bold;
                font-size: 20px;
            }

            .status {
                font-size: 14px;
            }
        }
    }

    .buttons {
        display: flex;
        gap: 8px;
        flex-direction: row-reverse;

        .btn-group {
            width: auto;
        }
    }
}

.dark {
    .item {
        &:hover {
            background-color: $dark-bg2;
        }
    }
}

.modal.show {
    display: block;
}
</style>
