<template>
    <div>
        <div class="add-btn">
            <button
                class="btn btn-primary me-2"
                type="button"
                data-testid="add-user-button"
                @click="addUserDialog?.show()"
            >
                <font-awesome-icon icon="plus" />
                {{ $t("Add user") }}
            </button>
        </div>

        <div data-testid="users-list">
            <div v-for="(item, index) in userList" :key="index" class="item" data-testid="user">
                <div class="left-part">
                    <div class="info">
                        <div class="title">{{ item.name }}</div>
                    </div>
                </div>

                <!-- Manage user buttons -->
                <div v-if="item.name !== $root?.username" class="buttons">
                    <div class="btn-group" role="group">
                        <button class="btn btn-primary" @click="resetPassword(item.id)">
                            <font-awesome-icon icon="key" />
                            {{ $t("Reset password") }}
                        </button>

                        <button class="btn btn-danger" data-testid="delete-user-button" @click="deleteDialog(item.id)">
                            <font-awesome-icon icon="trash" />
                            {{ $t("Delete") }}
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <Confirm ref="confirmDelete" btn-style="btn-danger" :yes-text="$t('Yes')" :no-text="$t('No')" @yes="deleteUser">
            {{ $t("deleteUserMsg") }}
        </Confirm>

        <DisplayPasswordDialog ref="displayPasswordDialog" :password="userPassword" @close="userPassword = ''" />
        <AddUserDialog ref="addUserDialog" @add="addUser" />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useToast } from "vue-toastification";
import type { UserWithRole } from "better-auth/client/plugins";

import { authClient } from "../../auth-client";

import Confirm from "../Confirm.vue";
import AddUserDialog from "../AddUserDialog.vue";
import DisplayPasswordDialog from "../DisplayPasswordDialog.vue";

// UI
const toast = useToast();
const confirmDelete = ref<InstanceType<typeof Confirm> | null>(null);
const addUserDialog = ref<InstanceType<typeof AddUserDialog> | null>(null);
const displayPasswordDialog = ref<InstanceType<typeof DisplayPasswordDialog> | null>(null);

// Data
const userList = ref<UserWithRole[]>([]);
const selectedUserId = ref<string | null>(null);
const userPassword = ref<string>("");

onMounted(() => {
    fetchUsers();
});

// Functions
/**
 * Fetch the list of users from the server
 */
const fetchUsers = async () => {
    const { data, error } = await authClient.admin.listUsers({
        query: {
            limit: 100,
        },
    });

    if (!data || !!error) {
        toast.error(error.message || "Failed to fetch users");
        return;
    }

    userList.value = data.users;
};

/**
 * Add a new user
 * @param username Username of the new user
 */
const addUser = async (username: string) => {
    const password = generatePassword();

    const { error } = await authClient.admin.createUser({
        name: username,
        email: username + "@noreply.uptime-kuma.internal",
        password: password,
        role: "admin",
        data: {
            username,
        },
    });

    if (!!error) {
        toast.error(error.message || "Failed to add user");
        return;
    }

    toast.success("User added successfully");
    fetchUsers();

    userPassword.value = password;
    displayPasswordDialog.value?.show();
};

/**
 * Reset password for a user
 * @param userId
 */
const resetPassword = async (userId: string) => {
    const newPassword = generatePassword();

    const { data, error } = await authClient.admin.setUserPassword({
        newPassword,
        userId,
    });

    if (!data || !!error) {
        toast.error(error.message || "Failed to reset password");
        return;
    }

    toast.success("Password reset successfully");

    userPassword.value = newPassword;
    displayPasswordDialog.value?.show();
};

/**
 * Show dialog to confirm deletion
 * @param {number} userID ID of user that is being deleted
 * @returns {void}
 */
const deleteDialog = (userID: string): void => {
    selectedUserId.value = userID;
    confirmDelete.value!.show();
};

/**
 * Delete a user
 * @returns {void}
 */
const deleteUser = async (): Promise<void> => {
    const { error } = await authClient.admin.removeUser({
        userId: selectedUserId.value,
    });

    if (!!error) {
        toast.error(error.message || "Failed to delete user");
        return;
    }

    toast.success("User deleted successfully");
    fetchUsers();
};

/**
 * Generate a 20-character random password
 */
const generatePassword = () => {
    const length = 20;
    const characters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz~!@-#$";

    const password = Array.from(crypto.getRandomValues(new Uint32Array(length)))
        .map((x) => characters[x % characters.length])
        .join("");

    return password;
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

    .left-part {
        display: flex;
        gap: 12px;
        align-items: center;

        .info {
            .title {
                font-weight: bold;
                font-size: 20px;
            }
        }
    }

    .buttons {
        display: flex;
        gap: 8px;
        flex-direction: row-reverse;

        .btn-group {
            width: 310px;
        }
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
