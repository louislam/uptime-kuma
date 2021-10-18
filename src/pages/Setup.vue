<template>
    <div class="form-container">
        <div class="form">
            <form @submit.prevent="submit">
                <div>
                    <object width="64" height="64" data="/icon.svg" />
                    <div style="font-size: 28px; font-weight: bold; margin-top: 5px;">
                        Uptime Kuma
                    </div>
                </div>

                <p class="mt-3">
                    {{ $t("Create your admin account") }}
                </p>

                <div class="form-floating">
                    <select id="language" v-model="$i18n.locale" class="form-select">
                        <option v-for="(lang, i) in $i18n.availableLocales" :key="`Lang${i}`" :value="lang">
                            {{ $i18n.messages[lang].languageName }}
                        </option>
                    </select>
                    <label for="language" class="form-label">{{ $t("Language") }}</label>
                </div>

                <div class="form-floating mt-3">
                    <input id="floatingInput" v-model="username" type="text" class="form-control" placeholder="Username" required>
                    <label for="floatingInput">{{ $t("Username") }}</label>
                </div>

                <div class="form-floating mt-3">
                    <input id="floatingPassword" v-model="password" type="password" class="form-control" placeholder="Password" required>
                    <label for="floatingPassword">{{ $t("Password") }}</label>
                </div>

                <div class="form-floating mt-3">
                    <input id="repeat" v-model="repeatPassword" type="password" class="form-control" placeholder="Repeat Password" required>
                    <label for="repeat">{{ $t("Repeat Password") }}</label>
                </div>

                <button class="w-100 btn btn-primary mt-3" type="submit" :disabled="processing">
                    {{ $t("Create") }}
                </button>
            </form>
        </div>
    </div>
</template>

<script>
import { useToast } from "vue-toastification";
const toast = useToast();

export default {
    data() {
        return {
            processing: false,
            username: "",
            password: "",
            repeatPassword: "",
        };
    },
    watch: {
        "$i18n.locale"() {
            localStorage.locale = this.$i18n.locale;
        },
    },
    mounted() {
        this.$root.getSocket().emit("needSetup", (needSetup) => {
            if (! needSetup) {
                this.$router.push("/");
            }
        });
    },
    methods: {
        submit() {
            this.processing = true;

            if (this.password !== this.repeatPassword) {
                toast.error(this.$t("PasswordsDoNotMatch"));
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
</style>
