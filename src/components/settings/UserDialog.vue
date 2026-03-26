<template>
    <form @submit.prevent="submit">
        <div ref="modal" class="modal fade" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            {{ isEdit ? $t("Edit User") : $t("Add User") }}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" :aria-label="$t('Close')" />
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label for="user-username" class="form-label">{{ $t("Username") }}</label>
                            <input
                                id="user-username"
                                v-model="formData.username"
                                type="text"
                                class="form-control"
                                required
                            />
                        </div>
                        <div class="mb-3">
                            <label for="user-password" class="form-label">{{ $t("Password") }}</label>
                            <input
                                id="user-password"
                                v-model="formData.password"
                                type="password"
                                class="form-control"
                                :required="!isEdit"
                                :placeholder="isEdit ? $t('passwordEmptyToKeep') : ''"
                            />
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" type="submit" :disabled="processing">
                            {{ $t("Save") }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </form>
</template>

<script>
import { Modal } from "bootstrap";

export default {
    emits: ["saved"],
    data() {
        return {
            modal: null,
            processing: false,
            isEdit: false,
            formData: {
                id: null,
                username: "",
                password: "",
            },
        };
    },
    mounted() {
        this.modal = new Modal(this.$refs.modal);
    },
    methods: {
        /**
         * Show dialog for adding a new user
         * @returns {void}
         */
        showAdd() {
            this.isEdit = false;
            this.formData = { id: null, username: "", password: "" };
            this.modal.show();
        },

        /**
         * Show dialog for editing an existing user
         * @param {object} user User to edit
         * @returns {void}
         */
        showEdit(user) {
            this.isEdit = true;
            this.formData = { id: user.id, username: user.username, password: "" };
            this.modal.show();
        },

        /**
         * Submit the form
         * @returns {void}
         */
        submit() {
            this.processing = true;
            let event = this.isEdit ? "editUser" : "addUser";

            this.$root.getSocket().emit(event, this.formData, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
                if (res.ok) {
                    // Update displayed username if the current user edited themselves
                    if (this.isEdit && this.formData.id === this.$root.socket?.userID && this.formData.username) {
                        this.$root.username = this.formData.username;
                    }
                    this.modal.hide();
                    this.$emit("saved");
                }
            });
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../../assets/vars.scss";

.dark {
    .modal-dialog .form-text,
    .modal-dialog p {
        color: $dark-font-color;
    }
}
</style>
