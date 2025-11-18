<template>
    <div class="form-container">
        <div class="form">
            <form @submit.prevent="submit">
                <h1 class="h3 mb-3 fw-normal" />

                <div v-if="!tokenRequired" class="form-floating">
                    <input
                        id="floatingInput"
                        v-model="username"
                        type="text"
                        class="form-control"
                        placeholder="Username"
                        autocomplete="username"
                        required
                    />
                    <label for="floatingInput">{{ $t("Username") }}</label>
                </div>

                <div v-if="!tokenRequired" class="form-floating mt-3">
                    <input
                        id="floatingPassword"
                        v-model="password"
                        type="password"
                        class="form-control"
                        placeholder="Password"
                        autocomplete="current-password"
                        required
                    />
                    <label for="floatingPassword">{{ $t("Password") }}</label>
                </div>

                <div v-if="tokenRequired">
                    <div class="form-floating mt-3">
                        <input
                            id="otp"
                            ref="otpInput"
                            v-model="token"
                            type="text"
                            maxlength="6"
                            class="form-control"
                            placeholder="123456"
                            autocomplete="one-time-code"
                            required
                        />
                        <label for="otp">{{ $t("Token") }}</label>
                    </div>
                </div>

                <div
                    class="form-check mb-3 mt-3 d-flex justify-content-center pe-4"
                >
                    <div class="form-check">
                        <input
                            id="remember"
                            v-model="$root.remember"
                            type="checkbox"
                            value="remember-me"
                            class="form-check-input"
                        />

                        <label class="form-check-label" for="remember">
                            {{ $t("Remember me") }}
                        </label>
                    </div>
                </div>

                <!-- Terms and Service Agreement -->
                <div class="form-check mb-3 d-flex justify-content-center pe-4">
                    <div class="form-check">
                        <input
                            id="terms"
                            v-model="termsAgreed"
                            type="checkbox"
                            class="form-check-input"
                            required
                        />
                        <label class="form-check-label" for="terms">
                            {{
                                $t(
                                    "I agree to the Terms of Service and Privacy Policy"
                                )
                            }}
                        </label>
                    </div>
                </div>

                <button
                    class="w-100 btn btn-primary"
                    type="submit"
                    :disabled="processing"
                >
                    {{ $t("Login") }}
                </button>

                <div
                    v-if="res && !res.ok"
                    class="alert alert-danger mt-3"
                    role="alert"
                >
                    {{ $t(res.msg) }}
                </div>

                <div class="mt-4 text-muted">
                    <small>
                        {{ $t("By using this service, you agree to our") }}
                        <a
                            href="#"
                            @click.prevent="showTermsModal"
                            class="text-decoration-none"
                        >
                            {{ $t("Terms of Service") }}
                        </a>
                        {{ $t("and") }}
                        <a
                            href="#"
                            @click.prevent="showPrivacyModal"
                            class="text-decoration-none"
                        >
                            {{ $t("Privacy Policy") }} </a
                        >.
                    </small>
                </div>
            </form>
        </div>
    </div>

    <!-- Terms Modal -->
    <div id="terms-modal" class="modal" tabindex="-1" v-if="showTerms">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">{{ $t("Terms of Service") }}</h5>
                    <button
                        type="button"
                        class="btn-close"
                        @click="showTerms = false"
                        aria-label="Close"
                    ></button>
                </div>
                <div class="modal-body">
                    <p>
                        {{
                            $t(
                                "These terms govern your use of this monitoring service."
                            )
                        }}
                    </p>
                    <ol>
                        <li>
                            {{
                                $t(
                                    "You are responsible for maintaining the confidentiality of your account credentials."
                                )
                            }}
                        </li>
                        <li>
                            {{
                                $t(
                                    "You agree not to abuse the service or attempt unauthorized access to the system."
                                )
                            }}
                        </li>
                        <li>
                            {{
                                $t(
                                    "The service is provided as-is without warranties of any kind."
                                )
                            }}
                        </li>
                        <li>
                            {{
                                $t(
                                    "We reserve the right to modify or discontinue the service at any time."
                                )
                            }}
                        </li>
                    </ol>
                </div>
                <div class="modal-footer">
                    <button
                        type="button"
                        class="btn btn-primary"
                        @click="showTerms = false"
                    >
                        {{ $t("Close") }}
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Privacy Modal -->
    <div id="privacy-modal" class="modal" tabindex="-1" v-if="showPrivacy">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">{{ $t("Privacy Policy") }}</h5>
                    <button
                        type="button"
                        class="btn-close"
                        @click="showPrivacy = false"
                        aria-label="Close"
                    ></button>
                </div>
                <div class="modal-body">
                    <p>
                        {{
                            $t(
                                "We respect your privacy and are committed to protecting your personal data."
                            )
                        }}
                    </p>
                    <ol>
                        <li>
                            {{
                                $t(
                                    "We collect information you provide during registration and configuration."
                                )
                            }}
                        </li>
                        <li>
                            {{
                                $t(
                                    "We use this information solely for providing and improving our service."
                                )
                            }}
                        </li>
                        <li>
                            {{
                                $t(
                                    "We do not sell or share your personal information with third parties."
                                )
                            }}
                        </li>
                        <li>
                            {{
                                $t(
                                    "Data is securely stored and protected with industry-standard measures."
                                )
                            }}
                        </li>
                    </ol>
                </div>
                <div class="modal-footer">
                    <button
                        type="button"
                        class="btn btn-primary"
                        @click="showPrivacy = false"
                    >
                        {{ $t("Close") }}
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal backdrop -->
    <div v-if="showTerms || showPrivacy" class="modal-backdrop fade show"></div>
</template>

<script>
export default {
    data() {
        return {
            processing: false,
            username: "",
            password: "",
            token: "",
            res: null,
            tokenRequired: false,
            termsAgreed: false,
            showTerms: false,
            showPrivacy: false,
        };
    },

    watch: {
        tokenRequired(newVal) {
            if (newVal) {
                this.$nextTick(() => {
                    this.$refs.otpInput?.focus();
                });
            }
        },
    },

    mounted() {
        document.title += " - Login";
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
            // Check if terms are agreed before login
            if (!this.termsAgreed) {
                this.res = {
                    ok: false,
                    msg: "Please agree to the terms and conditions before logging in.",
                };
                return;
            }

            this.processing = true;

            this.$root.login(
                this.username,
                this.password,
                this.token,
                (res) => {
                    this.processing = false;

                    if (res.tokenRequired) {
                        this.tokenRequired = true;
                    } else {
                        this.res = res;
                    }
                }
            );
        },

        /**
         * Show terms modal
         */
        showTermsModal() {
            this.showTerms = true;
        },

        /**
         * Show privacy policy modal
         */
        showPrivacyModal() {
            this.showPrivacy = true;
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
    max-width: 430px;
    padding: 15px;
    margin: auto;
    text-align: center;
}

.modal {
    display: block;
    background-color: rgba(0, 0, 0, 0.5);
}

.text-muted {
    color: #6c757d !important;
}

a.text-decoration-none {
    color: #0d6efd;

    &:hover {
        text-decoration: underline !important;
    }
}
</style>
