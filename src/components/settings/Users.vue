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
import { ref, onMounted, useTemplateRef } from "vue";
import { useToast } from "vue-toastification";
import type { UserWithRole } from "better-auth/client/plugins";

import { authClient } from "../../auth-client";

import Confirm from "../Confirm.vue";
import AddUserDialog from "../AddUserDialog.vue";
import DisplayPasswordDialog from "../DisplayPasswordDialog.vue";

// UI
const toast = useToast();
const confirmDelete = useTemplateRef<InstanceType<typeof Confirm>>("confirmDelete");
const addUserDialog = useTemplateRef<InstanceType<typeof AddUserDialog>>("addUserDialog");
const displayPasswordDialog = useTemplateRef<InstanceType<typeof DisplayPasswordDialog>>("displayPasswordDialog");

// Data
const userList = ref<UserWithRole[]>([]);
const selectedUserId = ref<string | null>(null);
const userPassword = ref<string>("");

// Functions
/**
 * Fetch the list of users from the server
 */
const fetchUsers = () =>
    authClient.admin
        .listUsers({ query: { limit: 100 } })
        .then(({ data, error }) => {
            if (error) {
                throw error;
            }
            return (userList.value = data?.users ?? []);
        })
        .catch((err) => toast.error(err.message || "Failed to fetch users"));

onMounted(fetchUsers);

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
const newPasswordLength = 20;
const newPasswordChars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz~!@-#$";
const generatePassword = () =>
    Array.from(crypto.getRandomValues(new Uint32Array(newPasswordLength))).reduce(
        (acc, c) => `${acc}${newPasswordChars[c % newPasswordChars.length]}`,
        ""
    );
</script>

<style lang="scss" scoped>
@import "../../assets/vars.scss";

.add-btn {
    padding: 20px 0;
}

.item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px;
    min-height: 90px;
    margin-bottom: 5px;
    text-decoration: none;
    border-radius: 10px;
    transition: all ease-in-out 0.15s;

    .left-part {
        display: flex;
        gap: 12px;
        align-items: center;

        .info .title {
            font-weight: bold;
            font-size: 20px;
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

.dark .item:hover {
    background-color: $dark-bg2;
}
</style>
