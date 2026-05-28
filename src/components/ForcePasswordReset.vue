<template>
    <div ref="modal" class="modal fade" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">{{ $t("Change Your Password") }}</h5>
                </div>
                <div class="modal-body">
                    <p class="text-muted">
                        {{ $t("Your account requires a password change before you can continue.") }}
                    </p>
                    <form id="force-reset-form" @submit.prevent="submit">
                        <div class="mb-3">
                            <label class="form-label">{{ $t("New Password") }}</label>
                            <input
                                v-model="newPassword"
                                type="password"
                                class="form-control"
                                autocomplete="new-password"
                                required
                                minlength="6"
                            />
                        </div>
                        <div class="mb-3">
                            <label class="form-label">{{ $t("Repeat New Password") }}</label>
                            <input
                                v-model="confirmPassword"
                                type="password"
                                class="form-control"
                                :class="{ 'is-invalid': confirmPassword && newPassword !== confirmPassword }"
                                autocomplete="new-password"
                                required
                            />
                            <div class="invalid-feedback">{{ $t("passwordNotMatch") }}</div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button
                        type="submit"
                        form="force-reset-form"
                        class="btn btn-primary"
                        :disabled="processing || (confirmPassword && newPassword !== confirmPassword)"
                    >
                        {{ $t("Change Password") }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { Modal } from "bootstrap";

export default {
    data() {
        return {
            modal: null,
            newPassword: "",
            confirmPassword: "",
            processing: false,
        };
    },

    mounted() {
        this.modal = new Modal(this.$refs.modal);
    },

    methods: {
        show() {
            this.newPassword = "";
            this.confirmPassword = "";
            this.processing = false;
            this.modal.show();
        },

        submit() {
            if (this.newPassword !== this.confirmPassword) {
                return;
            }
            this.processing = true;
            this.$root.getSocket().emit("forceChangePassword", this.newPassword, (res) => {
                this.processing = false;
                if (res.ok) {
                    this.$root.forcePasswordReset = false;
                    this.modal.hide();
                    this.$root.toastSuccess(this.$t("Password has been updated successfully."));
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        },
    },
};
</script>
