<template>
    <div class="security-settings">
        <div v-if="$root.isCloudflareWorkerUI" class="security-section">
            <p v-if="$root.loggedIn">
                <button id="logout-btn" class="btn btn-danger security-pill-button logout-button" @click="$root.logout">
                    {{ $t("logoutCurrentUser", { username: $root.username }) }}
                </button>
            </p>

            <h5 class="settings-subheading security-subheading">
                {{ $root.workerLocalAuthConfigured ? $t("Change Password") : "Create local admin login" }}
            </h5>
            <form class="security-form" @submit.prevent="saveWorkerAuthUser">
                <div v-if="!$root.workerLocalAuthConfigured" class="mb-3">
                    <label for="worker-username" class="form-label">
                        {{ $t("Username") }}
                    </label>
                    <input
                        id="worker-username"
                        v-model="workerAuth.username"
                        type="text"
                        class="form-control"
                        autocomplete="username"
                        required
                    />
                </div>

                <div v-if="$root.workerLocalAuthConfigured" class="mb-3">
                    <label for="worker-current-password" class="form-label">
                        {{ $t("Current Password") }}
                    </label>
                    <input
                        id="worker-current-password"
                        v-model="workerAuth.currentPassword"
                        type="password"
                        class="form-control"
                        autocomplete="current-password"
                        required
                    />
                </div>

                <div class="mb-3">
                    <label for="worker-new-password" class="form-label">
                        {{ $t("New Password") }}
                    </label>
                    <input
                        id="worker-new-password"
                        v-model="workerAuth.newPassword"
                        type="password"
                        class="form-control"
                        autocomplete="new-password"
                        required
                    />
                </div>

                <div class="mb-3">
                    <label for="worker-repeat-new-password" class="form-label">
                        {{ $t("Repeat New Password") }}
                    </label>
                    <input
                        id="worker-repeat-new-password"
                        v-model="workerAuth.repeatNewPassword"
                        type="password"
                        class="form-control"
                        :class="{ 'is-invalid': invalidWorkerPassword }"
                        autocomplete="new-password"
                        required
                    />
                    <div class="invalid-feedback">
                        {{ $t("passwordNotMatchMsg") }}
                    </div>
                </div>

                <div>
                    <button class="btn btn-primary security-pill-button" type="submit" :disabled="workerSaving">
                        {{ $root.workerLocalAuthConfigured ? $t("Update Password") : "Create login" }}
                    </button>
                </div>
            </form>
        </div>

        <div v-else-if="settingsLoaded" class="security-section">
            <!-- Change Password -->
            <template v-if="!settings.disableAuth">
                <p>
                    <button
                        v-if="!settings.disableAuth"
                        id="logout-btn"
                        class="btn btn-danger security-pill-button logout-button"
                        @click="$root.logout"
                    >
                        {{ $t("logoutCurrentUser", { username: $root.username }) }}
                    </button>
                </p>

                <h5 class="settings-subheading security-subheading">{{ $t("Change Password") }}</h5>
                <form class="security-form" @submit.prevent="savePassword">
                    <div class="mb-3">
                        <label for="current-password" class="form-label">
                            {{ $t("Current Password") }}
                        </label>
                        <input
                            id="current-password"
                            v-model="password.currentPassword"
                            type="password"
                            class="form-control"
                            autocomplete="current-password"
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
                            autocomplete="new-password"
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
                            autocomplete="new-password"
                            required
                        />
                        <div class="invalid-feedback">
                            {{ $t("passwordNotMatchMsg") }}
                        </div>
                    </div>

                    <div>
                        <button class="btn btn-primary security-pill-button" type="submit">
                            {{ $t("Update Password") }}
                        </button>
                    </div>
                </form>
            </template>

            <div v-if="!settings.disableAuth" class="security-section-block">
                <h5 class="settings-subheading security-subheading">
                    {{ $t("Two Factor Authentication") }}
                </h5>
                <div class="mb-4">
                    <button class="btn btn-primary security-pill-button" type="button" @click="$refs.TwoFADialog.show()">
                        {{ $t("2FA Settings") }}
                    </button>
                </div>
            </div>

            <div class="security-section-block">
                <!-- Advanced -->
                <h5 class="settings-subheading security-subheading">{{ $t("Advanced") }}</h5>

                <div class="mb-4">
                    <button
                        v-if="settings.disableAuth"
                        id="enableAuth-btn"
                        class="btn btn-outline-primary security-pill-button me-2 mb-2"
                        @click="enableAuth"
                    >
                        {{ $t("Enable Auth") }}
                    </button>
                    <button
                        v-if="!settings.disableAuth"
                        id="disableAuth-btn"
                        class="btn btn-primary security-pill-button me-2 mb-2"
                        @click="confirmDisableAuth"
                    >
                        {{ $t("Disable Auth") }}
                    </button>
                </div>
            </div>
        </div>

        <TwoFADialog ref="TwoFADialog" />

        <Confirm
            ref="confirmDisableAuth"
            btn-style="btn-danger"
            :yes-text="$t('I understand, please disable')"
            :no-text="$t('Leave')"
            @yes="disableAuth"
        >
            <i18n-t tag="p" keypath="disableauth.message1">
                <template #disableAuth>
                    <strong>{{ $t("disable authentication") }}</strong>
                </template>
            </i18n-t>
            <i18n-t tag="p" keypath="disableauth.message2">
                <template #intendThirdPartyAuth>
                    <strong>{{ $t("where you intend to implement third-party authentication") }}</strong>
                </template>
            </i18n-t>
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
import { requestCloudflareJson } from "../../cloudflare-worker-api";

