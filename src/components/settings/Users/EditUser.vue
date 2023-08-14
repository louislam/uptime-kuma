<template>
    <div v-if="loading" class="d-flex align-items-center justify-content-center my-3 spinner">
        <font-awesome-icon icon="spinner" size="2x" spin />
    </div>

    <template v-else>
        <h5 class="my-4 settings-subheading">{{ $t("Identity") }}</h5>
        <form @submit.prevent="save({ username })">
            <label class="form-label d-block mb-3">
                {{ $t("Username") }}
                <input
                    v-model="username"
                    :placeholder="$t('Username')"
                    class="form-control mt-2"
                    required
                    :disabled="saving"
                />
            </label>

            <button class="btn btn-primary" type="submit" :disabled="saving">
                <span v-show="saving" class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                {{ $t("Update Username") }}
            </button>
        </form>

        <h5 class="mt-5 mb-4 settings-subheading">{{ $t("Change Password") }}</h5>
        <form class="mb-3" @submit.prevent="savePassword">
            <div class="mb-3">
                <label class="form-label d-block">
                    {{ $t("Current Password") }}
                    <input
                        v-model="currentPassword"
                        type="password"
                        :placeholder="$t('Current Password')"
                        class="form-control mt-2"
                        required
                        :disabled="savingPassword"
                    />
                </label>
            </div>

            <div class="mb-3">
                <label class="form-label d-block">
                    {{ $t("New Password") }}
                    <input
                        v-model="newPassword"
                        type="password"
                        :placeholder="$t('New Password')"
                        class="form-control mt-2"
                        required
                        :disabled="savingPassword"
                    />
                </label>
            </div>

            <div class="mb-3">
                <label class="form-label d-block">
                    {{ $t("Repeat New Password") }}
                    <input
                        v-model="repeatNewPassword"
                        type="password"
                        :placeholder="$t('Repeat New Password')"
                        class="form-control mt-2"
                        required
                        :disabled="savingPassword"
                    />
                </label>
            </div>

            <button class="btn btn-primary" type="submit" :disabled="savingPassword">
                <span v-show="savingPassword" class="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                {{ $t("Update Password") }}
            </button>
        </form>

        <h5 class="mt-5 mb-4 settings-subheading">{{ $t("Permissions") }}</h5>
        <div class="form-check form-switch">
            <label class="form-check-label">
                <input
                    :checked="active"
                    class="form-check-input"
                    style="scale: 1.4; cursor: pointer;"
                    type="checkbox"
                    :disabled="saving"
                    @click="debounceCheckboxClick(() => { active = !active; save({ active }); })"
                >
                <div class="ps-2">{{ $t("Active") }}</div>
            </label>
        </div>
    </template>
</template>

<script>
import { Debounce } from "../../../util-frontend.js";
import { useToast } from "vue-toastification";
const toast = useToast();

export default {
    props: {
        id: {
            type: String,
            required: true
        }
    },

    data: () => ({
        loading: false,
        username: "",
        saving: false,
        currentPassword: "",
        newPassword: "",
        repeatNewPassword: "",
        savingPassword: false,
        active: false
    }),

    mounted() {
        this.getUser();
    },

    methods: {
        // Used to ignore one of the two "click" events fired when clicking on the checkbox label
        debounceCheckboxClick: new Debounce(),

        /**
         * Get user from server
         * @returns {void}
         */
        getUser() {
            this.loading = true;
            this.$root.getSocket().emit("getUser", this.id, (res) => {
                this.loading = false;
                if (res.ok) {
                    const { username, active } = res.user;

                    this.username = username;
                    this.active = active;
                } else {
                    toast.error(res.msg);
                }
            });
        },

        /**
         * Check new passwords match before saving it
         * @returns {void}
         */
        savePassword() {
            this.savingPassword = true;
            const { currentPassword, newPassword, repeatNewPassword } = this;

            if (newPassword !== repeatNewPassword) {
                toast.error(this.$t("PasswordsDoNotMatch"));
                this.savingPassword = false;
                return;
            }

            this.$root
                .getSocket()
                .emit(
                    "changePassword",
                    this.id,
                    {
                        currentPassword,
                        newPassword
                    },
                    (res) => {
                        this.savingPassword = false;
                        this.$root.toastRes(res);

                        if (res.ok) {
                            this.currentPassword = "";
                            this.newPassword = "";
                            this.repeatNewPassword = "";
                        }
                    });

        },

        /**
         * Save user changes
         * @param {object} user user to save
         * @param {string} [user.username] username used as login identifier.
         * @param {boolean} [user.active] is the user authorized to login?
         * @returns {void}
         */
        save(user) {
            this.saving = true;

            this.$root
                .getSocket()
                .emit(
                    "saveUser",
                    {
                        id: this.id,
                        ...user
                    },
                    (res) => {
                        this.saving = false;
                        this.$root.toastRes(res);
                    });
        },
    },
};
</script>
