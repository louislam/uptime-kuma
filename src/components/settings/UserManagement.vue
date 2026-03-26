<template>
    <div>
        <div class="add-btn">
            <button class="btn btn-primary me-2" type="button" @click="$refs.userDialog.showAdd()">
                <font-awesome-icon icon="plus" />
                {{ $t("Add User") }}
            </button>
        </div>

        <div>
            <span
                v-if="users.length === 0"
                class="d-flex align-items-center justify-content-center my-3"
            >
                {{ $t("No Users") }}
            </span>

            <div
                v-for="item in users"
                :key="item.id"
                class="item"
            >
                <div class="left-part">
                    <div class="info">
                        <div class="title">{{ item.username }}</div>
                    </div>
                </div>

                <div class="buttons">
                    <div class="btn-group" role="group">
                        <button class="btn btn-normal" @click="$refs.userDialog.showEdit(item)">
                            <font-awesome-icon icon="pen" />
                            {{ $t("Edit") }}
                        </button>
                        <button class="btn btn-normal" @click="$refs.userPasswordDialog.show(item.id)">
                            <font-awesome-icon icon="edit" />
                            {{ $t("Change Password") }}
                        </button>
                        <button
                            class="btn btn-danger"
                            :disabled="item.username === $root.username"
                            @click="confirmDelete(item.id)"
                        >
                            <font-awesome-icon icon="trash" />
                            {{ $t("Delete") }}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <Confirm ref="confirmDeleteDialog" btn-style="btn-danger" :yes-text="$t('Yes')" :no-text="$t('No')" @yes="deleteUser">
            {{ $t("confirmDeleteUser") }}
        </Confirm>

        <UserDialog ref="userDialog" />
        <UserPasswordDialog ref="userPasswordDialog" />
    </div>
</template>

<script>
import Confirm from "../Confirm.vue";
import UserDialog from "./UserDialog.vue";
import UserPasswordDialog from "./UserPasswordDialog.vue";

export default {
    components: {
        Confirm,
        UserDialog,
        UserPasswordDialog,
    },
    data() {
        return {
            selectedUserID: null,
        };
    },
    computed: {
        /**
         * Get user list from root
         * @returns {Array} List of users
         */
        users() {
            return this.$root.userList;
        },
    },
    mounted() {
        this.$root.getSocket().emit("getUsers", () => {});
    },
    methods: {
        /**
         * Show confirmation dialog for deletion
         * @param {number} userID ID of user to delete
         * @returns {void}
         */
        confirmDelete(userID) {
            this.selectedUserID = userID;
            this.$refs.confirmDeleteDialog.show();
        },

        /**
         * Delete the selected user
         * @returns {void}
         */
        deleteUser() {
            this.$root.getSocket().emit("deleteUser", this.selectedUserID, (res) => {
                this.$root.toastRes(res);
            });
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../../assets/vars.scss";

.mobile {
    .item {
        flex-direction: column;
        align-items: flex-start;
        margin-bottom: 20px;
    }
}

.add-btn {
    padding-top: 20px;
    padding-bottom: 20px;
}

.item {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    border-radius: 10px;
    transition: all ease-in-out 0.15s;
    justify-content: space-between;
    padding: 10px;
    min-height: 90px;
    margin-bottom: 5px;

    &:hover {
        background-color: $highlight-white;
    }

    .left-part {
        display: flex;
        gap: 12px;
        align-items: center;

        .info {
            .title {
                font-weight: bold;
                font-size: 20px;
            }

            .status {
                font-size: 14px;
            }
        }
    }

    .buttons {
        display: flex;
        gap: 8px;
        flex-direction: row-reverse;
    }
}

.dark {
    .item {
        &:hover {
            background-color: $dark-bg2;
        }
    }
}
</style>
