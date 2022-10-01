<template>
    <div>
        <div v-if="settingsLoaded" class="my-4">
            <!-- Change Password -->
            <template v-if="!settings.disableAuth">
                <p>
                    {{ $t("Current User") }}: <strong>{{ $root.username }}</strong>
                    <button v-if="! settings.disableAuth" id="logout-btn" class="btn btn-danger ms-4 me-2 mb-2" @click="$root.logout">{{ $t("Logout") }}</button>
                </p>

                <h5 class="my-4 settings-subheading">{{ $t("Change Password") }}</h5>
                <form class="mb-3" @submit.prevent="savePassword">
                    <div class="mb-3">
                        <label for="current-password" class="form-label">
                            {{ $t("Current Password") }}
                        </label>
                        <input
                            id="current-password"
                            v-model="password.currentPassword"
                            type="password"
                            class="form-control"
                            required
                        />
                    </div>

                    <div class="mb-3">
                        <label for="new-password" class="form-label">
                            {{ $t("New Password") }}
                        </label>
                        <input
                            id="new-password"
                            v-model="password.newPassword"
                            type="password"
                            class="form-control"
                            required
                        />
                    </div>

                    <div class="mb-3">
                        <label for="repeat-new-password" class="form-label">
                            {{ $t("Repeat New Password") }}
                        </label>
                        <input
                            id="repeat-new-password"
                            v-model="password.repeatNewPassword"
                            type="password"
                            class="form-control"
                            :class="{ 'is-invalid': invalidPassword }"
                            required
                        />
                        <div class="invalid-feedback">
                            {{ $t("passwordNotMatchMsg") }}
                        </div>
                    </div>

                    <div>
                        <button class="btn btn-primary" type="submit">
                            {{ $t("Update Password") }}
                        </button>
                    </div>
                </form>
            </template>

            <div v-if="! settings.disableAuth" class="mt-5 mb-3">
                <h5 class="my-4 settings-subheading">
                    {{ $t("Two Factor Authentication") }}
                </h5>
                <div class="mb-4">
                    <button
                        class="btn btn-primary me-2"
                        type="button"
                        @click="$refs.TwoFADialog.show()"
                    >
                        {{ $t("2FA Settings") }}
                    </button>
                </div>
            </div>

            <div class="my-4">
                <!-- Advanced -->
                <h5 class="my-4 settings-subheading">{{ $t("Advanced") }}</h5>

                <div class="mb-4">
                    <button v-if="settings.disableAuth" id="enableAuth-btn" class="btn btn-outline-primary me-2 mb-2" @click="enableAuth">{{ $t("Enable Auth") }}</button>
                    <button v-if="! settings.disableAuth" id="disableAuth-btn" class="btn btn-primary me-2 mb-2" @click="confirmDisableAuth">{{ $t("Disable Auth") }}</button>
                </div>
            </div>
        </div>

        <TwoFADialog ref="TwoFADialog" />

        <Confirm ref="confirmDisableAuth" btn-style="btn-danger" :yes-text="$t('I understand, please disable')" :no-text="$t('Leave')" @yes="disableAuth">
            <!-- eslint-disable-next-line vue/no-v-html -->
            <p v-html="$t('disableauth.message1')"></p>
            <!-- eslint-disable-next-line vue/no-v-html -->
            <p v-html="$t('disableauth.message2')"></p>
            <p>{{ $t("Please use this option carefully!") }}</p>

            <div class="mb-3">
                <label for="current-password2" class="form-label">
                    {{ $t("Current Password") }}
                </label>
                <input
                    id="current-password2"
                    v-model="password.currentPassword"
                    type="password"
                    class="form-control"
                    required
                />
            </div>
        </Confirm>
    </div>
</template>

<script>
import Confirm from "../../components/Confirm.vue";
import TwoFADialog from "../../components/TwoFADialog.vue";

export default {
    components: {
        Confirm,
        TwoFADialog
    },

    data() {
        return {
            invalidPassword: false,
            password: {
                currentPassword: "",
                newPassword: "",
                repeatNewPassword: "",
            }
        };
    },

    computed: {
        settings() {
            return this.$parent.$parent.$parent.settings;
        },
        saveSettings() {
            return this.$parent.$parent.$parent.saveSettings;
        },
        settingsLoaded() {
            return this.$parent.$parent.$parent.settingsLoaded;
        }
    },

    watch: {
        "password.repeatNewPassword"() {
            this.invalidPassword = false;
        },
    },

    methods: {
        /** Check new passwords match before saving them */
        savePassword() {
            if (this.password.newPassword !== this.password.repeatNewPassword) {
                this.invalidPassword = true;
            } else {
                this.$root
                    .getSocket()
                    .emit("changePassword", this.password, (res) => {
                        this.$root.toastRes(res);
                        if (res.ok) {
                            this.password.currentPassword = "";
                            this.password.newPassword = "";
                            this.password.repeatNewPassword = "";
                        }
                    });
            }
        },

        /** Disable authentication for web app access */
        disableAuth() {
            this.settings.disableAuth = true;

            // Need current password to disable auth
            // Set it to empty if done
            this.saveSettings(() => {
                this.password.currentPassword = "";
                this.$root.username = null;
                this.$root.socket.token = "autoLogin";
            }, this.password.currentPassword);
        },

        /** Enable authentication for web app access */
        enableAuth() {
            this.settings.disableAuth = false;
            this.saveSettings();
            this.$root.storage().removeItem("token");
            location.reload();
        },

        confirmDisableAuth() {
            this.$refs.confirmDisableAuth.show();
        },

    },
};
</script>
