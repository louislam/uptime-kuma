<template>
    <form @submit.prevent="submit">
        <div ref="modal" class="modal fade" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            {{ $t("Setup 2FA") }}
                            <span v-if="twoFAStatus == true" class="badge bg-primary">{{ $t("Active") }}</span>
                            <span v-if="twoFAStatus == false" class="badge bg-primary">{{ $t("Inactive") }}</span>
                        </h5>
                        <button :disabled="processing" type="button" class="btn-close" data-bs-dismiss="modal"
                            :aria-label="$t('Close')" />
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <div v-if="uri && twoFAStatus == false" class="mx-auto text-center" style="width: 210px">
                                <vue-qrcode :key="uri" :value="uri" type="image/png" :quality="1"
                                    :color="{ light: '#ffffffff' }" />
                                <button v-show="!showURI" type="button" class="btn btn-outline-primary btn-sm mt-2"
                                    @click="showURI = true">
                                    {{ $t("Show URI") }}
                                </button>
                            </div>
                            <p v-if="showURI && twoFAStatus == false" class="text-break mt-2">{{ uri }}</p>

                            <div v-if="!(uri && twoFAStatus == false)" class="mb-3">
                                <label for="current-password" class="form-label">
                                    {{ $t("Current Password") }}
                                </label>
                                <input id="current-password" v-model="currentPassword" type="password"
                                    class="form-control" autocomplete="current-password" required />
                            </div>

                            <button v-if="uri == null && twoFAStatus == false" class="btn btn-primary" type="button"
                                @click="prepare2FA()">
                                {{ $t("Enable 2FA") }}
                            </button>

                            <button v-if="twoFAStatus == true" class="btn btn-danger" type="button"
                                :disabled="processing" @click="confirmDisableTwoFA()">
                                {{ $t("Disable 2FA") }}
                            </button>

                            <div v-if="uri && twoFAStatus == false" class="mt-3">
                                <label for="basic-url" class="form-label">{{ $t("twoFAVerifyLabel") }}</label>
                                <input v-model="token" type="text" maxlength="6" class="form-control"
                                    autocomplete="one-time-code" required />
                            </div>
                        </div>
                    </div>

                    <div v-if="uri && twoFAStatus == false" class="modal-footer">
                        <button type="submit" class="btn btn-primary" :disabled="processing"
                            @click="confirmEnableTwoFA()">
                            <div v-if="processing" class="spinner-border spinner-border-sm me-1"></div>
                            {{ $t("Save") }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </form>

    <Confirm ref="confirmEnableTwoFA" btn-style="btn-danger" :yes-text="$t('Yes')" :no-text="$t('No')" @yes="enable2FA">
        {{ $t("confirmEnableTwoFAMsg") }}
    </Confirm>

    <Confirm ref="confirmDisableTwoFA" btn-style="btn-danger" :yes-text="$t('Yes')" :no-text="$t('No')"
        @yes="disable2FA">
        {{ $t("confirmDisableTwoFAMsg") }}
    </Confirm>
</template>

<script lang="ts">
import { Modal } from "bootstrap";
import Confirm from "./Confirm.vue";
import VueQrcode from "vue-qrcode";
import { authClient } from "../auth-client.ts";

export default {
    components: {
        Confirm,
        VueQrcode,
    },
    props: {},
    data() {
        return {
            currentPassword: "",
            processing: false,
            uri: null,
            twoFAStatus: null as boolean | null,
            token: null,
            showURI: false,
        };
    },
    mounted() {
        this.modal = new Modal(this.$refs.modal);
        this.getStatus();
    },
    methods: {
        /**
         * Show the dialog
         * @returns {void}
         */
        show() {
            this.modal.show();
        },

        /**
         * Show dialog to confirm enabling 2FA
         * @returns {void}
         */
        confirmEnableTwoFA() {
            this.$refs.confirmEnableTwoFA.show();
        },

        /**
         * Show dialog to confirm disabling 2FA
         * @returns {void}
         */
        confirmDisableTwoFA() {
            this.$refs.confirmDisableTwoFA.show();
        },

        /**
         * Prepare 2FA configuration
         * @returns {void}
         */
        async prepare2FA() {
            this.processing = true;

            const { data, error } = await authClient.twoFactor.enable({
                password: this.currentPassword!,
                issuer: "Uptime Kuma",
            });

            this.processing = false;

            if (!data || error) {
                this.$root.toastError(error.message);
                return;
            }

            this.currentPassword = "";
            this.uri = data.totpURI;
        },

        /**
         * Enable 2FA for this user
         * @returns {void}
         */
        async enable2FA() {
            if (!this.token) return;

            this.processing = true;

            const { error } = await authClient.twoFactor.verifyTotp({
                code: this.token,
            });

            this.processing = false;

            if (error) {
                this.$root.toastError(error.message);
                return;
            }

            this.$root.toastSuccess(this.$t("2faEnabled"));
            this.twoFAStatus = true;
            this.modal.hide();
        },

        /**
         * Disable 2FA for this user
         * @returns {void}
         */
        async disable2FA(): Promise<void> {
            this.processing = true;

            const { error } = await authClient.twoFactor.disable({
                password: this.currentPassword!,
            });

            this.processing = false;

            if (error) {
                this.$root.toastError(error.message);
                return;
            }

            this.$root.toastSuccess(this.$t("2faDisabled"));
            this.twoFAStatus = false;
            this.currentPassword = "";
            this.modal.hide();
        },

        /**
         * Get current status of 2FA
         * @returns {void}
         */
        async getStatus() {
            const { data, error } = await authClient.getSession()
            if (error) {
                this.$root.toastError(error.message);
                return;
            }

            this.twoFAStatus = data!.user.twoFactorEnabled ?? false;
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.dark {

    .modal-dialog .form-text,
    .modal-dialog p {
        color: $dark-font-color;
    }
}
</style>