export default {
    components: {
        Confirm,
        TwoFADialog,
    },

    data() {
        return {
            invalidPassword: false,
            invalidWorkerPassword: false,
            workerSaving: false,
            workerAuth: {
                username: "",
                currentPassword: "",
                newPassword: "",
                repeatNewPassword: "",
            },
            password: {
                currentPassword: "",
                newPassword: "",
                repeatNewPassword: "",
            },
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
        },
    },

    watch: {
        "password.repeatNewPassword"() {
            this.invalidPassword = false;
        },
        "workerAuth.repeatNewPassword"() {
            this.invalidWorkerPassword = false;
        },
    },

    mounted() {
        this.workerAuth.username = this.$root.username === "Cloudflare" ? "" : (this.$root.username || "");
    },

    methods: {
        /**
         * Save Worker-local username/password credentials.
         * @returns {void}
         */
        saveWorkerAuthUser() {
            if (this.workerAuth.newPassword !== this.workerAuth.repeatNewPassword) {
                this.invalidWorkerPassword = true;
                return;
            }

            this.workerSaving = true;
            if (this.$root.isCloudflareWorkerUI) {
                this.saveWorkerAuthUserWithRest();
                return;
            }

            this.$root.getSocket().emit("saveWorkerAuthUser", this.workerAuthPayload(), this.onWorkerAuthUserSaved);
        },

        /**
         * Save Worker-local auth via the REST API exposed by Cloudflare Workers.
         * This keeps the settings form functional even when the Socket.IO shim
         * bundle is stale in a browser cache.
         * @returns {Promise<void>}
         */
        async saveWorkerAuthUserWithRest() {
            try {
                const res = await requestCloudflareJson("/api/auth/local-user", {
                    method: "PUT",
                    body: JSON.stringify(this.workerAuthPayload()),
                });
                this.onWorkerAuthUserSaved(res);
            } catch (error) {
                this.onWorkerAuthUserSaved({
                    ok: false,
                    msg: error.message,
                });
            }
        },

        /**
         * Build the Worker-local auth API payload.
         * @returns {{username: string, newPassword: string}} Request payload.
         */
        workerAuthPayload() {
            return {
                username: this.workerAuth.username,
                currentPassword: this.workerAuth.currentPassword,
                newPassword: this.workerAuth.newPassword,
            };
        },

        /**
         * Handle a Worker-local auth save response.
         * @param {object} res API response.
         * @returns {void}
         */
        onWorkerAuthUserSaved(res) {
            this.workerSaving = false;
            this.$root.toastRes(res);
            if (res.ok) {
                this.$root.workerLocalAuthConfigured = true;
                this.$root.username = res.username;
                this.workerAuth.username = res.username || this.workerAuth.username;
                if (res.token) {
                    this.$root.storage().token = res.token;
                    this.$root.socket.token = res.token;
                }
                this.workerAuth.currentPassword = "";
                this.workerAuth.newPassword = "";
                this.workerAuth.repeatNewPassword = "";
            }
        },

        /**
         * Check new passwords match before saving them
         * @returns {void}
         */
        savePassword() {
            if (this.password.newPassword !== this.password.repeatNewPassword) {
                this.invalidPassword = true;
            } else {
                this.$root.getSocket().emit("changePassword", this.password, (res) => {
                    this.$root.toastRes(res);
                    if (res.ok) {
                        this.password.currentPassword = "";
                        this.password.newPassword = "";
                        this.password.repeatNewPassword = "";

                        // Update token of the current session
                        if (res.token) {
                            this.$root.storage().token = res.token;
                            this.$root.socket.token = res.token;
                        }
                    }
                });
            }
        },

        /**
         * Disable authentication for web app access
         * @returns {void}
         */
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

        /**
         * Enable authentication for web app access
         * @returns {void}
         */
        enableAuth() {
            this.settings.disableAuth = false;
            this.saveSettings();
            this.$root.storage().removeItem("token");
            location.reload();
        },

        /**
         * Show confirmation dialog for disable auth
         * @returns {void}
         */
        confirmDisableAuth() {
            this.$refs.confirmDisableAuth.show();
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../../assets/vars.scss";

.security-settings {
    padding-top: 42px;
}

.security-section {
    padding-left: 10px;
}

.logout-button {
    margin-left: 32px;
    margin-bottom: 52px;
}

.security-form {
    max-width: 100%;
    margin-bottom: 72px;
}

.security-subheading {
    margin-top: 0;
    margin-bottom: 44px;
}

.security-section-block {
    margin-top: 56px;
}

.security-pill-button {
    min-width: 196px;
    min-height: 48px;
    border-radius: $button-border-radius;
    font-size: 1rem;
}

.form-label {
    margin-bottom: 14px;
    font-size: 1rem;
}

.form-control {
    min-height: 52px;
    border-radius: $border-radius-lg;
}

@media (max-width: 770px) {
    .security-settings {
        padding-top: 24px;
    }

    .security-section {
        padding-left: 0;
    }

    .logout-button {
        margin-left: 0;
        margin-bottom: 36px;
    }

    .security-subheading {
        margin-bottom: 32px;
    }
}
</style>
