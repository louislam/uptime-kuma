<template>
    <div class="my-4">
        <div class="mx-0 mx-lg-4 pt-1 mb-4">
            <button class="btn btn-primary" @click="$router.push({ name: 'settings.users.add' })">
                <font-awesome-icon icon="plus" /> {{ $t("Add New User") }}
            </button>
        </div>

        <div v-if="loading" class="d-flex align-items-center justify-content-center my-3 spinner">
            <font-awesome-icon icon="spinner" size="2x" spin />
        </div>

        <div v-else class="my-3">
            <RouterLink
                v-for="({ id, username, active }, index) in usersList"
                :key="id"
                class="d-flex align-items-center mx-0 mx-lg-4 py-1 text-decoration-none users-list-row"
                :to="{ name: 'settings.users.edit', params: { id } }"
            >
                <div class="col-10 col-sm-5 m-2 flex-shrink-1 fw-bold">
                    {{ username }}
                </div>
                <div class="col-5 px-1 flex-shrink-1 d-none d-sm-flex gap-2 align-items-center">
                    <font-awesome-icon :class="active ? 'text-success' : 'text-muted'" :icon="active ? 'check-circle' : 'times-circle'" />
                    <div>{{ $t(active ? "Active" : "Inactive") }}</div>
                </div>
                <div class="col-2 pe-2 pe-lg-3 d-flex justify-content-end">
                    <button
                        type="button"
                        class="btn-ban-user btn ms-2 py-1"
                        :class="active ? 'btn-outline-danger' : 'btn-outline-success'"
                        :disabled="processing"
                        @click.prevent="active ? disableConfirm(usersList[index]) : toggleActiveUser(usersList[index])"
                    >
                        <font-awesome-icon class="" :icon="active ? 'user-slash' : 'user-check'" />
                    </button>
                </div>
            </RouterLink>
        </div>

        <Confirm
            ref="confirmDisable"
            btn-style="btn-danger"
            :yes-text="$t('Yes')"
            :no-text="$t('No')"
            @yes="toggleActiveUser(disablingUser)"
            @no="disablingUser = null"
        >
            {{ $t("confirmDisableUserMsg") }}
        </Confirm>
    </div>
</template>

<script>
import { useToast } from "vue-toastification";
import Confirm from "../../Confirm.vue";
const toast = useToast();

export default {
    components: { Confirm },

    data: () => ({
        loading: false,
        processing: false,
        usersList: null,
        disablingUser: null,
    }),

    mounted() {
        this.getUsers();
    },

    methods: {
        /**
         * Get list of users from server
         * @returns {void}
         */
        getUsers() {
            this.loading = true;
            this.$root.getSocket().emit("getUsers", (res) => {
                this.loading = false;
                if (res.ok) {
                    this.usersList = res.users;
                } else {
                    toast.error(res.msg);
                }
            });
        },

        /**
         * Show confirmation for disabling a user
         * @param {object} user the user to confirm disable in the local usersList
         * @returns {void}
         */
        disableConfirm(user) {
            this.disablingUser = user;
            this.$refs.confirmDisable.show();
        },

        /**
         * Disable a user from server
         * @param {object} user the user to disable in the local usersList
         * @param {boolean} user.active is the user authorized to login?
         * @returns {void}
         */
        toggleActiveUser({ active, ...rest }) {
            this.processing = true;
            this.$root.getSocket().emit(
                "saveUser",
                {
                    ...rest,
                    active: !active
                },
                (res) => {
                    this.$root.toastRes(res);
                    this.processing = false;
                    this.disablingUser &&= null;

                    if (res.ok) {
                        this.getUsers();
                    }
                });
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../../../assets/vars.scss";

.btn-ban-user {
    padding-left: 7px;
    padding-right: 7px;
}

.users-list-row {
    cursor: pointer;
    border-top: 1px solid rgba(0, 0, 0, 0.125);

    .dark & {
        border-top: 1px solid $dark-border-color;
    }

    &:hover {
        background-color: $highlight-white;
    }

    .dark &:hover {
        background-color: $dark-bg2;
    }
}

</style>
