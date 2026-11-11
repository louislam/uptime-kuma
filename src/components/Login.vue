<template>
    <div class="si">
        <header class="si-bar">
            <div class="kn-brand">
                <BrandMark />
                {{ $t("Status") }}
            </div>
        </header>

        <main class="si-body">
            <section class="si-hero">
                <div class="kn-stack">
                    <h1 class="kn-display">{{ $t("Status") }}</h1>
                    <p class="kn-lead kn-muted si-lead">{{ $t("signInDescription") }}</p>
                </div>
                <div class="si-facts">
                    <div>
                        <span class="kn-label">{{ $t("Host") }}</span>
                        <span class="kn-data">{{ host }}</span>
                    </div>
                    <div v-if="$root.info.serverTimezone">
                        <span class="kn-label">{{ $t("Timezone") }}</span>
                        <span class="kn-data">{{ $root.info.serverTimezone }}</span>
                    </div>
                </div>
            </section>

            <aside class="si-side">
                <div class="si-head">
                    <h2 class="kn-h2">{{ $t("Sign in") }}</h2>
                    <p v-if="aegis" class="kn-small kn-muted">{{ $t("aegisAccessRequired") }}</p>
                </div>

                <div v-if="errorMsg" class="kn-alert kn-alert-danger" role="alert">
                    <svg class="kn-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" x2="12" y1="8" y2="12" />
                        <line x1="12" x2="12.01" y1="16" y2="16" />
                    </svg>
                    <span>{{ errorMsg }}</span>
                </div>

                <!-- Aegis is the only way in when it is enabled -->
                <template v-if="aegis">
                    <button
                        class="kn-btn kn-btn-primary kn-btn-lg"
                        type="button"
                        :disabled="processing"
                        @click="continueWithAegis"
                    >
                        {{ processing ? $t("Signing in") : $t("Continue with Aegis") }}
                    </button>
                    <hr class="kn-rule" />
                    <p class="kn-small kn-muted">{{ $t("aegisNoAccount") }}</p>
                </template>

                <!-- Local account, used when Aegis is not configured -->
                <form v-else aria-label="Login Form" class="si-form" @submit.prevent="submit">
                    <template v-if="!tokenRequired">
                        <label class="kn-field">
                            <span class="kn-field-label">{{ $t("Username") }}</span>
                            <input
                                id="floatingInput"
                                v-model="username"
                                type="text"
                                class="kn-input"
                                autocomplete="username"
                                required
                            />
                        </label>

                        <label class="kn-field">
                            <span class="kn-field-label">{{ $t("Password") }}</span>
                            <input
                                id="floatingPassword"
                                ref="passwordInput"
                                v-model="password"
                                type="password"
                                class="kn-input"
                                autocomplete="current-password"
                                required
                            />
                        </label>
                    </template>

                    <label v-else class="kn-field">
                        <span class="kn-field-label">{{ $t("Token") }}</span>
                        <input
                            id="otp"
                            ref="otpInput"
                            v-model="token"
                            type="text"
                            inputmode="numeric"
                            maxlength="6"
                            class="kn-code-input"
                            placeholder="000000"
                            autocomplete="one-time-code"
                            required
                        />
                    </label>

                    <label class="si-remember">
                        <input id="remember" v-model="$root.remember" type="checkbox" class="kn-check" />
                        <span class="kn-small">{{ $t("Remember me") }}</span>
                    </label>

                    <button class="kn-btn kn-btn-primary kn-btn-lg" type="submit" :disabled="processing">
                        {{ processing ? $t("Signing in") : $t("Login") }}
                    </button>
                </form>
            </aside>
        </main>

        <footer class="si-foot">
            <span class="kn-data kn-muted">kyroNET internal</span>
        </footer>
    </div>
</template>

<script>
import { login, loginWithAegis, verifyTotp } from "../auth-client";
import BrandMark from "./BrandMark.vue";

export default {
    components: {
        BrandMark,
    },

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

    computed: {
        aegis() {
            return !!this.$root.info.aegisEnabled;
        },

        host() {
            return location.host;
        },

        /**
         * Message of a failed sign-in. A failed Aegis callback returns here with an error code in the query string.
         * @returns {string|null} Message to show
         */
        errorMsg() {
            if (this.res && !this.res.ok) {
                return this.$t(this.res.msg);
            }

            const code = this.$route.query.error;
            if (!code) {
                return null;
            }

            if (code === "access_denied") {
                return this.$t("aegisAccessDenied");
            }

            return this.$t("aegisSignInFailed", [String(code)]);
        },
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
         * Start the Aegis authorization code flow, the browser leaves this page
         * @returns {Promise<void>}
         */
        async continueWithAegis() {
            this.processing = true;
            this.res = null;

            try {
                await loginWithAegis();
            } catch (e) {
                this.res = { ok: false, msg: e.message };
                this.processing = false;
            }
        },

        /**
         * Submit the user details and attempt to log in
         * @returns {void}
         */
        async submit() {
            this.processing = true;

            try {
                if (this.tokenRequired) {
                    await verifyTotp(this.token);
                    return;
                }

                const result = await login(this.username, this.password, this.$root.remember);
                if (result === "twoFactorRequired") {
                    this.tokenRequired = true;
                }
            } catch (e) {
                this.res = { ok: false, msg: e.message };
                // The username stays filled, focus moves to the password
                this.$nextTick(() => {
                    this.$refs.passwordInput?.focus();
                });
            } finally {
                this.processing = false;
            }
        },
    },
};
</script>

<style lang="scss" scoped>
.si {
    display: grid;
    grid-template-rows: auto 1fr auto;
    min-height: 100vh;
}

.si-bar {
    border-bottom: var(--stroke) solid var(--border);

    .kn-brand {
        border-bottom: 0;
        padding: 0 var(--space-6);
    }
}

.si-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 360px;
    gap: var(--space-12);
    align-items: end;
    width: 100%;
    max-width: var(--content);
    margin: 0 auto;
    padding: var(--space-24) var(--space-6) var(--space-16);
}

.si-hero {
    display: grid;
    gap: var(--space-12);
}

.si-lead {
    max-width: var(--measure);
}

.si-facts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-8);
    padding-top: var(--space-4);
    border-top: var(--stroke-strong) solid var(--text);

    > div {
        display: grid;
        gap: var(--space-1);
    }
}

.si-side {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-6);
    background: var(--bg-raised);
    border: var(--stroke) solid var(--border);
    border-radius: var(--radius-lg);

    p {
        margin: 0;
    }

    .kn-alert {
        background: var(--bg);
    }

    .kn-input {
        height: var(--control-lg);
    }
}

.si-head,
.si-form {
    display: grid;
    gap: var(--space-2);
}

.si-form {
    gap: var(--space-4);
}

.si-remember {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
}

.si-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    min-height: 48px;
    padding: 0 var(--space-6);
    border-top: var(--stroke) solid var(--border);
}

@media (max-width: 860px) {
    .si-body {
        grid-template-columns: minmax(0, 1fr);
        gap: var(--space-8);
        padding: var(--space-12) var(--space-4) var(--space-8);
    }

    .kn-display {
        font-size: 48px;
    }

    .si-bar .kn-brand,
    .si-foot {
        padding: 0 var(--space-4);
    }
}
</style>
