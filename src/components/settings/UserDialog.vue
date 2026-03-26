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
                        <template v-if="!isEdit">
                            <div class="mb-3">
                                <label for="user-password" class="form-label">{{ $t("Password") }}</label>
                                <input
                                    id="user-password"
                                    v-model="formData.password"
                                    type="password"
                                    class="form-control"
                                    required
                                />
                            </div>
                            <div class="mb-3">
                                <label for="user-password-repeat" class="form-label">{{ $t("Repeat Password") }}</label>
                                <input
                                    id="user-password-repeat"
                                    v-model="repeatPassword"
                                    type="password"
                                    class="form-control"
                                    required
                                />
                            </div>
                        </template>
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
    data() {
        return {
            modal: null,
            processing: false,
            isEdit: false,
            originalUsername: "",
            repeatPassword: "",
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
            this.repeatPassword = "";
            this.modal.show();
        },

        /**
         * Show dialog for editing an existing user
         * @param {object} user User to edit
         * @returns {void}
         */
        showEdit(user) {
            this.isEdit = true;
            this.originalUsername = user.username;
            this.formData = { id: user.id, username: user.username, password: "" };
            this.modal.show();
        },

        /**
         * Submit the form
         * @returns {void}
         */
        submit() {
            if (!this.isEdit && this.formData.password !== this.repeatPassword) {
                this.$root.toastError(this.$t("passwordNotMatchMsg"));
                return;
            }

            this.processing = true;
            let event = this.isEdit ? "editUser" : "addUser";

            this.$root.getSocket().emit(event, this.formData, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
                if (res.ok) {
                    if (this.isEdit && this.originalUsername === this.$root.username && this.formData.username) {
                        this.$root.username = this.formData.username;
                    }
                    this.modal.hide();
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
