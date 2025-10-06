<template>
    <div>
        <div v-if="settingsLoaded" class="my-4">
            <!-- Change Password -->
            <template v-if="!settings.disableAuth && !isOIDCUser">
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
                        <button class="btn btn-primary" type="submit">
                            {{ $t("Update Password") }}
                        </button>
                    </div>
                </form>
            </template>

            <div v-if="!settings.disableAuth && !isOIDCUser" class="mt-5 mb-3">
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
                <h5 class="my-4 settings-subheading">
                    {{ $t("OIDC Single Sign-On") }}
                </h5>

                <form class="mb-3" @submit.prevent="saveOIDC">
                    <div class="form-check form-switch mb-3">
                        <input id="oidc-enabled" v-model="settings.oidcEnabled" class="form-check-input" type="checkbox">
                        <label class="form-check-label" for="oidc-enabled">{{ $t("Enable OIDC") }}</label>
                    </div>

                    <div class="mb-3">
                        <label class="form-label" for="oidc-issuer">{{ $t("OIDC Issuer URL") }}</label>
                        <input
                            id="oidc-issuer"
                            v-model="settings.oidcIssuerURL"
                            class="form-control"
                            :required="settings.oidcEnabled"
                            type="url"
                            autocomplete="off"
                        />
                    </div>

                    <div class="mb-3">
                        <label class="form-label" for="oidc-client-id">{{ $t("OIDC Client ID") }}</label>
                        <input
                            id="oidc-client-id"
                            v-model="settings.oidcClientID"
                            class="form-control"
                            :required="settings.oidcEnabled"
                            type="text"
                            autocomplete="off"
                        />
                    </div>

                    <div class="mb-3">
                        <label class="form-label" for="oidc-client-secret">{{ $t("OIDC Client Secret") }}</label>
                        <input
                            id="oidc-client-secret"
                            v-model="settings.oidcClientSecret"
                            class="form-control"
                            type="password"
                            autocomplete="new-password"
                        />
                        <div class="form-text">{{ $t("oidcClientSecretHint") }}</div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label" for="oidc-discovery">{{ $t("OIDC Discovery URL") }}</label>
                        <input
                            id="oidc-discovery"
                            v-model="settings.oidcDiscoveryURL"
                            class="form-control"
                            type="url"
                            autocomplete="off"
                        />
                        <div class="form-text">{{ $t("oidcDiscoveryURLHint") }}</div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label" for="oidc-scope">{{ $t("OIDC Scope") }}</label>
                        <input
                            id="oidc-scope"
                            v-model="settings.oidcScope"
                            class="form-control"
                            type="text"
                            autocomplete="off"
                            :required="settings.oidcEnabled"
                        />
                    </div>

                    <div class="mb-3">
                        <label class="form-label" for="oidc-redirect">{{ $t("OIDC Redirect URI") }}</label>
                        <input
                            id="oidc-redirect"
                            v-model="settings.oidcRedirectURI"
                            class="form-control"
                            type="url"
                            autocomplete="off"
                        />
                        <div class="form-text">
                            {{ $t("oidcRedirectURINote", [ defaultOIDCRedirectURI ]) }}
                        </div>
                    </div>

                    <div class="mb-3">
                        <label class="form-label" for="oidc-username-claim">{{ $t("OIDC Username Claim") }}</label>
                        <input
                            id="oidc-username-claim"
                            v-model="settings.oidcUsernameClaim"
                            class="form-control"
                            type="text"
                            autocomplete="off"
                        />
                        <div class="form-text">{{ $t("oidcUsernameClaimHint") }}</div>
                    </div>

                    <div class="form-check mb-3">
                        <input id="oidc-auto-create" v-model="settings.oidcAutoCreateUser" class="form-check-input" type="checkbox">
                        <label class="form-check-label" for="oidc-auto-create">{{ $t("oidcAutoCreateUser") }}</label>
                    </div>

                    <div class="mb-3">
                        <label class="form-label" for="oidc-button-label">{{ $t("OIDC Button Label") }}</label>
                        <input
                            id="oidc-button-label"
                            v-model="settings.oidcButtonLabel"
                            class="form-control"
                            type="text"
                            autocomplete="off"
                            :placeholder="$t('Sign in with OIDC')"
                        />
                    </div>

                    <div class="mb-3">
                        <label class="form-label" for="oidc-token-method">{{ $t("OIDC Token Endpoint Auth Method") }}</label>
                        <select id="oidc-token-method" v-model="settings.oidcTokenEndpointAuthMethod" class="form-select">
                            <option value="auto">{{ $t("oidcTokenAuthAuto") }}</option>
                            <option value="client_secret_basic">{{ $t("oidcTokenAuthClientSecretBasic") }}</option>
                            <option value="client_secret_post">{{ $t("oidcTokenAuthClientSecretPost") }}</option>
                            <option value="none">{{ $t("oidcTokenAuthNone") }}</option>
                        </select>
                        <div class="form-text">{{ $t("oidcTokenEndpointAuthHint") }}</div>
                    </div>

                    <div>
                        <button class="btn btn-primary" type="submit">{{ $t("Save") }}</button>
                    </div>
                </form>
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
            <i18n-t tag="p" keypath="disableauth.message1">
                <template #disableAuth>
                    <strong>{{ $t('disable authentication') }}</strong>
                </template>
            </i18n-t>
            <i18n-t tag="p" keypath="disableauth.message2">
                <template #intendThirdPartyAuth>
                    <strong>{{ $t('intend to implement third-party authentication') }}</strong>
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
import jwtDecode from "jwt-decode";

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
        },
        defaultOIDCRedirectURI() {
            const baseURL = this.$root.info?.primaryBaseURL;
            if (baseURL && typeof baseURL === "string" && baseURL.length > 0) {
                return baseURL.replace(/\/$/, "") + "/auth/oidc/callback";
            }
            return `${location.origin}/auth/oidc/callback`;
        },
        // Determine if current user authenticated via OIDC (JWT contains oidc: true)
        isOIDCUser() {
            try {
                const token = this.$root.storage().token;
                if (!token) { return false; }
                const decoded = jwtDecode(token);
                return !!decoded.oidc;
            } catch (e) {
                return false;
            }
        }
    },

    watch: {
        "password.repeatNewPassword"() {
            this.invalidPassword = false;
        },
    },

    methods: {
        /**
         * Check new passwords match before saving them
         * @returns {void}
         */
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

        saveOIDC() {
            this.saveSettings();
        },

    },
};
</script>
