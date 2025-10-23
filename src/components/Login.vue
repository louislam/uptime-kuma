<template>
    <div class="form-container">
        <div class="form">
            <form @submit.prevent="submit">
                <h1 class="h3 mb-3 fw-normal" />

                <div v-if="!tokenRequired" class="form-floating">
                    <input id="floatingInput" v-model="username" type="text" class="form-control" placeholder="Username" autocomplete="username" required>
                    <label for="floatingInput">{{ $t("Username") }}</label>
                </div>

                <div v-if="!tokenRequired" class="form-floating mt-3">
                    <input id="floatingPassword" v-model="password" type="password" class="form-control" placeholder="Password" autocomplete="current-password" required>
                    <label for="floatingPassword">{{ $t("Password") }}</label>
                </div>

                <div v-if="tokenRequired">
                    <div class="form-floating mt-3">
                        <input id="otp" ref="otpInput" v-model="token" type="text" maxlength="6" class="form-control" placeholder="123456" autocomplete="one-time-code" required>
                        <label for="otp">{{ $t("Token") }}</label>
                    </div>
                </div>

                <div class="form-check mb-3 mt-3 d-flex justify-content-center pe-4">
                    <div class="form-check">
                        <input id="remember" v-model="$root.remember" type="checkbox" value="remember-me" class="form-check-input">

                        <label class="form-check-label" for="remember">
                            {{ $t("Remember me") }}
                        </label>
                    </div>
                </div>
                <button class="w-100 btn btn-primary" type="submit" :disabled="processing">
                    {{ $t("Login") }}
                </button>

                <!-- SSO Login Section -->
                <div v-if="hasOidcProviders() && !tokenRequired" class="sso-section mt-4">
                    <div class="divider mb-3">
                        <span class="divider-text">{{ $t("or continue with") }}</span>
                    </div>

                    <div class="sso-buttons">
                        <button
                            v-for="provider in oidcProviders"
                            :key="provider.id"
                            type="button"
                            :class="getProviderButtonClass(provider)"
                            :disabled="oidcLoading"
                            @click="initiateOidcLogin(provider.id)"
                        >
                            <i :class="getProviderIcon(provider)" class="me-2"></i>
                            {{ $t("SSO LOGIN") }}
                        </button>
                    </div>

                    <!-- OIDC Loading State -->
                    <div v-if="oidcLoading" class="text-center mt-2">
                        <div class="spinner-border spinner-border-sm text-primary" role="status">
                            <span class="visually-hidden">{{ $t("Loading SSO providers...") }}</span>
                        </div>
                        <small class="text-muted ms-2">{{ $t("Loading SSO providers...") }}</small>
                    </div>

                    <!-- OIDC Error -->
                    <div v-if="oidcError" class="alert alert-warning mt-3" role="alert">
                        <small>{{ oidcError }}</small>
                        <button type="button" class="btn-close btn-close-sm" @click="clearOidcError"></button>
                    </div>
                </div>

                <div v-if="res && !res.ok" class="alert alert-danger mt-3" role="alert">
                    {{ $t(res.msg) }}
                </div>
            </form>
        </div>
    </div>
</template>

<script>
import oidcMixin from "../mixins/oidc.js";

export default {
    mixins: [ oidcMixin ],
    data() {
        return {
            processing: false,
            username: "",
            password: "",
            token: "",
            res: null,
            tokenRequired: false,
        };
    },

    watch: {
        tokenRequired(newVal) {
            if (newVal) {
                this.$nextTick(() => {
                    this.$refs.otpInput?.focus();
                });
            }
        }
    },

    async mounted() {
        document.title += " - Login";

        // Load OIDC providers on component mount
        try {
            await this.fetchOidcProviders();
        } catch (error) {
            console.warn("Failed to load OIDC providers:", error);
            // Don't show error to user, just silently fail to show SSO buttons
        }
    },

    unmounted() {
        document.title = document.title.replace(" - Login", "");
    },

    methods: {
        /**
         * Submit the user details and attempt to log in
         * @returns {void}
         */
        submit() {
            this.processing = true;

            this.$root.login(this.username, this.password, this.token, (res) => {
                this.processing = false;

                if (res.tokenRequired) {
                    this.tokenRequired = true;
                } else {
                    this.res = res;
                }
            });
        },
    },
};
</script>

<style lang="scss" scoped>
.form-container {
    display: flex;
    align-items: center;
    padding-top: 40px;
    padding-bottom: 40px;
}

.form-floating {
    > label {
        padding-left: 1.3rem;
    }

    > .form-control {
        padding-left: 1.3rem;
    }
}

.form {
    width: 100%;
    max-width: 330px;
    padding: 15px;
    margin: auto;
    text-align: center;
}

/* SSO Section Styling */
.sso-section {
    .divider {
        position: relative;
        text-align: center;

        &::before {
            content: "";
            position: absolute;
            top: 50%;
            left: 0;
            right: 0;
            height: 1px;
            background: #dee2e6;
        }

        .divider-text {
            background: white;
            padding: 0 1rem;
            color: #6c757d;
            font-size: 0.875rem;
            position: relative;
            z-index: 1;
        }
    }

    .sso-buttons {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }
}

/* OIDC Button Styling */
.oidc-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 1.25rem;
    border-radius: 0.375rem;
    font-weight: 500;
    transition: all 0.2s;
    border: 1px solid #dee2e6;

    &:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
}

.btn-pingfederate {
    background-color: #fff;
    border-color: #0066cc;
    color: #0066cc;

    &:hover:not(:disabled) {
        background-color: #0066cc;
        color: #fff;
    }
}

.btn-oidc-default {
    background-color: #fff;
    color: #333;
}
</style>
