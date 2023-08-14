<template>
    <h4 class="mt-4">
        {{ $t("Create an admin account") }}
    </h4>

    <form data-cy="setup-form" @submit.prevent="create">
        <div class="my-3">
            <label class="form-label d-block">
                {{ $t("Username") }}
                <input
                    v-model="username"
                    type="text"
                    class="form-control mt-2"
                    :placeholder="$t('Username')"
                    required
                    :disabled="creating"
                    data-cy="username-input"
                >
            </label>
        </div>

        <div class="mb-3">
            <label class="form-label d-block">
                {{ $t("Password") }}
                <input
                    v-model="password"
                    type="password"
                    class="form-control mt-2"
                    :placeholder="$t('Password')"
                    required
                    :disabled="creating"
                    data-cy="password-input"
                >
            </label>
        </div>

        <div class="mb-3">
            <label class="form-label d-block">
                {{ $t("Repeat Password") }}
                <input
                    v-model="repeatPassword"
                    type="password"
                    class="form-control mt-2"
                    :placeholder="$t('Repeat Password')"
                    required
                    :disabled="creating"
                    data-cy="password-repeat-input"
                >
            </label>
        </div>

        <button class="btn btn-primary" type="submit" :disabled="creating" data-cy="submit-create-admin-form">
            <span v-show="creating" class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
            {{ $t("Create") }}
        </button>
    </form>
</template>

<script>
import { useToast } from "vue-toastification";
const toast = useToast();

export default {
    data: () => ({
        creating: false,
        username: "",
        password: "",
        repeatPassword: "",
    }),

    methods: {
        /**
         * Create an admin account
         * @returns {void}
         */
        create() {
            this.creating = true;

            if (this.password !== this.repeatPassword) {
                toast.error(this.$t("PasswordsDoNotMatch"));
                this.creating = false;
                return;
            }

            this.$root.getSocket().emit("setup", this.username, this.password, (res) => {
                this.creating = false;
                this.$root.toastRes(res);

                res.ok && this.$router.push({ name: "settings.users" });
            });
        },
    },
};
</script>
