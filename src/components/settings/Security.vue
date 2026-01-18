<template>
    <div>
        <div v-if="settingsLoaded" class="my-4">
            <!-- Change Password -->
            <template v-if="!settings.disableAuth">
                <p>
                    <button
                        v-if="!settings.disableAuth"
                        id="logout-btn"
                        class="btn btn-danger ms-4 me-2 mb-2"
                        @click="$root.logout"
                    >
                        {{ $t("logoutCurrentUser", { username: $root.username }) }}
                    </button>
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
                            @input="checkPasswordStrength"
                        />
                        
                        <!-- Password strength indicator -->
                        <div v-if="password.newPassword && passwordStrength !== null" class="password-strength mt-2">
                            <div class="strength-meter mx-auto">
                                <div 
                                    class="strength-meter-fill" 
                                    :class="strengthClass"
                                    :style="{ width: strengthWidth }"
                                />
                            </div>
                            <small v-if="passwordStrength < 3" class="text-warning d-block mt-1">
                                {{ $t("passwordWeakWarning") }}
                            </small>
                        </div>
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

            <div v-if="!settings.disableAuth" class="mt-5 mb-3">
                <h5 class="my-4 settings-subheading">
                    {{ $t("Two Factor Authentication") }}
                </h5>
                <div class="mb-4">
                    <button class="btn btn-primary me-2" type="button" @click="$refs.TwoFADialog.show()">
                        {{ $t("2FA Settings") }}
                    </button>
                </div>
            </div>

            <div class="my-4">
                <!-- Advanced -->
                <h5 class="my-4 settings-subheading">{{ $t("Advanced") }}</h5>

                <div class="mb-4">
                    <button
                        v-if="settings.disableAuth"
                        id="enableAuth-btn"
                        class="btn btn-outline-primary me-2 mb-2"
                        @click="enableAuth"
                    >
                        {{ $t("Enable Auth") }}
                    </button>
                    <button
                        v-if="!settings.disableAuth"
                        id="disableAuth-btn"
                        class="btn btn-primary me-2 mb-2"
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
import zxcvbn from "zxcvbn";

export default {
    components: {
        Confirm,
        TwoFADialog,
    },

    data() {
        return {
            invalidPassword: false,
            password: {
                currentPassword: "",
                newPassword: "",
                repeatNewPassword: "",
            },
            passwordStrength: null,
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
        strengthClass() {
            if (this.passwordStrength === null) {
                return "";
            }
            const classes = [ "strength-very-weak", "strength-weak", "strength-fair", "strength-good", "strength-strong" ];
            return classes[this.passwordStrength] || "";
        },
        strengthWidth() {
            if (this.passwordStrength === null) {
                return "0%";
            }
            return `${(this.passwordStrength + 1) * 20}%`;
        },
    },

    watch: {
        "password.repeatNewPassword"() {
            this.invalidPassword = false;
        },
    },

    methods: {
        /**
         * Check password strength using zxcvbn
         * @returns {void}
         */
        checkPasswordStrength() {
            if (!this.password.newPassword) {
                this.passwordStrength = null;
                return;
            }
            
            const result = zxcvbn(this.password.newPassword, [ this.$root.username ]);
            this.passwordStrength = result.score;
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
                    
                    // Show warning toast if password was found in breach database
                    if (res.ok && res.warning) {
                        this.$root.toastWarning(res.warning);
                    }
                    
                    if (res.ok) {
                        this.password.currentPassword = "";
                        this.password.newPassword = "";
                        this.password.repeatNewPassword = "";
                        this.passwordStrength = null;

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
.password-strength {
    margin-top: 0.5rem;
}

.strength-meter {
    height: 8px;
    width: 85%;
    background-color: #e0e0e0;
    border-radius: 8px;
    overflow: hidden;
}

.strength-meter-fill {
    height: 100%;
    transition: width 0.3s ease, background-color 0.3s ease;
}

.strength-very-weak {
    background-color: #dc3545;
}

.strength-weak {
    background-color: #fd7e14;
}

.strength-fair {
    background-color: #ffc107;
}

.strength-good {
    background-color: #20c997;
}

.strength-strong {
    background-color: #28a745;
}
</style>
