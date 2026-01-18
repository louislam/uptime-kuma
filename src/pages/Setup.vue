<template>
    <div class="form-container" data-cy="setup-form">
        <div class="form">
            <form @submit.prevent="submit">
                <div>
                    <object width="64" height="64" data="/icon.svg" />
                    <div style="font-size: 28px; font-weight: bold; margin-top: 5px">Uptime Kuma</div>
                </div>

                <p class="mt-3">
                    {{ $t("Create your admin account") }}
                </p>

                <div class="form-floating">
                    <select id="language" v-model="$root.language" class="form-select">
                        <option v-for="(lang, i) in $i18n.availableLocales" :key="`Lang${i}`" :value="lang">
                            {{ $i18n.messages[lang].languageName }}
                        </option>
                    </select>
                    <label for="language" class="form-label">{{ $t("Language") }}</label>
                </div>

                <div class="form-floating mt-3">
                    <input
                        id="floatingInput"
                        v-model="username"
                        type="text"
                        class="form-control"
                        :placeholder="$t('Username')"
                        required
                        data-cy="username-input"
                    />
                    <label for="floatingInput">{{ $t("Username") }}</label>
                </div>

                <div class="form-floating mt-3">
                    <input
                        id="floatingPassword"
                        v-model="password"
                        type="password"
                        class="form-control"
                        :placeholder="$t('Password')"
                        required
                        data-cy="password-input"
                        @input="checkPasswordStrength"
                    />
                    <label for="floatingPassword">{{ $t("Password") }}</label>
                </div>

                <!-- Password strength indicator -->
                <div v-if="password && passwordStrength !== null" class="password-strength mt-2">
                    <div class="strength-meter">
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

                <div class="form-floating mt-3">
                    <input
                        id="repeat"
                        v-model="repeatPassword"
                        type="password"
                        class="form-control"
                        :placeholder="$t('Repeat Password')"
                        required
                        data-cy="password-repeat-input"
                    />
                    <label for="repeat">{{ $t("Repeat Password") }}</label>
                </div>

                <button
                    class="w-100 btn btn-primary mt-3"
                    type="submit"
                    :disabled="processing"
                    data-cy="submit-setup-form"
                >
                    {{ $t("Create") }}
                </button>
            </form>
        </div>
    </div>
</template>

<script>
import zxcvbn from "zxcvbn";

export default {
    data() {
        return {
            processing: false,
            username: "",
            password: "",
            repeatPassword: "",
            passwordStrength: null,
        };
    },
    computed: {
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
    watch: {},
    mounted() {
        // TODO: Check if it is a database setup

        this.$root.getSocket().emit("needSetup", (needSetup) => {
            if (!needSetup) {
                this.$router.push("/");
            }
        });
    },
    methods: {
        /**
         * Check password strength using zxcvbn
         * @returns {void}
         */
        checkPasswordStrength() {
            if (!this.password) {
                this.passwordStrength = null;
                return;
            }
            
            const result = zxcvbn(this.password, [ this.username ]);
            this.passwordStrength = result.score;
        },
        /**
         * Submit form data for processing
         * @returns {void}
         */
        submit() {
            this.processing = true;

            if (this.password !== this.repeatPassword) {
                this.$root.toastError("PasswordsDoNotMatch");
                this.processing = false;
                return;
            }

            this.$root.getSocket().emit("setup", this.username, this.password, (res) => {
                this.processing = false;
                this.$root.toastRes(res);

                if (res.ok) {
                    this.processing = true;

                    this.$root.login(this.username, this.password, "", () => {
                        this.processing = false;
                        this.$router.push("/");
                    });
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
    > .form-select {
        padding-left: 1.3rem;
        padding-top: 1.525rem;
        line-height: 1.35;

        ~ label {
            padding-left: 1.3rem;
        }
    }

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

.password-strength {
    margin-top: 0.5rem;
}

.strength-meter {
    height: 5px;
    background-color: #e0e0e0;
    border-radius: 3px;
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
