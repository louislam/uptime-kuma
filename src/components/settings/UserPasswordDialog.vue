<template>
    <form @submit.prevent="submit">
        <div ref="modal" class="modal fade" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            {{ $t("Change Password") }}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" :aria-label="$t('Close')" />
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label for="change-password" class="form-label">{{ $t("New Password") }}</label>
                            <input
                                id="change-password"
                                v-model="password"
                                type="password"
                                class="form-control"
                                required
                            />
                        </div>
                        <div class="mb-3">
                            <label for="change-password-repeat" class="form-label">{{ $t("Repeat New Password") }}</label>
                            <input
                                id="change-password-repeat"
                                v-model="repeatPassword"
                                type="password"
                                class="form-control"
                                required
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
    data() {
        return {
            modal: null,
            processing: false,
            userID: null,
            password: "",
            repeatPassword: "",
        };
    },
    mounted() {
        this.modal = new Modal(this.$refs.modal);
    },
    methods: {
        /**
         * Show dialog for changing a user's password
         * @param {number} id User ID
         * @returns {void}
         */
        show(id) {
            this.userID = id;
            this.password = "";
            this.repeatPassword = "";
            this.modal.show();
        },

        /**
         * Submit the password change
         * @returns {void}
         */
        submit() {
            if (this.password !== this.repeatPassword) {
                this.$root.toastError(this.$t("passwordNotMatchMsg"));
                return;
            }

            this.processing = true;

            this.$root.getSocket().emit("editUser", {
                id: this.userID,
                password: this.password,
            }, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
                if (res.ok) {
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
