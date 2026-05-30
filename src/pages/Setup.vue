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
                    />
                    <label for="floatingPassword">{{ $t("Password") }}</label>
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
import { checkFetch } from "../util";
import { authClient, baseURL, login } from "../auth-client";

export default {
    data() {
        return {
            processing: false,
            username: "",
            password: "",
            repeatPassword: "",
        };
    },
    watch: {},
    mounted() {
        this.$root.getSocket().emit("needSetup", (needSetup) => {
            if (!needSetup) {
                this.$router.push("/");
            }
        });
    },
    methods: {
        /**
         * Submit form data for processing
         * @returns {void}
         */
        async submit() {
            this.processing = true;

            if (this.password !== this.repeatPassword) {
                this.$root.toastError("PasswordsDoNotMatch");
                this.processing = false;
                return;
            }

            try {
                const response = await fetch(baseURL + "/api/setup", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        username: this.username,
                        password: this.password,
                    }),
                });

                await checkFetch(response);

                // Login
                await login(this.username, this.password);
            } catch (error) {
                this.$root.toastRes({
                    ok: false,
                    msg: error.message,
                    msgi18n: false,
                });
            } finally {
                this.processing = false;
            }
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
</style>
